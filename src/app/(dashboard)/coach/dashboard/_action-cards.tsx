import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import type { CoachingAction, CoachingActionSeverity } from "@/lib/data/coaching-actions";
import type { DashboardDepth } from "./_mode-selector";

interface ActionCardsProps {
  actions: CoachingAction[];
  depth: DashboardDepth;
}

const borderColorMap: Record<CoachingActionSeverity, string> = {
  critical: "border-l-red-500",
  warning: "border-l-amber-500",
  info: "border-l-blue-500",
};

const badgeVariantMap: Record<CoachingActionSeverity, "danger" | "warning" | "info"> = {
  critical: "danger",
  warning: "warning",
  info: "info",
};

export function ActionCards({ actions, depth }: ActionCardsProps) {
  if (actions.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/20 px-5 py-4">
        <CheckCircle2
          className="h-5 w-5 text-success-600 dark:text-success-400 shrink-0"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-success-700 dark:text-success-400">
          All clear — no actions needed
        </p>
      </div>
    );
  }

  const visible = actions.slice(0, 6);
  const overflow = actions.length - 6;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        {visible.map((action) => (
          <Link
            key={action.id}
            href={action.href ?? `/coach/athletes/${action.athleteId}`}
            className={cn(
              "group flex items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 border-l-[3px] transition-colors",
              "hover:bg-surface-50 dark:hover:bg-surface-800/50",
              borderColorMap[action.severity]
            )}
          >
            <Avatar
              name={action.athleteName}
              src={action.athleteAvatar}
              size="sm"
            />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {action.athleteName}
              </p>
              <p className="text-xs text-muted truncate">{action.description}</p>

              {depth === "advanced" && action.meta && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {action.meta.acwr != null && (
                    <Badge variant={badgeVariantMap[action.severity]}>
                      ACWR {Number(action.meta.acwr).toFixed(2)}
                    </Badge>
                  )}
                  {action.meta.adaptationPhase != null && (
                    <Badge variant="neutral">
                      {String(action.meta.adaptationPhase)}
                    </Badge>
                  )}
                  {action.meta.deficitClassification != null && (
                    <Badge variant="neutral">
                      {String(action.meta.deficitClassification)}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <ChevronRight
              className="h-4 w-4 text-surface-400 group-hover:text-[var(--foreground)] shrink-0 transition-colors"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>

      {overflow > 0 && (
        <div className="text-center">
          <Link
            href="/coach/athletes"
            className="text-xs font-medium text-muted hover:text-[var(--foreground)] transition-colors"
          >
            View all {actions.length} items
          </Link>
        </div>
      )}
    </div>
  );
}
