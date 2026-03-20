import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge, StaggeredList } from "@/components";
import { requireAthleteSession, getAthleteSessionHistory } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";
import { SelfLoggedSessions } from "./_self-logged-sessions";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  COMPLETED:   { label: "Completed",   variant: "success"  },
  IN_PROGRESS: { label: "In Progress", variant: "warning"  },
  SCHEDULED:   { label: "Scheduled",   variant: "neutral"  },
  SKIPPED:     { label: "Skipped",     variant: "danger"   },
};

/* ─── Session Row ─────────────────────────────────────────────────────────── */

function SessionRow({
  session,
}: {
  session: {
    id: string;
    scheduledDate: string;
    completedDate: string | null;
    status: string;
    rpe: number | null;
    planName: string | null;
    coachNotes: string | null;
  };
}) {
  const cfg = STATUS_CONFIG[session.status] ?? { label: session.status, variant: "neutral" as const };
  const isUpcoming = session.status === "SCHEDULED" || session.status === "IN_PROGRESS";

  return (
    <Link
      href={`/athlete/sessions/${session.id}`}
      className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors group"
    >
      {/* Date blob */}
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 text-center",
          isUpcoming
            ? "bg-primary-500/10 text-primary-600 dark:text-primary-400"
            : "bg-surface-100 dark:bg-surface-800 text-muted"
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
          {new Date(session.scheduledDate).toLocaleDateString("en-US", { month: "short" })}
        </span>
        <span className="text-lg font-bold leading-tight tabular-nums">
          {new Date(session.scheduledDate).getDate()}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)] truncate">
          {session.planName ?? "Training Session"}
        </p>
        <p className="text-xs text-muted truncate">
          {formatDate(session.scheduledDate)}
          {session.completedDate && ` · Completed ${formatDate(session.completedDate)}`}
          {session.rpe != null && ` · RPE ${session.rpe.toFixed(1)}`}
        </p>
      </div>

      {/* Status badge */}
      <Badge variant={cfg.variant}>{cfg.label}</Badge>

      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="text-muted group-hover:text-primary-500 transition-colors shrink-0"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function AthleteSessionsPage() {
  const { athlete } = await requireAthleteSession();
  const sessions = await getAthleteSessionHistory(athlete.id, 50);

  // Fetch self-logged sessions
  const selfLogged = await prisma.athleteThrowsSession.findMany({
    where: { athleteId: athlete.id },
    orderBy: { date: "desc" },
    take: 50,
    include: {
      drillLogs: { orderBy: { createdAt: "asc" } },
    },
  });

  const upcoming = sessions.filter(
    (s) => s.status === "SCHEDULED" || s.status === "IN_PROGRESS"
  );
  const past = sessions.filter(
    (s) => s.status === "COMPLETED" || s.status === "SKIPPED"
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header with Log Session CTA */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">My Sessions</h1>
          <p className="text-sm text-muted mt-0.5">
            {sessions.length + selfLogged.length} session{sessions.length + selfLogged.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link href="/athlete/log-session" className="btn-primary whitespace-nowrap">
          + Log Session
        </Link>
      </div>

      {/* Upcoming (coach-assigned) */}
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Upcoming
          </h2>
          <StaggeredList className="card divide-y divide-[var(--card-border)] overflow-hidden">
            {upcoming.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </StaggeredList>
        </section>
      )}

      {/* Self-logged sessions */}
      {selfLogged.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            My Logged Sessions
          </h2>
          <SelfLoggedSessions sessions={JSON.parse(JSON.stringify(selfLogged))} />
        </section>
      )}

      {/* Past (coach-assigned) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Coach-Assigned Sessions
        </h2>
        {past.length === 0 ? (
          <div className="card">
            <p className="text-sm text-muted py-8 text-center">No completed sessions yet.</p>
          </div>
        ) : (
          <StaggeredList className="card divide-y divide-[var(--card-border)] overflow-hidden">
            {past.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </StaggeredList>
        )}
      </section>
    </div>
  );
}
