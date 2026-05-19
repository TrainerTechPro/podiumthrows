import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Avatar, Badge } from "@/components";
import prisma from "@/lib/prisma";
import { requireCoachSession } from "@/lib/data/coach";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "success" | "warning" | "danger" | "neutral" | "info" }
> = {
  COMPLETED: { label: "Completed", variant: "success" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  SCHEDULED: { label: "Scheduled", variant: "info" },
  PLANNED: { label: "Planned", variant: "neutral" },
  SKIPPED: { label: "Skipped", variant: "danger" },
};

export default async function CoachSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { coach } = await requireCoachSession();

  const session = await prisma.trainingSession.findUnique({
    where: { id },
    include: {
      plan: { select: { name: true } },
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          coachId: true,
        },
      },
      logs: { orderBy: { completedAt: "asc" } },
      throwLogs: { orderBy: { date: "asc" } },
    },
  });

  if (!session) notFound();
  if (session.athlete.coachId !== coach.id) notFound();

  const cfg = STATUS_CONFIG[session.status] ?? {
    label: session.status,
    variant: "neutral" as const,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href={`/coach/athletes/${session.athlete.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        Back to Athlete
      </Link>

      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Avatar
              name={`${session.athlete.firstName} ${session.athlete.lastName}`}
              src={session.athlete.avatarUrl}
              size="md"
            />
            <div className="space-y-1">
              <h1 className="text-xl font-heading font-bold text-[var(--foreground)]">
                {session.plan?.name ?? "Training Session"}
              </h1>
              <p className="text-sm text-muted">
                {session.athlete.firstName} {session.athlete.lastName}
              </p>
              <p className="text-sm text-muted">{formatDate(session.scheduledDate)}</p>
            </div>
          </div>
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
        </div>

        {(session.rpe != null || session.completedDate) && (
          <div className="flex flex-wrap gap-4 border-t border-[var(--card-border)] pt-4">
            {session.completedDate && (
              <div>
                <p className="text-xs text-muted uppercase tracking-wide">Completed</p>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {formatDate(session.completedDate)}
                </p>
              </div>
            )}
            {session.rpe != null && (
              <div>
                <p className="text-xs text-muted uppercase tracking-wide">RPE</p>
                <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                  {session.rpe.toFixed(1)} / 10
                </p>
              </div>
            )}
          </div>
        )}

        {session.notes && (
          <div className="border-t border-[var(--card-border)] pt-4">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Athlete Notes</p>
            <p className="text-sm text-[var(--foreground)]">{session.notes}</p>
          </div>
        )}

        {session.coachNotes && (
          <div className="border-t border-[var(--card-border)] pt-4">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Coach Notes</p>
            <p className="text-sm text-[var(--foreground)]">{session.coachNotes}</p>
          </div>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Exercise Log</h2>
        <div className="card px-4 py-3">
          {session.logs.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">No exercise logs recorded.</p>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted text-xs uppercase tracking-wider border-b border-[var(--card-border)]">
                      <th className="pb-2 pr-4 font-medium">Exercise</th>
                      <th className="pb-2 pr-4 font-medium text-right">Sets</th>
                      <th className="pb-2 pr-4 font-medium text-right">Reps</th>
                      <th className="pb-2 pr-4 font-medium text-right">Weight</th>
                      <th className="pb-2 pr-4 font-medium text-right">Distance</th>
                      <th className="pb-2 font-medium text-right">RPE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--card-border)]">
                    {session.logs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 pr-4 font-medium text-[var(--foreground)]">
                          {log.exerciseName}
                          {log.notes && (
                            <p className="text-xs text-muted font-normal mt-0.5">{log.notes}</p>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">{log.sets}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-muted">
                          {log.reps ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-muted">
                          {log.weight != null ? `${log.weight}kg` : "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-muted">
                          {log.distance != null ? `${log.distance.toFixed(2)}m` : "—"}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-muted">
                          {log.rpe != null ? log.rpe.toFixed(1) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: stacked cards — exercise name + inline metric chips */}
              <ul className="md:hidden divide-y divide-[var(--card-border)]">
                {session.logs.map((log) => (
                  <li key={log.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {log.exerciseName}
                    </p>
                    {log.notes && <p className="text-xs text-muted mt-0.5">{log.notes}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5 text-nano tabular-nums">
                      <span className="inline-flex rounded-full bg-surface-100 dark:bg-surface-800 px-2 py-0.5">
                        {log.sets} sets
                      </span>
                      {log.reps != null && (
                        <span className="inline-flex rounded-full bg-surface-100 dark:bg-surface-800 px-2 py-0.5">
                          {log.reps} reps
                        </span>
                      )}
                      {log.weight != null && (
                        <span className="inline-flex rounded-full bg-surface-100 dark:bg-surface-800 px-2 py-0.5">
                          {log.weight}kg
                        </span>
                      )}
                      {log.distance != null && (
                        <span className="inline-flex rounded-full bg-surface-100 dark:bg-surface-800 px-2 py-0.5">
                          {log.distance.toFixed(2)}m
                        </span>
                      )}
                      {log.rpe != null && (
                        <span className="inline-flex rounded-full bg-primary-500/15 text-primary-700 dark:text-primary-300 px-2 py-0.5">
                          RPE {log.rpe.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {session.throwLogs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Throw Log</h2>
          <div className="card px-4 py-3">
            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted text-xs uppercase tracking-wider border-b border-[var(--card-border)]">
                    <th className="pb-2 pr-4 font-medium">Event</th>
                    <th className="pb-2 pr-4 font-medium text-right">Implement</th>
                    <th className="pb-2 pr-4 font-medium text-right">Distance</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]">
                  {session.throwLogs.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2.5 pr-4 font-medium text-[var(--foreground)]">
                        {t.event}
                        {t.notes && (
                          <p className="text-xs text-muted font-normal mt-0.5">{t.notes}</p>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-muted">
                        {t.implementWeight}kg
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-[var(--foreground)]">
                        {t.distance != null ? `${t.distance.toFixed(2)}m` : "—"}
                      </td>
                      <td className="py-2.5 text-right">
                        {t.isPersonalBest && <Badge variant="warning">PR</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: distance hero, event + implement supporting */}
            <ul className="md:hidden divide-y divide-[var(--card-border)]">
              {session.throwLogs.map((t) => (
                <li key={t.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {t.event}
                      {t.isPersonalBest && (
                        <Badge variant="warning" className="ml-1.5">
                          PR
                        </Badge>
                      )}
                    </p>
                    <p className="text-nano text-muted mt-0.5 tabular-nums">
                      {t.implementWeight}kg
                    </p>
                    {t.notes && <p className="text-xs text-muted mt-1">{t.notes}</p>}
                  </div>
                  <p className="text-base font-bold tabular-nums text-[var(--foreground)] shrink-0">
                    {t.distance != null ? `${t.distance.toFixed(2)}m` : "—"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
