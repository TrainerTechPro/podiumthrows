import Link from "next/link";
import { Target } from "lucide-react";
import { ProgressBar } from "@/components";
import type { GoalItem } from "@/lib/data/dashboard";

export function GoalsProgressWidget({ goals }: { goals: GoalItem[] }) {
  return (
    <div className="card px-4 py-4 sm:px-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Goals
        </h3>
        <Link
          href="/athlete/goals"
          className="text-xs text-primary-500 hover:underline"
        >
          View all &gt;
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8 gap-3">
          <div className="w-11 h-11 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
            <Target
              size={20}
              strokeWidth={1.75}
              className="text-surface-400 dark:text-surface-500"
              aria-hidden="true"
            />
          </div>
          <div className="max-w-[220px]">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              No active goals
            </p>
            <p className="text-xs text-muted mt-1">
              Set a goal to track your progress toward competition marks.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const pct =
              goal.targetValue > 0
                ? Math.min(100, (goal.currentValue / goal.targetValue) * 100)
                : 0;

            return (
              <div key={goal.id}>
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">
                    {goal.title}
                  </p>
                  <span className="text-xs tabular-nums text-muted shrink-0">
                    {goal.currentValue} / {goal.targetValue} {goal.unit}
                  </span>
                </div>
                <ProgressBar
                  value={pct}
                  variant={pct >= 100 ? "success" : "primary"}
                  size="sm"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
