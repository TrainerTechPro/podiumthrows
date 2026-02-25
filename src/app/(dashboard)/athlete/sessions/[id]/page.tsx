import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components";
import {
  requireAthleteSession,
  getSessionWithPrescription,
} from "@/lib/data/athlete";
import { CompleteSessionButton } from "./_complete-button";
import { SessionLogger } from "./_session-logger";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

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
  { label: string; variant: "success" | "warning" | "danger" | "neutral" }
> = {
  COMPLETED: { label: "Completed", variant: "success" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  SCHEDULED: { label: "Scheduled", variant: "neutral" },
  SKIPPED: { label: "Skipped", variant: "danger" },
};

/* ─── Exercise Log Table (for completed sessions) ────────────────────────── */

type LogItem = {
  id: string;
  exerciseName: string;
  sets: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  distance: number | null;
  notes: string | null;
};

function ExerciseLogTable({ logs }: { logs: LogItem[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted py-4 text-center">
        No exercise logs recorded.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
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
                  <p className="text-xs text-muted font-normal mt-0.5">
                    {log.notes}
                  </p>
                )}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums">
                {log.sets}
              </td>
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
  );
}

/* ─── Throw Log ───────────────────────────────────────────────────────────── */

type ThrowItem = {
  id: string;
  event: string;
  implementWeight: number;
  distance: number;
  isPersonalBest: boolean;
  notes: string | null;
};

function ThrowLogTable({ throws }: { throws: ThrowItem[] }) {
  if (throws.length === 0) {
    return (
      <p className="text-sm text-muted py-4 text-center">
        No throws recorded.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
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
                {t.notes && (
                  <p className="text-xs text-muted font-normal mt-0.5">
                    {t.notes}
                  </p>
                )}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-muted">
                {t.implementWeight}kg
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-[var(--foreground)]">
                {t.distance.toFixed(2)}m
              </td>
              <td className="py-2.5 text-right">
                {t.isPersonalBest && <Badge variant="warning">PR</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function SessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { athlete } = await requireAthleteSession();
  const session = await getSessionWithPrescription(athlete.id, params.id);

  if (!session) notFound();

  const cfg = STATUS_CONFIG[session.status] ?? {
    label: session.status,
    variant: "neutral" as const,
  };
  const isActive =
    session.status === "SCHEDULED" || session.status === "IN_PROGRESS";
  const hasPrescription = session.blocks.length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link
        href="/athlete/sessions"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Sessions
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            {session.planName ?? "Training Session"}
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {formatDate(session.scheduledDate)}
          </p>
        </div>
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
      </div>

      {/* Meta row */}
      {(session.rpe != null || session.completedDate) && (
        <div className="flex flex-wrap gap-4">
          {session.completedDate && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">
                Completed
              </p>
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

      {/* Coach notes */}
      {session.coachNotes && (
        <div className="card px-4 py-3 border-l-4 border-primary-500">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">
            Coach Notes
          </p>
          <p className="text-sm text-[var(--foreground)]">
            {session.coachNotes}
          </p>
        </div>
      )}

      {/* Athlete notes */}
      {session.notes && (
        <div className="card px-4 py-3">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">
            My Notes
          </p>
          <p className="text-sm text-[var(--foreground)]">{session.notes}</p>
        </div>
      )}

      {/* Active session: show prescribed workout + logging */}
      {isActive && hasPrescription && <SessionLogger session={session} />}

      {/* Active session without prescription: just show empty state */}
      {isActive && !hasPrescription && (
        <div className="card p-6 text-center">
          <p className="text-muted text-sm">
            No prescribed workout for this session.
          </p>
          <p className="text-muted text-xs mt-1">
            You can still mark it complete with your RPE below.
          </p>
        </div>
      )}

      {/* Complete button (active sessions only) */}
      {isActive && <CompleteSessionButton sessionId={session.id} />}

      {/* Completed/Skipped sessions: show log tables */}
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
