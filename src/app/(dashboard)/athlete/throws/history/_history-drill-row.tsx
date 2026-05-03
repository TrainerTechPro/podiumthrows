"use client";

import { useState } from "react";
import type { HistoryDrill, HistoryThrow } from "@/lib/throws/history-types";
import { EditThrowSheet, type EditableThrow } from "@/components/throws/EditThrowSheet";
import { HistoryDrillThrowsSheet } from "./_history-drill-throws-sheet";
import { useUnitPref } from "@/lib/units/provider";

interface Props {
  drill: HistoryDrill;
  athleteId: string;
  onDataChanged: () => void;
}

function toEditable(t: HistoryThrow, athleteId: string): EditableThrow {
  return {
    id: t.id,
    athleteId,
    implementId: t.implementId,
    implementDisplayLabel: t.implementDisplayLabel,
    distance: t.distance,
    date: t.performedAt,
    isCompetition: t.isCompetition,
    isFoul: t.isFoul,
    notes: t.notes,
  };
}

export function HistoryDrillRow({ drill, athleteId, onDataChanged }: Props) {
  const [listOpen, setListOpen] = useState(false);
  const [editing, setEditing] = useState<HistoryThrow | null>(null);
  const { format: formatDist } = useUnitPref("distance");

  const label = drill.drillTypeLabel
    ? `${drill.drillTypeLabel} · ${drill.implementLabel}`
    : `Free log · ${drill.implementLabel}`;
  const best = drill.bestMark != null ? formatDist(drill.bestMark) : "—";

  const bestThrow =
    drill.bestThrowLogId != null
      ? (drill.throws.find((t) => t.id === drill.bestThrowLogId) ?? null)
      : null;
  const showAllLink = drill.throws.length > 1;

  const handleSavedOrDeleted = () => {
    setEditing(null);
    setListOpen(false);
    onDataChanged();
  };

  return (
    <>
      <div
        className={`flex flex-col py-1.5 text-sm ${
          drill.isPersonalBest
            ? "text-[var(--foreground)]"
            : "text-surface-700 dark:text-surface-300"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="truncate">{label}</span>
          <span className="font-mono tabular-nums font-semibold flex items-center gap-1">
            <span>{drill.throwCount} · </span>
            {bestThrow ? (
              <button
                type="button"
                onClick={() => setEditing(bestThrow)}
                aria-label="Edit best throw"
                className="hover:underline focus-visible:underline focus-visible:outline-none active:scale-[0.97] motion-reduce:active:scale-100 transition-transform"
              >
                {best}
                {drill.isPersonalBest && (
                  <span className="text-primary-500 ml-1" aria-label="Personal best">
                    ★
                  </span>
                )}
              </button>
            ) : (
              <span>
                {best}
                {drill.isPersonalBest && (
                  <span className="text-primary-500 ml-1" aria-label="Personal best">
                    ★
                  </span>
                )}
              </span>
            )}
          </span>
        </div>
        {showAllLink && (
          <button
            type="button"
            onClick={() => setListOpen(true)}
            aria-label={`all ${drill.throws.length} throws`}
            className="self-end mt-0.5 text-xs text-muted hover:text-primary-500 focus-visible:text-primary-500 focus-visible:outline-none transition-colors"
          >
            all {drill.throws.length} throws ›
          </button>
        )}
      </div>

      <HistoryDrillThrowsSheet
        open={listOpen}
        onClose={() => setListOpen(false)}
        drillTypeLabel={drill.drillTypeLabel}
        implementLabel={drill.implementLabel}
        bestThrowLogId={drill.bestThrowLogId}
        throws={drill.throws}
        onPickThrow={(t) => setEditing(t)}
      />

      {editing && (
        <EditThrowSheet
          open={editing != null}
          onClose={() => setEditing(null)}
          side="bottom"
          initial={toEditable(editing, athleteId)}
          onSaved={handleSavedOrDeleted}
          onDeleted={handleSavedOrDeleted}
        />
      )}
    </>
  );
}
