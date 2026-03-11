"use client";

interface PhaseStats {
  phase: string;
  phaseOrder: number;
  durationWeeks: number;
  totalThrows: number;
  avgMark: number;
  avgRpe: number;
  effectivenessScore: number;
  exercises: string[];
  status: string;
}

interface PhaseComparisonPanelProps {
  phases: PhaseStats[];
}

const PHASE_LABELS: Record<string, string> = {
  ACCUMULATION: "Accumulation",
  TRANSMUTATION: "Transmutation",
  REALIZATION: "Realization",
  COMPETITION: "Competition",
};

const PHASE_COLORS: Record<string, string> = {
  ACCUMULATION: "border-l-blue-500",
  TRANSMUTATION: "border-l-amber-500",
  REALIZATION: "border-l-emerald-500",
  COMPETITION: "border-l-red-500",
};

function DiffArrow({ current, previous }: { current: number; previous: number }) {
  if (!previous || current === previous) return null;
  const improved = current > previous;
  return (
    <span className={`text-[10px] font-medium ${improved ? "text-emerald-500" : "text-red-400"}`}>
      {improved ? "+" : ""}{(current - previous).toFixed(1)}
    </span>
  );
}

export default function PhaseComparisonPanel({
  phases,
}: PhaseComparisonPanelProps) {
  if (phases.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted">No completed phases to compare yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {phases.map((p, i) => {
        const prev = i > 0 ? phases[i - 1] : null;
        return (
          <div
            key={p.phaseOrder}
            className={`card p-4 border-l-4 ${PHASE_COLORS[p.phase] ?? ""}`}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-[var(--foreground)]">
                {PHASE_LABELS[p.phase] ?? p.phase}
              </h4>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                p.status === "COMPLETED"
                  ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                  : p.status === "ACTIVE"
                  ? "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                  : "bg-[var(--muted-bg)] text-muted"
              }`}>
                {p.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wide">Throws</p>
                <p className="text-sm font-bold text-[var(--foreground)] tabular-nums">
                  {p.totalThrows}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wide">Weeks</p>
                <p className="text-sm font-bold text-[var(--foreground)] tabular-nums">
                  {p.durationWeeks}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wide">Avg Mark</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-[var(--foreground)] tabular-nums">
                    {p.avgMark > 0 ? `${p.avgMark.toFixed(2)}m` : "—"}
                  </p>
                  {prev && p.avgMark > 0 && prev.avgMark > 0 && (
                    <DiffArrow current={p.avgMark} previous={prev.avgMark} />
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wide">Avg RPE</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-[var(--foreground)] tabular-nums">
                    {p.avgRpe > 0 ? p.avgRpe.toFixed(1) : "—"}
                  </p>
                  {prev && p.avgRpe > 0 && prev.avgRpe > 0 && (
                    <DiffArrow current={p.avgRpe} previous={prev.avgRpe} />
                  )}
                </div>
              </div>
            </div>

            {p.exercises.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-[var(--card-border)]">
                <p className="text-[10px] text-muted uppercase tracking-wide mb-1.5">Exercises</p>
                <div className="flex flex-wrap gap-1">
                  {p.exercises.slice(0, 5).map((ex) => (
                    <span
                      key={ex}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--muted-bg)] text-muted"
                    >
                      {ex}
                    </span>
                  ))}
                  {p.exercises.length > 5 && (
                    <span className="text-[10px] text-muted">
                      +{p.exercises.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
