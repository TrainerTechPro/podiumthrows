import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { CalendarClock, CheckCircle2, Trophy, Heart, MessageSquare } from "lucide-react";
import type { ThisWeekSummary } from "@/lib/data/dashboard-intel";

/* ─── This Week — the coach's weekly decision surface ─────────────────────
   Five tiles, one row on desktop, two rows on mobile. Each shows a count
   and a label. When a count is > 0 the entire tile is a Link to a
   filtered surface; when it's 0 the tile renders muted and is not
   interactive (no false-positive clicks into empty rosters).

   The whole component is intentionally tiny — the visual loudness is the
   number itself, not chrome. Follow the editorial register of the rest
   of the coach dashboard: hairlines, no animated counters, color used
   only when the tile carries a signal worth surfacing.
   ─────────────────────────────────────────────────────────────────────── */

type Tone = "neutral" | "brand" | "warning" | "danger" | "success";

interface Tile {
  label: string;
  count: number;
  href: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: Tone;
  hint: string;
}

const TONE_STYLES: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: "var(--color-text-primary)", bg: "transparent" },
  brand: { fg: "var(--color-brand-strong)", bg: "var(--color-brand-subtle)" },
  warning: { fg: "var(--color-status-warning-fg)", bg: "var(--color-status-warning-bg)" },
  danger: { fg: "var(--color-status-danger-fg)", bg: "var(--color-status-danger-bg)" },
  success: { fg: "var(--color-status-success-fg)", bg: "var(--color-status-success-bg)" },
};

export function ThisWeek({ summary }: { summary: ThisWeekSummary }) {
  const tiles: Tile[] = [
    {
      label: "Not started",
      count: summary.notStarted,
      href: "/coach/calendar?filter=not-started",
      Icon: CalendarClock,
      tone: summary.notStarted > 0 ? "warning" : "neutral",
      hint: "Assigned this week, no logs yet.",
    },
    {
      label: "Completed",
      count: summary.completed,
      href: "/coach/calendar?filter=completed",
      Icon: CheckCircle2,
      tone: summary.completed > 0 ? "success" : "neutral",
      hint: "Logged sessions this week.",
    },
    {
      label: "PRs this week",
      count: summary.prs,
      href: "/coach/athletes?tab=throws",
      Icon: Trophy,
      tone: summary.prs > 0 ? "brand" : "neutral",
      hint: "New bests across the roster.",
    },
    {
      label: "Missing readiness",
      count: summary.missingReadiness,
      href: "/coach/athletes?filter=missing-readiness",
      Icon: Heart,
      tone: summary.missingReadiness > 0 ? "danger" : "neutral",
      hint: "No check-in in the last 7 days.",
    },
    {
      label: "Needs review",
      count: summary.needsReview,
      href: "/coach/athletes?filter=needs-review",
      Icon: MessageSquare,
      tone: summary.needsReview > 0 ? "warning" : "neutral",
      hint: "Completed work without a coach note.",
    },
  ];

  return (
    <section aria-labelledby="this-week-heading">
      <div className="flex items-baseline justify-between gap-3 mb-4 pb-3 border-b border-[var(--color-border-default)]">
        <h2
          id="this-week-heading"
          className="font-heading text-[17px] font-semibold text-[var(--color-text-primary)] tracking-tight"
        >
          This week
        </h2>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {weekRangeLabel(summary.weekStart, summary.weekEnd)}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <TileBody tile={tile} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TileBody({ tile }: { tile: Tile }) {
  const active = tile.count > 0;
  const tone = TONE_STYLES[tile.tone];
  const inner = (
    <div
      className={`flex h-full flex-col gap-2 rounded-lg border px-4 py-3 transition-colors ${
        active
          ? "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-surface-sunken)]"
          : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] opacity-55"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md"
          style={{ backgroundColor: active ? tone.bg : "transparent" }}
        >
          <tile.Icon
            width={14}
            height={14}
            strokeWidth={1.75}
            style={{ color: active ? tone.fg : "var(--color-text-secondary)" }}
            aria-hidden="true"
          />
        </span>
        <span className="text-xs font-medium text-[var(--color-text-secondary)] truncate">
          {tile.label}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="font-heading text-2xl font-semibold tabular-nums"
          style={{ color: active ? tone.fg : "var(--color-text-secondary)" }}
        >
          {tile.count}
        </span>
        {active && (
          <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">View →</span>
        )}
      </div>
      <p className="text-[11px] leading-snug text-[var(--color-text-secondary)] opacity-80">
        {tile.hint}
      </p>
    </div>
  );

  if (!active) {
    return (
      <div
        className="block h-full"
        role="group"
        aria-label={`${tile.count} ${tile.label.toLowerCase()} — none this week`}
      >
        {inner}
      </div>
    );
  }
  return (
    <Link
      href={tile.href}
      aria-label={`${tile.count} ${tile.label.toLowerCase()} — open ${tile.label.toLowerCase()} list`}
      className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-lg"
    >
      {inner}
    </Link>
  );
}

function weekRangeLabel(startISO: string, endISO: string): string {
  const start = parseLocal(startISO);
  const end = parseLocal(endISO);
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  const startStr = fmt(start, { month: "short", day: "numeric" });
  const endStr =
    start.getUTCMonth() === end.getUTCMonth()
      ? fmt(end, { day: "numeric" })
      : fmt(end, { month: "short", day: "numeric" });
  return `${startStr} – ${endStr}`;
}

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
