"use client";
import { useMemo } from "react";

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
function formatDistance(n: number): string {
  return parseFloat(n.toFixed(2)).toString();
}

function formatExisting(t: CompThrowRow): string {
  if (t.isFoul) return `Foul (${t.foulType?.toLowerCase() ?? "unknown"})`;
  if (t.isPass) return "Pass";
  if (t.distance != null) return `${formatDistance(t.distance)}m`;
  return "—";
}

// Placeholder row — replaced with interactive controls in Task 16.
// Defined outside CompetitionThrowsTable to satisfy rerender-no-inline-components.
function ThrowRow({
  slot,
  existing,
}: {
  slot: Slot;
  meet: CompMeet;
  existing: CompThrowRow | null;
  onSave: (input: ThrowSaveInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div
      data-testid={`throw-row-${slot.round}-${slot.attemptInRound}`}
      className="flex items-center gap-2 rounded border border-[var(--card-border)] p-2"
    >
      <span className="w-8 text-sm text-muted">{slot.attemptInRound}</span>
      <span className="text-sm">{existing ? formatExisting(existing) : "(empty)"}</span>
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
          result of <strong>{formatDistance(meet.result!)}m</strong> will be replaced.
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
