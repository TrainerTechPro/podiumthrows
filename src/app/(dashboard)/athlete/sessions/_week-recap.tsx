import { Trophy, Target, Gauge } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import type { WeekRecap } from "@/lib/data/training-hub";

export function WeekRecapCard({ recap }: { recap: WeekRecap }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
          <Trophy size={20} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Week Complete
          </h3>
          <p className="text-xs text-muted">
            You completed{" "}
            <span className="font-semibold text-primary-500">
              <AnimatedNumber value={recap.completed} decimals={0} />/{recap.total}
            </span>{" "}
            sessions this week
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {recap.totalThrows > 0 && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted mb-1">
              <Target size={12} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Throws</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
              <AnimatedNumber value={recap.totalThrows} decimals={0} />
            </p>
          </div>
        )}

        {recap.avgRpe != null && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted mb-1">
              <Gauge size={12} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Avg RPE</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
              <AnimatedNumber value={recap.avgRpe} decimals={1} />
            </p>
          </div>
        )}

        {recap.prsHit > 0 && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
              <Trophy size={12} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">PRs</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-amber-500">
              <AnimatedNumber value={recap.prsHit} decimals={0} />
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
