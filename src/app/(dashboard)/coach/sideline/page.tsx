import Link from "next/link";
import { CheckCircle2, Circle, PlayCircle, ChevronRight, CalendarCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { requireCoachSession } from "@/lib/data/coach";
import { getSidelineData, type SidelineSessionItem } from "@/lib/data/sideline";
import { FullCoachViewPill } from "./_full-view-pill";
import { QuickCheckStrip } from "./_quick-check-strip";
import { AddNoteCTA } from "./_add-note-cta";

export const dynamic = "force-dynamic";

function StatusGlyph({ status }: { status: string }) {
  if (status === "COMPLETED") {
    return (
      <CheckCircle2
        size={16}
        strokeWidth={1.75}
        aria-label="Completed"
        style={{ color: "var(--color-status-success-fg)" }}
      />
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <PlayCircle
        size={16}
        strokeWidth={1.75}
        aria-label="In progress"
        style={{ color: "var(--color-brand-strong)" }}
      />
    );
  }
  return (
    <Circle
      size={16}
      strokeWidth={1.75}
      aria-label="Not started"
      style={{ color: "var(--color-text-secondary)" }}
    />
  );
}

function SessionRow({ session }: { session: SidelineSessionItem }) {
  return (
    <Link
      href={session.href}
      className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg active:scale-[0.99] hover:bg-surface-100 dark:hover:bg-surface-800/50 transition-colors"
    >
      <StatusGlyph status={session.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)] truncate">{session.title}</p>
        <p className="text-xs text-[var(--color-text-secondary)] capitalize">
          {session.kind} · {session.status.replace(/_/g, " ").toLowerCase()}
        </p>
      </div>
      <ChevronRight
        size={16}
        strokeWidth={1.75}
        aria-hidden="true"
        style={{ color: "var(--color-text-secondary)" }}
      />
    </Link>
  );
}

export default async function CoachSidelinePage() {
  // Middleware gates /coach/sideline via FLAG_GATED_ROUTES (coachSideline).
  // Disabled → redirect to /coach/dashboard. The middleware also gates the
  // phone-UA dashboard → sideline auto-redirect by the same flag to avoid
  // loops.
  const { coach } = await requireCoachSession();
  const data = await getSidelineData(coach.id);
  const teamLabel = coach.organization?.trim() || `${coach.firstName}'s squad`;

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-8">
      {/* Sticky header — sideline · team name + Full coach view pill */}
      <header className="sticky top-0 -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 bg-[var(--background)] z-10 flex items-center justify-between gap-3 border-b border-[var(--card-border)]/50">
        <div className="min-w-0">
          <p className="text-nano font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
            Sideline
          </p>
          <h1 className="font-heading text-lg font-semibold text-[var(--foreground)] truncate">
            {teamLabel}
          </h1>
        </div>
        <FullCoachViewPill />
      </header>

      {/* Card 1 — Today's sessions, grouped by athlete */}
      <section
        aria-labelledby="today-heading"
        className="rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 space-y-4"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2
            id="today-heading"
            className="font-heading text-base font-semibold text-[var(--foreground)]"
          >
            Today&apos;s sessions
          </h2>
          <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
            {data.todayLabel}
          </span>
        </div>

        {data.todayByAthlete.length === 0 ? (
          <div className="flex flex-col items-center text-center py-6 text-sm text-[var(--color-text-secondary)]">
            <CalendarCheck
              size={28}
              strokeWidth={1.75}
              aria-hidden="true"
              className="mb-2 opacity-60"
            />
            <p className="font-medium text-[var(--foreground)]">No sessions on the board</p>
            <p className="mt-1">Anything programmed for today will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-4 divide-y divide-[var(--card-border)]/40">
            {data.todayByAthlete.map((athlete, idx) => (
              <li key={athlete.athleteId} className={idx === 0 ? "" : "pt-4"}>
                <Link
                  href={`/coach/athletes/${athlete.athleteId}`}
                  className="flex items-center gap-3 mb-2 active:opacity-80 transition-opacity"
                >
                  <Avatar
                    name={`${athlete.firstName} ${athlete.lastName}`}
                    src={athlete.avatarUrl}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                      {athlete.firstName} {athlete.lastName}
                    </p>
                    {athlete.events.length > 0 && (
                      <p className="text-xs text-[var(--color-text-secondary)] truncate">
                        {athlete.events.join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">
                    {athlete.sessions.length}
                  </span>
                </Link>
                <div className="pl-12">
                  {athlete.sessions.map((s) => (
                    <SessionRow key={`${s.kind}-${s.id}`} session={s} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Card 2 — Roster Quick-Check */}
      <section
        aria-labelledby="roster-heading"
        className="rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] p-5 space-y-4"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2
            id="roster-heading"
            className="font-heading text-base font-semibold text-[var(--foreground)]"
          >
            Roster quick-check
          </h2>
          <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
            {data.totalAthletes} athlete{data.totalAthletes === 1 ? "" : "s"}
          </span>
        </div>
        <QuickCheckStrip roster={data.roster} />
      </section>

      {/* Card 3 — Add note / video */}
      <AddNoteCTA roster={data.roster} />
    </div>
  );
}
