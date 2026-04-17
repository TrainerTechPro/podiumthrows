"use client";
import { useMemo, useState, useRef, useEffect } from "react";
import { parseDistance } from "@/lib/competitions/parseDistance";

export type CompThrowRow = {
  id: string;
  round: "PRELIM" | "FINALS";
  attemptInRound: number;
  distance: number | null;
  isFoul: boolean;
  isPass: boolean;
  foulType: "RING" | "SECTOR" | null;
  notes: string | null;
  videoUrl: string | null;
  wireLength: string | null;
};

export type CompMeet = {
  id: string;
  athleteId: string;
  event: string;
  format: "THREE_PLUS_THREE" | "FOUR_STRAIGHT";
  madeFinals: boolean | null;
  result: number | null;
  name: string;
};

export type ThrowSaveInput = Omit<CompThrowRow, "id"> & { id?: string };

type Props = {
  meet: CompMeet;
  throws: CompThrowRow[];
  onSave: (input: ThrowSaveInput) => Promise<void>;
  onDelete: (throwLogId: string) => Promise<void>;
  onPromoteLegacy?: () => Promise<void>;
};

type Slot = { round: "PRELIM" | "FINALS"; attemptInRound: number };

function slotsFor(
  format: CompMeet["format"],
  madeFinals: boolean | null
): Slot[] {
  if (format === "FOUR_STRAIGHT") {
    return [1, 2, 3, 4].map((n) => ({ round: "PRELIM" as const, attemptInRound: n }));
  }
  const prelims: Slot[] = [1, 2, 3].map((n) => ({ round: "PRELIM" as const, attemptInRound: n }));
  if (madeFinals) {
    return [
      ...prelims,
      ...[1, 2, 3].map((n) => ({ round: "FINALS" as const, attemptInRound: n })),
    ];
  }
  return prelims;
}

/** Format a distance without trailing zeros: 17.50 → "17.5", 18.00 → "18" */
function formatDistanceShort(n: number): string {
  return parseFloat(n.toFixed(2)).toString();
}

type RowResultType = "MARK" | "FOUL" | "PASS" | null;
type SaveState = "idle" | "saving" | "saved" | "error";

function SaveStatusDot({ state }: { state: SaveState }) {
  const color =
    state === "saving"
      ? "bg-primary-500 animate-pulse"
      : state === "saved"
        ? "bg-success-500"
        : state === "error"
          ? "bg-danger-500"
          : "bg-transparent";
  return <span className={`h-2 w-2 rounded-full ${color}`} aria-label={`save ${state}`} />;
}

function ThrowRow({
  slot,
  meet: _meet,
  existing,
  onSave,
  onDelete,
}: {
  slot: Slot;
  meet: CompMeet;
  existing: CompThrowRow | null;
  onSave: (input: ThrowSaveInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [resultType, setResultType] = useState<RowResultType>(() => {
    if (!existing) return null;
    if (existing.isFoul) return "FOUL";
    if (existing.isPass) return "PASS";
    return "MARK";
  });
  const [distanceInput, setDistanceInput] = useState<string>(
    existing?.distance != null ? existing.distance.toFixed(2) : ""
  );
  const [foulType, setFoulType] = useState<"RING" | "SECTOR" | null>(
    existing?.foulType ?? null
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const commit = async () => {
    if (resultType == null) return;

    let distance: number | null = null;
    if (resultType === "MARK") {
      const parsed = parseDistance(distanceInput);
      if (!parsed) return;
      distance = parsed.meters;
    }
    if (resultType === "FOUL" && !foulType) return;

    setSaveState("saving");
    try {
      await onSave({
        id: existing?.id,
        round: slot.round,
        attemptInRound: slot.attemptInRound,
        distance,
        isFoul: resultType === "FOUL",
        isPass: resultType === "PASS",
        foulType: resultType === "FOUL" ? foulType : null,
        notes: existing?.notes ?? null,
        videoUrl: existing?.videoUrl ?? null,
        wireLength: existing?.wireLength ?? null,
      });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const handleRowBlur: React.FocusEventHandler<HTMLDivElement> = (e) => {
    // Only save if focus truly left the row
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void commit();
      }, 500);
    }
  };

  return (
    <div
      data-testid={`throw-row-${slot.round}-${slot.attemptInRound}`}
      className="flex flex-wrap items-center gap-2 rounded border border-[var(--card-border)] p-2 sm:flex-nowrap"
      onBlur={handleRowBlur}
    >
      <span className="w-8 text-sm text-muted">{slot.attemptInRound}</span>

      <div role="radiogroup" className="flex gap-1">
        {(["MARK", "FOUL", "PASS"] as const).map((t) => (
          <button
            key={t}
            type="button"
            data-type={t}
            onClick={() => {
              setResultType(t);
              if (t !== "MARK") setDistanceInput("");
              if (t !== "FOUL") setFoulType(null);
            }}
            className={`rounded px-2 py-1 text-xs ${
              resultType === t ? "bg-primary-500 text-black" : "bg-surface-800 text-muted"
            }`}
          >
            {t === "MARK" ? "Mark" : t === "FOUL" ? "Foul" : "Pass"}
          </button>
        ))}
      </div>

      {resultType === "MARK" && (
        <input
          data-testid="distance-input"
          value={distanceInput}
          onChange={(e) => setDistanceInput(e.target.value)}
          placeholder={`18.42 or 60'4"`}
          className="w-32 rounded bg-surface-800 px-2 py-1 font-mono text-sm tabular-nums"
        />
      )}

      {resultType === "FOUL" && (
        <div data-testid="foul-type-picker" className="flex gap-1">
          {(["RING", "SECTOR"] as const).map((ft) => (
            <button
              key={ft}
              type="button"
              onClick={() => setFoulType(ft)}
              className={`rounded px-2 py-1 text-xs ${
                foulType === ft ? "bg-danger-500 text-black" : "bg-surface-800 text-muted"
              }`}
            >
              {ft.toLowerCase()}
            </button>
          ))}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <SaveStatusDot state={saveState} />
        {existing && (
          <button
            type="button"
            onClick={() => onDelete(existing.id)}
            className="text-xs text-muted hover:text-danger-500"
            aria-label="Delete throw"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export function CompetitionThrowsTable({
  meet,
  throws,
  onSave,
  onDelete,
  onPromoteLegacy,
}: Props) {
  const slots = useMemo(
    () => slotsFor(meet.format, meet.madeFinals),
    [meet.format, meet.madeFinals]
  );

  const showLegacyBanner = meet.result != null && throws.length === 0;

  const findThrow = (round: "PRELIM" | "FINALS", attemptInRound: number): CompThrowRow | null =>
    throws.find((t) => t.round === round && t.attemptInRound === attemptInRound) ?? null;

  return (
    <div className="card p-4">
      {showLegacyBanner ? (
        <div
          data-testid="legacy-banner"
          className="mb-4 rounded border border-warning-500 bg-warning-500/10 p-3 text-sm"
        >
          This meet was logged before per-throw entry. Add throws below to upgrade — your existing
          result of <strong>{formatDistanceShort(meet.result!)}m</strong> will be replaced.
          {onPromoteLegacy != null ? (
            <button
              className="btn-secondary ml-2"
              onClick={onPromoteLegacy}
              data-testid="promote-legacy-btn"
            >
              Promote to Unified PR
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        {slots.map((slot) => {
          const existing = findThrow(slot.round, slot.attemptInRound);
          return (
            <ThrowRow
              key={`${slot.round}-${slot.attemptInRound}`}
              slot={slot}
              meet={meet}
              existing={existing}
              onSave={onSave}
              onDelete={onDelete}
            />
          );
        })}
      </div>
    </div>
  );
}
