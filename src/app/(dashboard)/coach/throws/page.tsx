import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import { StatCard } from "@/components/ui/StatCard";
import {
  requireCoachSession,
  getTeamThrowSummary,
  getTeamPRLeaderboard,
} from "@/lib/data/coach";
import { PRLeaderboard } from "./_pr-leaderboard";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const EVENT_TABS = ["ALL", "SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"] as const;
type EventFilter = (typeof EVENT_TABS)[number];

/* ─── Athlete Card ───────────────────────────────────────────────────────── */

type AthleteCardData = {
  athleteId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  events: string[];
  totalThrows: number;
  latestPR: { event: string; distance: number; date: string; implementWeight: number } | null;
  recentThrowCount: number;
  bondarchukType: string | null;
};

const BONDARCHUK_COLORS: Record<string, string> = {
  EXPLOSIVE: "warning",
  SPEED_STRENGTH: "primary",
  STRENGTH_SPEED: "success",
  STRENGTH: "danger",
};

function AthleteThrowCard({ a }: { a: AthleteCardData }) {
  return (
    <Link
      href={`/coach/athletes/${a.athleteId}`}
      className="card p-4 hover:shadow-md transition-shadow block"
    >
      <div className="flex items-start gap-3">
        <Avatar
          name={`${a.firstName} ${a.lastName}`}
          src={a.avatarUrl}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[var(--foreground)]">
              {a.firstName} {a.lastName}
            </span>
            {a.bondarchukType && (
              <Badge
                variant={
                  (BONDARCHUK_COLORS[a.bondarchukType] as "warning" | "primary" | "success" | "danger") ?? "neutral"
                }
              >
                {a.bondarchukType.replace(/_/g, " ")}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-1 mt-1">
            {a.events.map((ev) => (
              <span
                key={ev}
                className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-muted"
              >
                {formatEventName(ev)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-[var(--card-border)]">
        <div>
          <p className="text-lg font-bold tabular-nums font-heading text-[var(--foreground)]">
            {a.totalThrows}
          </p>
          <p className="text-[10px] text-muted uppercase">Total</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums font-heading text-[var(--foreground)]">
            {a.recentThrowCount}
          </p>
          <p className="text-[10px] text-muted uppercase">This Week</p>
        </div>
        <div>
          {a.latestPR ? (
            <>
              <p className="text-lg font-bold tabular-nums font-heading text-primary-500">
                {a.latestPR.distance.toFixed(2)}m
              </p>
              <p className="text-[10px] text-muted uppercase">
                PR · {formatEventName(a.latestPR.event)}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold tabular-nums font-heading text-muted">—</p>
              <p className="text-[10px] text-muted uppercase">No PR</p>
            </>
          )}
        </div>
      </div>

      {/* Assessment link */}
      <div className="mt-3 pt-3 border-t border-[var(--card-border)]">
        <Link
          href={`/coach/throws/assessment/${a.athleteId}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors inline-flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          Run Assessment
        </Link>
      </div>
    </Link>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function CoachThrowsPage({
  searchParams,
}: {
  searchParams: { event?: string };
}) {
  const { coach } = await requireCoachSession();

  const activeFilter = (searchParams.event?.toUpperCase() ?? "ALL") as EventFilter;
  const eventParam = activeFilter !== "ALL" ? activeFilter : undefined;

  const [teamSummary, leaderboard] = await Promise.all([
    getTeamThrowSummary(coach.id),
    getTeamPRLeaderboard(coach.id, eventParam),
  ]);

  // Compute team stats
  const totalThrowsThisWeek = teamSummary.reduce((s, a) => s + a.recentThrowCount, 0);
  const prsThisMonth = leaderboard.filter((pr) => {
    const prDate = new Date(pr.date);
    const now = new Date();
    return (
      prDate.getMonth() === now.getMonth() && prDate.getFullYear() === now.getFullYear()
    );
  }).length;
  const mostActive = [...teamSummary].sort(
    (a, b) => b.recentThrowCount - a.recentThrowCount
  )[0];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Throws Dashboard
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Team throw performance and PR tracking
          </p>
        </div>
        <Link
          href="/coach/throws/programming"
          className="btn btn-primary text-sm shrink-0"
        >
          Exercise Programming
        </Link>
      </div>

      {/* Event filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {EVENT_TABS.map((tab) => (
          <Link
            key={tab}
            href={
              tab === "ALL"
                ? "/coach/throws"
                : `/coach/throws?event=${tab.toLowerCase()}`
            }
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              activeFilter === tab
                ? "bg-primary-500 text-white"
                : "bg-surface-100 dark:bg-surface-800 text-muted hover:text-[var(--foreground)]"
            )}
          >
            {tab === "ALL" ? "All Events" : formatEventName(tab)}
          </Link>
        ))}
      </div>

      {/* Team stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Throws This Week"
          value={totalThrowsThisWeek}
          accent="primary"
          note={`${teamSummary.length} athletes`}
        />
        <StatCard
          label="PRs This Month"
          value={prsThisMonth}
          accent="success"
          note={eventParam ? formatEventName(eventParam) : "All events"}
        />
        <StatCard
          label="Most Active"
          value={
            mostActive
              ? `${mostActive.firstName} ${mostActive.lastName.charAt(0)}.`
              : "—"
          }
          accent="warning"
          note={
            mostActive
              ? `${mostActive.recentThrowCount} throws this week`
              : "No activity"
          }
        />
      </div>

      {/* PR Leaderboard */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
          PR Leaderboard
          {eventParam && (
            <span className="ml-2 normal-case font-normal">
              — {formatEventName(eventParam)}
            </span>
          )}
        </h2>
        <PRLeaderboard data={leaderboard} />
      </section>

      {/* Athlete Cards Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Athletes ({teamSummary.length})
          </h2>
        </div>

        {teamSummary.length === 0 ? (
          <div className="card">
            <p className="text-sm text-muted py-8 text-center">
              No athletes on your roster yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamSummary.map((a) => (
              <AthleteThrowCard key={a.athleteId} a={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
