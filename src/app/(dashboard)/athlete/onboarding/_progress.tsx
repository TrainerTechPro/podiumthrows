"use client";

import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  total: number;
  current: number; // 0-based index into visible steps
}

/**
 * Five (or three) dots, the active one filled amber and slightly larger.
 * Sits at the top of the wizard. Quiet on purpose — the progress signal
 * is the moving cursor, not a percentage label or step text.
 */
export function OnboardingProgress({ total, current }: OnboardingProgressProps) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-3"
      role="group"
      aria-label={`Step ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const isCurrent = i === current;
        const isCompleted = i < current;
        return (
          <span
            key={i}
            className={cn(
              "h-2 rounded-full transition-all duration-300 ease-out",
              isCurrent
                ? "w-6 bg-primary-500"
                : isCompleted
                  ? "w-2 bg-primary-500/60"
                  : "w-2 bg-surface-300 dark:bg-surface-700"
            )}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}
