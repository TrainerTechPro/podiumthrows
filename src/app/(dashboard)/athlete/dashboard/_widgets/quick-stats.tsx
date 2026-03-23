import { AnimatedNumber } from "@/components";
import type { QuickStatsData } from "@/lib/data/dashboard";

export function QuickStatsWidget({ data }: { data: QuickStatsData }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="card px-4 py-3.5 text-center">
        <p className="text-2xl font-bold tabular-nums font-heading text-[var(--foreground)]">
          <AnimatedNumber value={data.sessionsThisWeek} decimals={0} />
        </p>
        <p className="text-[11px] text-muted mt-0.5">This Week</p>
      </div>

      <div className="card px-4 py-3.5 text-center">
        <p className="text-2xl font-bold tabular-nums font-heading text-primary-500">
          <AnimatedNumber value={data.currentStreak} decimals={0} />
        </p>
        <p className="text-[11px] text-muted mt-0.5">Day Streak</p>
      </div>

      <div className="card px-4 py-3.5 text-center">
        <p className="text-2xl font-bold tabular-nums font-heading text-[var(--foreground)]">
          <AnimatedNumber value={data.totalSessions} decimals={0} />
        </p>
        <p className="text-[11px] text-muted mt-0.5">Total Sessions</p>
      </div>
    </div>
  );
}
