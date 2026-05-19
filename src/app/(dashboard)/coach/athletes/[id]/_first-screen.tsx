import Link from "next/link";
import { CalendarClock, Trophy, Target, MessageSquare, ArrowRight } from "lucide-react";
import type { NextSession, LatestNote, ThrowLogItem } from "@/lib/data/coach";
import type { AthletePREvent } from "@/lib/data/personal-records";

/* ─── First Screen — the four tiles that close the decision loop ───────────
   DecisionHero already covers readiness / ACWR / injury. This card sits
   below it and answers: what's queued, what's the trend, what's been
   thrown, and what did I say last? Every tile is a deep-link into a
   section anchor on this same page (no navigation cost). When a tile
   has nothing to say, it stays present but muted so the grid rhythm
   survives — the coach learns the slot, not the content. ──────────── */

interface FirstScreenProps {
  athleteId: string;
  nextSession: NextSession;
  recentThrows: ThrowLogItem[];
  recentPRs: AthletePREvent[];
  latestNote: LatestNote;
}

function formatRelativeFuture(iso: string): string {
  const target = new Date(iso).getTime();
  const diffDays = Math.round((target - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRelativePast(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function Tile({
  href,
  icon: Icon,
  label,
  children,
}: {
  href: string;
  icon: typeof CalendarClock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition-colors hover:bg-[var(--color-bg-surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
          <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
          {label}
        </span>
        <ArrowRight
          size={12}
          strokeWidth={1.75}
          aria-hidden="true"
          className="text-muted opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
      <div className="min-w-0">{children}</div>
    </Link>
  );
}

function MutedSlot({ message }: { message: string }) {
  return <p className="text-sm text-muted leading-snug">{message}</p>;
}

export function FirstScreen({
  athleteId: _athleteId,
  nextSession,
  recentThrows,
  recentPRs,
  latestNote,
}: FirstScreenProps) {
  // The tile order matches the goal sentence: "current plan/session, PR
  // trend, recent throws, coach notes."

  // 30-day PR count from the per-event recentPRs payload (already filtered
  // and sorted server-side). The 30d window is a coach scan, not a stat.
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const prsLast30 = recentPRs.filter((pr) => {
    const date = pr.competitionPR?.date ?? pr.practiceBest?.date;
    return date ? new Date(date).getTime() >= thirtyDaysAgo : false;
  }).length;
  const lastPR = recentPRs
    .map((pr) => pr.competitionPR ?? pr.practiceBest)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  return (
    <section aria-label="At a glance" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Tile href="#training" icon={CalendarClock} label="Next session">
        {nextSession ? (
          <>
            <p className="text-sm font-semibold text-[var(--foreground)] tabular-nums">
              {formatRelativeFuture(nextSession.scheduledDate)}
            </p>
            <p className="text-xs text-muted truncate">{nextSession.title ?? "Scheduled"}</p>
          </>
        ) : (
          <MutedSlot message="None scheduled" />
        )}
      </Tile>

      <Tile href="#throws" icon={Trophy} label="PR trend">
        {prsLast30 > 0 ? (
          <>
            <p className="text-sm font-semibold text-primary-600 dark:text-primary-300 tabular-nums">
              {prsLast30} PR{prsLast30 === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-muted">in the last 30 days</p>
          </>
        ) : lastPR ? (
          <>
            <p className="text-sm font-semibold text-[var(--foreground)] tabular-nums">
              {lastPR.distance.toFixed(2)}m
            </p>
            <p className="text-xs text-muted">last PR {formatRelativePast(lastPR.date)}</p>
          </>
        ) : (
          <MutedSlot message="No PRs yet" />
        )}
      </Tile>

      <Tile href="#throws" icon={Target} label="Recent throws">
        {recentThrows.length > 0 ? (
          <>
            <p className="text-sm font-semibold text-[var(--foreground)] tabular-nums">
              {recentThrows.slice(0, 3).map((t, i) => (
                <span key={t.id}>
                  {t.distance != null ? `${t.distance.toFixed(2)}m` : "—"}
                  {i < Math.min(2, recentThrows.length - 1) && (
                    <span className="text-muted font-normal mx-1">·</span>
                  )}
                </span>
              ))}
            </p>
            <p className="text-xs text-muted truncate">
              {formatEventName(recentThrows[0].event)} · {formatRelativePast(recentThrows[0].date)}
            </p>
          </>
        ) : (
          <MutedSlot message="No throws logged" />
        )}
      </Tile>

      <Tile href="#insights" icon={MessageSquare} label="Latest note">
        {latestNote ? (
          <>
            <p className="text-sm text-[var(--foreground)] line-clamp-2 leading-snug">
              {latestNote.content}
            </p>
            <p className="text-xs text-muted">
              {formatRelativePast(latestNote.createdAt)}
              {latestNote.category && latestNote.category !== "GENERAL" && (
                <>
                  {" · "}
                  {latestNote.category.toLowerCase().replace(/_/g, " ")}
                </>
              )}
            </p>
          </>
        ) : (
          <MutedSlot message="No coach notes yet" />
        )}
      </Tile>
    </section>
  );
}
