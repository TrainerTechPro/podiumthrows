import Link from "next/link";
import { Badge } from "@/components";
import { ArrowLeft } from "lucide-react";
import { CompleteSessionButton } from "../../sessions/[id]/_complete-button";
import { SessionLogger } from "../../sessions/[id]/_session-logger";
import { CommentThreadTrigger } from "@/components/comment-thread-sheet";
import { formatImplementWeight } from "@/lib/throws";
import type { SessionWithPrescription } from "@/lib/data/athlete";

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
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

type LogItem = SessionWithPrescription["logs"][number];
type ThrowItem = SessionWithPrescription["throwLogs"][number];

function ExerciseLogTable({ logs }: { logs: LogItem[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted py-4 text-center">No exercise logs recorded.</p>;
  }
  return (
    <>
      {/* Mobile: stacked rows (6-col table overflows on phone) */}
      <ul className="sm:hidden divide-y divide-[var(--card-border)]">
        {logs.map((log) => (
          <li key={log.id} className="py-3 first:pt-0 last:pb-0">
            <p className="font-medium text-[var(--foreground)]">{log.exerciseName}</p>
            {log.notes && <p className="text-xs text-muted mt-0.5">{log.notes}</p>}
            <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs tabular-nums">
              <div>
                <span className="block text-nano uppercase tracking-wider text-muted">
                  Sets×Reps
                </span>
                <span className="text-[var(--foreground)]">
                  {log.sets}×{log.reps ?? "—"}
                </span>
              </div>
              <div>
                <span className="block text-nano uppercase tracking-wider text-muted">Weight</span>
                <span className="text-muted">{log.weight != null ? `${log.weight}kg` : "—"}</span>
              </div>
              <div>
                <span className="block text-nano uppercase tracking-wider text-muted">RPE</span>
                <span className="text-muted">{log.rpe != null ? log.rpe.toFixed(1) : "—"}</span>
              </div>
              {log.distance != null && (
                <div className="col-span-3">
                  <span className="block text-nano uppercase tracking-wider text-muted">
                    Distance
                  </span>
                  <span className="text-muted">{log.distance.toFixed(2)}m</span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: dense table */}
      <div className="hidden sm:block overflow-x-auto">
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
            {logs.map((log) => (
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
    </>
  );
}

function ThrowLogTable({ throws }: { throws: ThrowItem[] }) {
  if (throws.length === 0) {
    return <p className="text-sm text-muted py-4 text-center">No throws recorded.</p>;
  }
  return (
    <>
      {/* Mobile: stacked rows */}
      <ul className="sm:hidden divide-y divide-[var(--card-border)]">
        {throws.map((t) => (
          <li key={t.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--foreground)]">{formatEventName(t.event)}</p>
                {t.notes && <p className="text-xs text-muted mt-0.5 truncate">{t.notes}</p>}
                <p className="text-xs text-muted mt-0.5 font-mono tabular-nums">
                  {formatImplementWeight(t.implementWeight)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-base font-semibold tabular-nums text-[var(--foreground)]">
                  {t.distance != null ? `${t.distance.toFixed(2)}m` : "—"}
                </p>
                {t.isPersonalBest && (
                  <span className="inline-block mt-1">
                    <Badge variant="warning">PR</Badge>
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
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
            {throws.map((t) => (
              <tr key={t.id}>
                <td className="py-2.5 pr-4 font-medium text-[var(--foreground)]">
                  {formatEventName(t.event)}
                  {t.notes && <p className="text-xs text-muted font-normal mt-0.5">{t.notes}</p>}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-muted">
                  {formatImplementWeight(t.implementWeight)}
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
    </>
  );
}

export function LiveTrainingSession({
  session,
  currentUserId,
}: {
  session: SessionWithPrescription;
  currentUserId: string;
}) {
  const cfg = STATUS_CONFIG[session.status] ?? {
    label: session.status,
    variant: "neutral" as const,
  };
  const isActive = session.status === "SCHEDULED" || session.status === "IN_PROGRESS";
  const hasPrescription = session.blocks.length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/athlete/sessions"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
        Back to Sessions
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            {session.planName ?? "Training Session"}
          </h1>
          <p className="text-sm text-muted mt-0.5">{formatDate(session.scheduledDate)}</p>
        </div>
        <div className="flex items-center gap-3">
          <CommentThreadTrigger
            targetField="trainingSessionId"
            targetId={session.id}
            side="bottom"
            context={`${session.planName ?? "Session"} · ${formatDate(session.scheduledDate)}`}
            currentUserId={currentUserId}
            currentUserRole="ATHLETE"
          />
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
        </div>
      </div>

      {(session.rpe != null || session.completedDate) && (
        <div className="flex flex-wrap gap-4">
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
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {session.rpe.toFixed(1)} / 10
              </p>
            </div>
          )}
        </div>
      )}

      {session.coachNotes && (
        <div className="card px-4 py-3 border-l-4 border-primary-500">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">Coach Notes</p>
          <p className="text-sm text-[var(--foreground)]">{session.coachNotes}</p>
        </div>
      )}

      {session.notes && (
        <div className="card px-4 py-3">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">My Notes</p>
          <p className="text-sm text-[var(--foreground)]">{session.notes}</p>
        </div>
      )}

      {isActive && hasPrescription && <SessionLogger session={session} />}

      {isActive && !hasPrescription && (
        <div className="card p-6 text-center">
          <p className="text-muted text-sm">No prescribed workout for this session.</p>
          <p className="text-muted text-xs mt-1">
            You can still mark it complete with your RPE below.
          </p>
        </div>
      )}

      {isActive && <CompleteSessionButton sessionId={session.id} />}

      {!isActive && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Exercise Log
            </h2>
            <div className="card px-4 py-3">
              <ExerciseLogTable logs={session.logs} />
            </div>
          </section>

          {session.throwLogs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Throw Log
              </h2>
              <div className="card px-4 py-3">
                <ThrowLogTable throws={session.throwLogs} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
