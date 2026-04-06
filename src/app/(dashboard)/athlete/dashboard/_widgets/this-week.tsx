import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import { AnimatedNumber } from "@/components";
import type { ThisWeekData } from "@/lib/data/dashboard-progress";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatDelta(
  delta: number | null,
  decimals: number,
  unit: string
): { text: string; direction: "up" | "down" | "flat" | "unknown" } {
  if (delta == null) {
    return { text: "—", direction: "unknown" };
  }
  if (delta === 0) {
    return { text: `0${unit}`, direction: "flat" };
  }
  const prefix = delta > 0 ? "+" : "";
  return {
    text: `${prefix}${delta.toFixed(decimals)}${unit}`,
    direction: delta > 0 ? "up" : "down",
  };
}

/* ─── Stat tile ──────────────────────────────────────────────────────────── */

function StatTile({
  label,
  value,
  decimals,
  suffix,
  delta,
  deltaDecimals,
  deltaUnit,
}: {
  label: string;
  value: number | null;
  decimals: number;
  suffix?: string;
  delta: number | null;
  deltaDecimals: number;
  deltaUnit: string;
}) {
  const d = formatDelta(delta, deltaDecimals, deltaUnit);
  const Icon =
    d.direction === "up"
      ? TrendingUp
      : d.direction === "down"
        ? TrendingDown
        : Minus;
  const colorClass =
    d.direction === "up"
      ? "text-emerald-500"
      : d.direction === "down"
        ? "text-red-500"
        : "text-muted";

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold font-heading tabular-nums text-[var(--foreground)]">
        {value == null ? (
          <span className="text-muted">—</span>
        ) : (
          <>
            <AnimatedNumber value={value} decimals={decimals} />
            {suffix && (
              <span className="text-sm font-normal text-muted">{suffix}</span>
            )}
          </>
        )}
      </p>
      <p
        className={`mt-0.5 text-xs font-medium font-mono tabular-nums flex items-center gap-1 ${colorClass}`}
      >
        <Icon className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
        {d.text}
      </p>
    </div>
  );
}

/* ─── Widget ─────────────────────────────────────────────────────────────── */

export function ThisWeekWidget({ data }: { data: ThisWeekData }) {
  return (
    <div className="card px-4 py-4 shadow-sm md:hover:shadow-md md:transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          This Week
        </h3>
        <span className="text-[10px] text-muted font-mono uppercase tracking-wider">
          vs last
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile
          label="Throws"
          value={data.thisWeek.totalThrows}
          decimals={0}
          delta={data.deltas.throws}
          deltaDecimals={0}
          deltaUnit=""
        />
        <StatTile
          label="Days"
          value={data.thisWeek.daysTrained}
          decimals={0}
          delta={data.deltas.daysTrained}
          deltaDecimals={0}
          deltaUnit=""
        />
        <StatTile
          label="Best"
          value={data.thisWeek.bestDistance}
          decimals={2}
          suffix="m"
          delta={data.deltas.bestDistance}
          deltaDecimals={2}
          deltaUnit="m"
        />
        <StatTile
          label="Implements"
          value={data.thisWeek.implementsUsed}
          decimals={0}
          delta={data.deltas.implementsUsed}
          deltaDecimals={0}
          deltaUnit=""
        />
      </div>
    </div>
  );
}
