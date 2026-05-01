"use client";

/**
 * Catalog-aware implement picker.
 *
 * Sheet-based — bottom on the athlete shell, right on the coach shell. Loads
 * /api/athletes/:athleteId/implements on first open, surfaces recent first,
 * then falls back to the full active catalog grouped by throw type.
 *
 * Distinct from the file-local <ImplementPicker> still embedded in the
 * legacy /athlete/throws/log surface — that one is kg-input only and gets
 * retired when the log surface migrates onto POST /api/throws.
 */

import { useEffect, useMemo, useState } from "react";
import type { ImplementType, Implement, ImplementCategory } from "@prisma/client";
import { Sheet, type SheetSide } from "@/components/ui/Sheet";
import {
  formatImplement,
  prettyThrowType,
  groupImplementsByUnit,
  type ImplementDisplay,
} from "@/lib/implements-display";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

export interface ImplementPickerProps {
  open: boolean;
  onClose: () => void;
  /** Required. Drives recent-list fetch. */
  athleteId: string;
  /** Athlete shell → "bottom"; coach shell → "right". Required. */
  side: SheetSide;
  /** Called with the catalog row when the user taps a tile. The picker
   *  closes itself afterwards via onClose. */
  onSelect: (impl: ImplementCatalogRow) => void;
  /** Pre-narrow the catalog to one throw type (HAMMER/SHOT/DISCUS/JAVELIN). */
  throwType?: ImplementType;
  /** Optional id of the currently selected implement (for the highlight ring). */
  selectedId?: string | null;
  /** Override the sheet title. Default: "Choose implement". */
  title?: string;
}

export interface ImplementCatalogRow extends ImplementDisplay {
  categories: ImplementCategory[];
}

interface PayloadOk {
  success: true;
  data: {
    recent: Implement[];
    all: Array<Implement & { categoryTags: { category: ImplementCategory }[] }>;
  };
}
interface PayloadErr {
  success: false;
  error: string;
}
type Payload = PayloadOk | PayloadErr;

/** Convert API row → display row + categories array. */
function toRow(
  i: Implement & { categoryTags?: { category: ImplementCategory }[] }
): ImplementCatalogRow {
  return {
    id: i.id,
    throwType: i.throwType,
    weightKg: i.weightKg,
    weightLb: i.weightLb,
    primaryUnit: i.primaryUnit,
    displayLabel: i.displayLabel,
    shortLabel: i.shortLabel,
    active: i.active,
    sortOrder: i.sortOrder,
    categories: i.categoryTags?.map((t) => t.category) ?? [],
  };
}

const THROW_TYPE_ORDER: ImplementType[] = ["HAMMER", "SHOT", "DISCUS", "JAVELIN"];

export function ImplementPicker({
  open,
  onClose,
  athleteId,
  side,
  onSelect,
  throwType,
  selectedId,
  title = "Choose implement",
}: ImplementPickerProps) {
  const [recent, setRecent] = useState<ImplementCatalogRow[]>([]);
  const [all, setAll] = useState<ImplementCatalogRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (status === "ready" || status === "loading") return;

    let cancelled = false;
    setStatus("loading");
    setErrorMsg(null);

    fetch(`/api/athletes/${athleteId}/implements`, { credentials: "same-origin" })
      .then(async (res) => {
        const payload = (await res.json()) as Payload;
        if (cancelled) return;
        if (!res.ok || !payload.success) {
          const msg = payload.success ? "Request failed" : payload.error;
          setErrorMsg(msg);
          setStatus("error");
          return;
        }
        setRecent(payload.data.recent.map(toRow));
        setAll(payload.data.all.map(toRow));
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error("ImplementPicker fetch failed", {
          context: "components/throws/ImplementPicker",
          error: err,
        });
        setErrorMsg(err instanceof Error ? err.message : "Network error — please try again");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // status is intentionally excluded — we trigger only on open changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, athleteId]);

  const filteredRecent = useMemo(
    () => (throwType ? recent.filter((r) => r.throwType === throwType) : recent),
    [recent, throwType]
  );
  const filteredAll = useMemo(
    () => (throwType ? all.filter((a) => a.throwType === throwType) : all),
    [all, throwType]
  );

  // Group "all" by throwType, preserving the catalog's defined order.
  const byThrowType = useMemo(() => {
    const groups = new Map<ImplementType, ImplementCatalogRow[]>();
    for (const row of filteredAll) {
      const list = groups.get(row.throwType) ?? [];
      list.push(row);
      groups.set(row.throwType, list);
    }
    return THROW_TYPE_ORDER.filter((t) => groups.has(t)).map((t) => ({
      throwType: t,
      rows: groups.get(t)!,
    }));
  }, [filteredAll]);

  const handleSelect = (row: ImplementCatalogRow) => {
    onSelect(row);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side={side}
      size={side === "bottom" ? "lg" : "md"}
      title={title}
      ariaLabel="Choose implement"
    >
      <div className="flex flex-col gap-6">
        {status === "loading" && (
          <div className="flex flex-col gap-2" aria-live="polite">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-10 w-full rounded-lg bg-surface-200/60 dark:bg-surface-800/60 shimmer"
              />
            ))}
          </div>
        )}

        {status === "error" && errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/40 bg-danger-500/5 px-4 py-3 text-sm text-danger-600 dark:text-danger-400"
          >
            {errorMsg}
          </div>
        )}

        {status === "ready" && filteredRecent.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Recent
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {filteredRecent.map((impl) => (
                <ImplementTile
                  key={impl.id}
                  impl={impl}
                  selected={impl.id === selectedId}
                  onClick={() => handleSelect(impl)}
                  showType
                />
              ))}
            </div>
          </section>
        )}

        {status === "ready" &&
          byThrowType.map(({ throwType: tt, rows }) => {
            const { kg, lb } = groupImplementsByUnit(rows);
            return (
              <section key={tt}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                  {prettyThrowType(tt)}
                </h3>
                <div className="space-y-3">
                  {kg.length > 0 && (
                    <UnitRow
                      label="Metric"
                      rows={kg}
                      selectedId={selectedId}
                      onSelect={handleSelect}
                    />
                  )}
                  {lb.length > 0 && (
                    <UnitRow
                      label="Imperial"
                      rows={lb}
                      selectedId={selectedId}
                      onSelect={handleSelect}
                    />
                  )}
                </div>
              </section>
            );
          })}

        {status === "ready" && filteredAll.length === 0 && (
          <p className="text-sm text-muted text-center py-8">No implements match this filter.</p>
        )}
      </div>
    </Sheet>
  );
}

/* ─── Internal pieces ───────────────────────────────────────────────────── */

interface ImplementTileProps {
  impl: ImplementCatalogRow;
  selected: boolean;
  onClick: () => void;
  showType?: boolean;
}

function ImplementTile({ impl, selected, onClick, showType }: ImplementTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-3",
        "transition-colors active:scale-[0.97] motion-reduce:active:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
        selected
          ? "border-primary-500 bg-primary-500/10"
          : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-primary-500/50"
      )}
    >
      <span className="font-mono tabular-nums text-base font-semibold text-[var(--foreground)]">
        {impl.displayLabel}
      </span>
      {showType && (
        <span className="text-[10px] uppercase tracking-wider text-muted">
          {prettyThrowType(impl.throwType)}
        </span>
      )}
    </button>
  );
}

interface UnitRowProps {
  label: string;
  rows: ImplementCatalogRow[];
  selectedId?: string | null;
  onSelect: (row: ImplementCatalogRow) => void;
}

function UnitRow({ label, rows, selectedId, onSelect }: UnitRowProps) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted mb-1.5 px-0.5">{label}</div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row)}
            aria-pressed={row.id === selectedId}
            title={formatImplement(row, { withType: true })}
            className={cn(
              "rounded-lg border px-2 py-2 text-sm font-mono tabular-nums font-medium",
              "transition-colors active:scale-[0.97] motion-reduce:active:scale-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
              row.id === selectedId
                ? "border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400"
                : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-primary-500/50 text-[var(--foreground)]"
            )}
          >
            {row.displayLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
