import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { ProgressBar, StaggeredList } from "@/components";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import type { OnboardingItem } from "@/lib/data/training-hub";

interface OnboardingChecklistProps {
  items: OnboardingItem[];
  coachName: string;
  coachAvatarUrl: string | null;
}

export function OnboardingChecklist({
  items,
  coachName,
  coachAvatarUrl,
}: OnboardingChecklistProps) {
  const completedCount = items.filter((i) => i.completed).length;
  const progress = Math.round((completedCount / items.length) * 100);

  return (
    <div className="space-y-4">
      {/* Coach connection */}
      <div className="card p-4 flex items-center gap-3">
        <Avatar src={coachAvatarUrl} name={coachName} size="md" />
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">Connected to {coachName}</p>
          <p className="text-xs text-muted">
            Complete these steps to help your coach build your program
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {completedCount < items.length && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Profile Completion
            </span>
            <span className="text-xs font-bold tabular-nums text-primary-500">
              {completedCount}/{items.length}
            </span>
          </div>
          <ProgressBar value={progress} />
        </div>
      )}

      {/* Checklist items */}
      <StaggeredList className="space-y-2" staggerDelay={60}>
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "card card-interactive flex items-center gap-3 p-4",
              item.completed && "opacity-60"
            )}
          >
            {item.completed ? (
              <CheckCircle2
                size={20}
                strokeWidth={1.75}
                className="text-success-500 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <Circle
                size={20}
                strokeWidth={1.75}
                className="text-primary-500 shrink-0"
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "text-sm font-medium flex-1",
                item.completed ? "text-muted line-through" : "text-[var(--foreground)]"
              )}
            >
              {item.label}
            </span>
            {!item.completed && (
              <ChevronRight
                size={16}
                strokeWidth={1.75}
                className="text-muted shrink-0"
                aria-hidden="true"
              />
            )}
          </Link>
        ))}
      </StaggeredList>
    </div>
  );
}
