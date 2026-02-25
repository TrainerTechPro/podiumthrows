"use client";

import { useState } from "react";
import { Badge } from "@/components";
import { Modal } from "@/components/ui/Modal";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type AssessmentHistoryItem = {
  id: string;
  athleteType: string;
  results: Record<string, { exerciseName: string; category: string; correlation: number }>;
  notes: string | null;
  completedAt: string;
};

const TYPE_COLORS: Record<string, string> = {
  EXPLOSIVE: "warning",
  SPEED_STRENGTH: "primary",
  STRENGTH_SPEED: "success",
  STRENGTH: "danger",
};

/* ─── Component ──────────────────────────────────────────────────────────── */

export function AssessmentHistory({
  assessments,
}: {
  assessments: AssessmentHistoryItem[];
}) {
  const [viewId, setViewId] = useState<string | null>(null);

  const viewing = assessments.find((a) => a.id === viewId);

  if (assessments.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-muted py-6 text-center">
          No assessments yet. Run the first assessment above.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card divide-y divide-[var(--card-border)]">
        {assessments.map((a) => {
          const resultsObj = a.results as Record<string, { exerciseName: string; category: string; correlation: number }> | null;
          const exerciseCount = resultsObj ? Object.keys(resultsObj).length : 0;

          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setViewId(a.id)}
              className="w-full text-left px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      (TYPE_COLORS[a.athleteType] as "warning" | "primary" | "success" | "danger") ?? "neutral"
                    }
                  >
                    {a.athleteType.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs text-muted">
                    {exerciseCount} exercises
                  </span>
                </div>
                <span className="text-xs text-muted">
                  {new Date(a.completedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              {a.notes && (
                <p className="text-xs text-muted mt-1 truncate">{a.notes}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail Modal */}
      <Modal
        open={!!viewing}
        onClose={() => setViewId(null)}
        title="Assessment Detail"
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge
                variant={
                  (TYPE_COLORS[viewing.athleteType] as "warning" | "primary" | "success" | "danger") ?? "neutral"
                }
              >
                {viewing.athleteType.replace(/_/g, " ")}
              </Badge>
              <span className="text-xs text-muted">
                {new Date(viewing.completedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            {/* Correlation results */}
            {viewing.results && (
              <div>
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                  Exercise Correlations
                </h4>
                <div className="space-y-2">
                  {Object.entries(
                    viewing.results as Record<string, { exerciseName: string; category: string; correlation: number }>
                  ).map(([id, ex]) => (
                    <div key={id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--foreground)]">{ex.exerciseName}</span>
                        <span className="text-[10px] text-muted">{ex.category}</span>
                      </div>
                      <span
                        className={[
                          "font-bold tabular-nums",
                          ex.correlation >= 0.7
                            ? "text-green-500"
                            : ex.correlation >= 0.4
                            ? "text-amber-500"
                            : "text-red-500",
                        ].join(" ")}
                      >
                        {ex.correlation.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewing.notes && (
              <div>
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                  Notes
                </h4>
                <p className="text-sm text-[var(--foreground)]">{viewing.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
