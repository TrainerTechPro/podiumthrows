"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const PERIODS = [30, 60, 90] as const;

export function AnalyticsPeriodSelector({ period }: { period: number }) {
  const router = useRouter();

  function setPeriod(days: number) {
    document.cookie = `dashboard-analytics-period=${days};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <div className="inline-flex rounded-lg bg-surface-100 dark:bg-surface-800 p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => setPeriod(p)}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-medium transition-colors tabular-nums",
            period === p
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
              : "text-muted hover:text-[var(--foreground)]"
          )}
        >
          {p}d
        </button>
      ))}
    </div>
  );
}
