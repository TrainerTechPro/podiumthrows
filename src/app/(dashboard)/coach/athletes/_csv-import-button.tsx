"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Check, AlertCircle } from "lucide-react";
import { Button, Modal } from "@/components";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";

type Gender = "MALE" | "FEMALE" | "OTHER";
type ThrowEvent = "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";

const VALID_GENDERS: ReadonlySet<string> = new Set(["MALE", "FEMALE", "OTHER"]);
const VALID_EVENTS: ReadonlySet<string> = new Set(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]);

/** Alias mapping for event shorthand. Split on the primary separator below. */
const EVENT_ALIASES: Record<string, ThrowEvent> = {
  SHOT: "SHOT_PUT",
  SHOTPUT: "SHOT_PUT",
  SHOT_PUT: "SHOT_PUT",
  DISC: "DISCUS",
  DISCUS: "DISCUS",
  HAMMER: "HAMMER",
  JAV: "JAVELIN",
  JAVELIN: "JAVELIN",
};

type ParsedRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  gender: Gender | null;
  events: ThrowEvent[];
  errors: string[];
};

type CreateResult = {
  rowNumber: number;
  name: string;
  ok: boolean;
  error: string | null;
};

/* ── Parser ──────────────────────────────────────────────────────────────── */

function detectDelimiter(firstLine: string): "\t" | "," {
  return firstLine.includes("\t") ? "\t" : ",";
}

/** Split a single CSV line, honoring quoted fields. */
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_-]/g, "");
}

/** Expected normalized headers → canonical key. */
const HEADER_MAP: Record<
  string,
  keyof Pick<ParsedRow, "firstName" | "lastName" | "gender" | "events">
> = {
  firstname: "firstName",
  first: "firstName",
  lastname: "lastName",
  last: "lastName",
  gender: "gender",
  sex: "gender",
  events: "events",
  event: "events",
};

type RowShape = {
  firstName?: string;
  lastName?: string;
  gender?: string;
  events?: string;
};

function parseCsv(raw: string): { rows: ParsedRow[]; missingColumns: string[] } {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { rows: [], missingColumns: ["firstName", "lastName", "gender", "events"] };
  }

  const delim = detectDelimiter(lines[0]);
  const rawHeaders = splitCsvLine(lines[0], delim);
  const columnIndexByKey: Partial<Record<keyof RowShape, number>> = {};
  rawHeaders.forEach((h, i) => {
    const key = HEADER_MAP[normalizeHeader(h)];
    if (key) columnIndexByKey[key] = i;
  });

  const requiredKeys: (keyof RowShape)[] = ["firstName", "lastName", "gender", "events"];
  const missing = requiredKeys.filter((k) => columnIndexByKey[k] === undefined);
  if (missing.length > 0) {
    return { rows: [], missingColumns: missing };
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delim);
    const pick = (k: keyof RowShape) => {
      const idx = columnIndexByKey[k];
      return idx !== undefined ? (cells[idx] ?? "").trim() : "";
    };

    const errors: string[] = [];
    const firstName = pick("firstName");
    const lastName = pick("lastName");
    const genderRaw = pick("gender").toUpperCase();
    const eventsRaw = pick("events");

    if (!firstName) errors.push("firstName missing");
    if (!lastName) errors.push("lastName missing");

    let gender: Gender | null = null;
    if (!genderRaw) {
      errors.push("gender missing");
    } else if (!VALID_GENDERS.has(genderRaw)) {
      errors.push(`gender "${genderRaw}" invalid (use MALE, FEMALE, or OTHER)`);
    } else {
      gender = genderRaw as Gender;
    }

    const events: ThrowEvent[] = [];
    if (!eventsRaw) {
      errors.push("events missing");
    } else {
      const tokens = eventsRaw
        .split(/[;|,]/)
        .map((t) => t.trim().toUpperCase().replace(/\s+/g, "_"))
        .filter(Boolean);

      if (tokens.length === 0) {
        errors.push("events missing");
      } else {
        const bad: string[] = [];
        for (const t of tokens) {
          const mapped = EVENT_ALIASES[t] ?? (VALID_EVENTS.has(t) ? (t as ThrowEvent) : null);
          if (mapped && !events.includes(mapped)) events.push(mapped);
          else if (!mapped) bad.push(t);
        }
        if (bad.length > 0) {
          errors.push(`events not recognized: ${bad.join(", ")}`);
        }
      }
    }

    rows.push({
      rowNumber: i,
      firstName,
      lastName,
      gender,
      events,
      errors,
    });
  }

  return { rows, missingColumns: [] };
}

/* ── Component ───────────────────────────────────────────────────────────── */

export function CsvImportButton({
  athleteCount,
  planLimit,
  selectedTeamId,
}: {
  athleteCount: number;
  planLimit: number;
  /**
   * When set, successfully-imported athletes are also added to this team in
   * one batched POST /api/coach/teams/[id]/members call. Matches the
   * per-single-athlete behavior of AddAthleteButton so a coach filtered to a
   * specific group sees their imports land there by default.
   */
  selectedTeamId?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<CreateResult[] | null>(null);

  const parsed = useMemo(() => (input.trim() ? parseCsv(input) : null), [input]);
  const validRows = parsed?.rows.filter((r) => r.errors.length === 0) ?? [];
  const invalidCount = (parsed?.rows.length ?? 0) - validRows.length;

  const remainingSlots = planLimit === Infinity ? Infinity : Math.max(0, planLimit - athleteCount);
  const willExceedLimit = validRows.length > remainingSlots;

  function openModal() {
    setOpen(true);
    setInput("");
    setResults(null);
  }

  function closeModal() {
    if (importing) return;
    setOpen(false);
  }

  async function handleImport() {
    if (validRows.length === 0) return;

    setImporting(true);
    setResults(null);

    const settled = await Promise.allSettled(
      validRows.map((r) =>
        fetch("/api/coach/athletes", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            firstName: r.firstName,
            lastName: r.lastName,
            gender: r.gender,
            events: r.events,
          }),
        }).then(async (res) => {
          const payload = await res.json();
          if (!res.ok || !payload.success) {
            throw new Error(payload.error || `Request failed (${res.status})`);
          }
          return payload.data;
        })
      )
    );

    const out: CreateResult[] = settled.map((s, i) => {
      const r = validRows[i];
      const name = `${r.firstName} ${r.lastName}`;
      if (s.status === "fulfilled") return { rowNumber: r.rowNumber, name, ok: true, error: null };
      return {
        rowNumber: r.rowNumber,
        name,
        ok: false,
        error: s.reason instanceof Error ? s.reason.message : "Failed",
      };
    });

    // If the coach is filtered to a specific team, batch-add successfully
    // created athletes to that team in one request. Non-blocking: if the
    // team assignment fails, the athletes still got created — we surface
    // a softer warning rather than rolling back.
    if (selectedTeamId) {
      const createdIds = settled.flatMap((s) =>
        s.status === "fulfilled" && s.value?.id ? [s.value.id as string] : []
      );
      if (createdIds.length > 0) {
        try {
          const teamRes = await fetch(`/api/coach/teams/${selectedTeamId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ athleteIds: createdIds }),
          });
          if (!teamRes.ok) {
            toast.warning(
              "Imported but group assignment failed",
              "Athletes are on your roster. Add them to the group manually."
            );
          }
        } catch {
          toast.warning(
            "Imported but group assignment failed",
            "Athletes are on your roster. Add them to the group manually."
          );
        }
      }
    }

    setResults(out);
    setImporting(false);

    const ok = out.filter((r) => r.ok).length;
    const failed = out.length - ok;
    if (failed === 0) {
      toast.success(`Imported ${ok} athlete${ok === 1 ? "" : "s"}`);
    } else if (ok === 0) {
      toast.error("Import failed", "None of the rows were saved.");
    } else {
      toast.warning(`Imported ${ok} of ${out.length}`, "Some rows failed — see details below.");
    }

    router.refresh();
  }

  const SAMPLE = `firstName,lastName,gender,events
Sarah,Chen,FEMALE,SHOT_PUT;DISCUS
Marcus,Ivanov,MALE,HAMMER
Priya,Patel,FEMALE,JAVELIN`;

  return (
    <>
      <Button variant="secondary" onClick={openModal} aria-label="Import athletes from CSV">
        <Upload size={14} strokeWidth={1.75} className="mr-1.5" aria-hidden="true" />
        Import CSV
      </Button>

      <Modal
        open={open}
        onClose={closeModal}
        title={results ? "Import complete" : "Import athletes from CSV"}
        description={
          results
            ? "Results per row are below."
            : "Paste CSV or tab-separated data from Excel or Google Sheets. Required columns: firstName, lastName, gender, events."
        }
        size="xl"
        footer={
          results ? (
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="primary" onClick={closeModal}>
                Done
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="ghost" onClick={closeModal} disabled={importing}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleImport}
                loading={importing}
                disabled={validRows.length === 0 || willExceedLimit}
              >
                {validRows.length > 0
                  ? `Import ${validRows.length} athlete${validRows.length === 1 ? "" : "s"}`
                  : "Import"}
              </Button>
            </div>
          )
        }
      >
        {results ? (
          <ul className="divide-y divide-[var(--card-border)] max-h-96 overflow-y-auto custom-scrollbar">
            {results.map((r) => (
              <li key={r.rowNumber} className="py-2.5 flex items-center gap-3">
                {r.ok ? (
                  <Check
                    size={16}
                    strokeWidth={2}
                    className="text-emerald-600 dark:text-emerald-400 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <X
                    size={16}
                    strokeWidth={2}
                    className="text-danger-600 dark:text-danger-400 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span className="text-xs text-muted font-mono tabular-nums shrink-0">
                  Row {r.rowNumber}
                </span>
                <span className="text-sm font-medium truncate flex-1">{r.name}</span>
                {r.error && (
                  <span className="text-xs text-danger-600 dark:text-danger-400 truncate">
                    {r.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="csv-input"
                className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5"
              >
                CSV Data
              </label>
              <textarea
                id="csv-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={8}
                placeholder={SAMPLE}
                spellCheck={false}
                className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-y"
              />
              <p className="text-xs text-muted mt-1.5">
                Events can be combined with semicolons or pipes:{" "}
                <code className="font-mono">SHOT_PUT;DISCUS</code>. Gender must be MALE, FEMALE, or
                OTHER.
              </p>
            </div>

            {/* Preview + validation summary */}
            {parsed && parsed.missingColumns.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5 flex items-start gap-2">
                <AlertCircle
                  className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                    Missing required columns: {parsed.missingColumns.join(", ")}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    The first line must contain column headers.
                  </p>
                </div>
              </div>
            )}

            {parsed && parsed.missingColumns.length === 0 && parsed.rows.length > 0 && (
              <>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {validRows.length} valid
                  </span>
                  {invalidCount > 0 && (
                    <span className="text-danger-600 dark:text-danger-400 font-semibold">
                      {invalidCount} invalid
                    </span>
                  )}
                  {willExceedLimit && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      Exceeds plan limit ({validRows.length} rows vs {remainingSlots} slots)
                    </span>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto custom-scrollbar border border-[var(--card-border)] rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-50 dark:bg-surface-800/50 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1.5 font-semibold text-muted w-10">#</th>
                        <th className="text-left px-2 py-1.5 font-semibold text-muted">Name</th>
                        <th className="text-left px-2 py-1.5 font-semibold text-muted w-20">
                          Gender
                        </th>
                        <th className="text-left px-2 py-1.5 font-semibold text-muted">Events</th>
                        <th className="text-left px-2 py-1.5 font-semibold text-muted">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.map((r) => (
                        <tr
                          key={r.rowNumber}
                          className={`border-t border-[var(--card-border)] ${
                            r.errors.length > 0 ? "bg-red-500/5" : ""
                          }`}
                        >
                          <td className="px-2 py-1.5 text-muted font-mono tabular-nums">
                            {r.rowNumber}
                          </td>
                          <td className="px-2 py-1.5">
                            {r.firstName} {r.lastName}
                          </td>
                          <td className="px-2 py-1.5">{r.gender ?? "—"}</td>
                          <td className="px-2 py-1.5">{r.events.join(", ") || "—"}</td>
                          <td className="px-2 py-1.5">
                            {r.errors.length > 0 ? (
                              <span className="text-danger-600 dark:text-danger-400">
                                {r.errors.join("; ")}
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
