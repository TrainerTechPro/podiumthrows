import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components";
import { formatImplementWeight } from "@/lib/throws";
import {
  ArrowLeft,
  Clock,
  Target,
  Dumbbell,
  Activity,
  CircleDot,
} from "lucide-react";
import {
  requireAthleteSession,
  getSessionWithPrescription,
} from "@/lib/data/athlete";
import prisma from "@/lib/prisma";
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
  { label: string; variant: "success" | "warning" | "danger" | "neutral" | "info" }
> = {
  COMPLETED: { label: "Completed", variant: "success" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  SCHEDULED: { label: "Scheduled", variant: "info" },
  PLANNED: { label: "Planned", variant: "neutral" },
  SKIPPED: { label: "Skipped", variant: "danger" },
};

const PHASE_VARIANT: Record<string, "primary" | "warning" | "danger" | "success"> = {
  ACCUMULATION: "primary",
  TRANSMUTATION: "warning",
  REALIZATION: "danger",
  COMPETITION: "success",
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
                {formatImplementWeight(t.implementWeight)}
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

/* ─── Program Session Prescription Types ──────────────────────────────────── */

type ThrowPrescriptionItem = {
  implement: string;
  category: string;
  drillType: string;
  sets: number;
  repsPerSet: number;
  restSeconds: number;
  notes?: string;
};

type StrengthPrescriptionItem = {
  exerciseName: string;
  classification: string;
  sets: number;
  reps: number;
  intensityPercent?: number;
  loadKg?: number;
  restSeconds?: number;
};

type WarmupPrescriptionItem = {
  name: string;
  duration?: string;
  notes?: string;
};

function parseJson<T>(json: string | null | undefined): T[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ─── Program Session Components ──────────────────────────────────────────── */

function ThrowsPrescriptionCard({ items }: { items: ThrowPrescriptionItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
        <Target size={16} strokeWidth={1.75} aria-hidden="true" />
        Throwing Prescription
      </h2>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="card px-4 py-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-[var(--foreground)]">
                  {item.implement}
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="primary">{item.category}</Badge>
                  {item.drillType && (
                    <Badge variant="neutral">{item.drillType}</Badge>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                  {item.sets} x {item.repsPerSet}
                </p>
                <p className="text-xs text-muted">sets x reps</p>
              </div>
            </div>

            {(item.restSeconds > 0 || item.notes) && (
              <div className="flex flex-wrap gap-3 text-xs text-muted pt-1 border-t border-[var(--card-border)]">
                {item.restSeconds > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} strokeWidth={1.75} aria-hidden="true" />
                    {item.restSeconds}s rest
                  </span>
                )}
                {item.notes && <span>{item.notes}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function StrengthPrescriptionCard({ items }: { items: StrengthPrescriptionItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
        <Dumbbell size={16} strokeWidth={1.75} aria-hidden="true" />
        Strength Prescription
      </h2>
      <div className="card px-4 py-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted text-xs uppercase tracking-wider border-b border-[var(--card-border)]">
                <th className="pb-2 pr-4 font-medium">Exercise</th>
                <th className="pb-2 pr-4 font-medium text-right">Sets</th>
                <th className="pb-2 pr-4 font-medium text-right">Reps</th>
                <th className="pb-2 pr-4 font-medium text-right">Load</th>
                <th className="pb-2 font-medium text-right">Intensity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--card-border)]">
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="py-2.5 pr-4">
                    <p className="font-medium text-[var(--foreground)]">
                      {item.exerciseName}
                    </p>
                    {item.classification && (
                      <p className="text-xs text-muted mt-0.5">
                        {item.classification}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {item.sets}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted">
                    {item.reps}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted">
                    {item.loadKg != null ? `${item.loadKg}kg` : "—"}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-muted">
                    {item.intensityPercent != null
                      ? `${item.intensityPercent}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function WarmupPrescriptionCard({ items }: { items: WarmupPrescriptionItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
        <Activity size={16} strokeWidth={1.75} aria-hidden="true" />
        Warmup
      </h2>
      <div className="card px-4 py-3">
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <CircleDot
                size={14}
                strokeWidth={1.75}
                className="text-muted mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {item.name}
                  {item.duration && (
                    <span className="text-muted font-normal ml-2">
                      {item.duration}
                    </span>
                  )}
                </p>
                {item.notes && (
                  <p className="text-xs text-muted mt-0.5">{item.notes}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─── Scheduled Date Calculation ──────────────────────────────────────────── */

function calculateScheduledDate(
  programStartDate: string,
  weekNumber: number,
  dayOfWeek: number
): string {
  const start = new Date(programStartDate + "T00:00:00");
  // programStartDate is assumed to be a Monday (day 1)
  // weekNumber is 1-based, dayOfWeek is 1=Mon..7=Sun
  const dayOffset = (weekNumber - 1) * 7 + (dayOfWeek - 1);
  const date = new Date(start);
  date.setDate(date.getDate() + dayOffset);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function SessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { athlete } = await requireAthleteSession();
  const session = await getSessionWithPrescription(athlete.id, params.id);

  /* ── TrainingSession found — render existing view ────────────────────── */
  if (session) {
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
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
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

  /* ── No TrainingSession — try ProgramSession (Bondarchuk programs) ───── */
  const programSession = await prisma.programSession.findFirst({
    where: { id: params.id, program: { athleteId: athlete.id } },
    include: {
      program: { select: { event: true, startDate: true, gender: true } },
      phase: { select: { phase: true, phaseOrder: true } },
    },
  });

  if (!programSession) notFound();

  /* ── Parse prescriptions ─────────────────────────────────────────────── */
  const throwItems = parseJson<ThrowPrescriptionItem>(
    programSession.throwsPrescription
  );
  const strengthItems = parseJson<StrengthPrescriptionItem>(
    programSession.strengthPrescription
  );
  const warmupItems = parseJson<WarmupPrescriptionItem>(
    programSession.warmupPrescription
  );

  const statusCfg = STATUS_CONFIG[programSession.status] ?? {
    label: programSession.status,
    variant: "neutral" as const,
  };

  const phaseVariant = PHASE_VARIANT[programSession.phase.phase] ?? "neutral";

  const displayDate = programSession.scheduledDate
    ? formatDate(programSession.scheduledDate)
    : calculateScheduledDate(
        programSession.program.startDate,
        programSession.weekNumber,
        programSession.dayOfWeek
      );

  const totalPrescribedThrows = throwItems.reduce(
    (sum, t) => sum + t.sets * t.repsPerSet,
    0
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link
        href="/athlete/sessions"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
        Back to Sessions
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            {formatEventName(programSession.program.event)} —{" "}
            {programSession.focusLabel}
          </h1>
          <p className="text-sm text-muted mt-0.5">{displayDate}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={phaseVariant}>
              {programSession.phase.phase}
            </Badge>
            <span className="text-xs text-muted">
              Week {programSession.weekNumber} &middot; Day{" "}
              {programSession.dayType}
            </span>
          </div>
        </div>
        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
      </div>

      {/* Meta stats row */}
      <div className="flex flex-wrap gap-4">
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">
            Total Throws Target
          </p>
          <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
            {programSession.totalThrowsTarget}
          </p>
        </div>
        {totalPrescribedThrows > 0 && totalPrescribedThrows !== programSession.totalThrowsTarget && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">
              Prescribed Throws
            </p>
            <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
              {totalPrescribedThrows}
            </p>
          </div>
        )}
        {programSession.estimatedDuration != null && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">
              Est. Duration
            </p>
            <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
              {programSession.estimatedDuration} min
            </p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">
            Session Type
          </p>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {programSession.sessionType.replace(/_/g, " ")}
          </p>
        </div>
      </div>

      {/* Warmup prescription */}
      <WarmupPrescriptionCard items={warmupItems} />

      {/* Throwing prescription */}
      <ThrowsPrescriptionCard items={throwItems} />

      {/* Strength prescription */}
      <StrengthPrescriptionCard items={strengthItems} />

      {/* Completed session feedback */}
      {programSession.status === "COMPLETED" && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Session Results
          </h2>
          <div className="card px-4 py-3">
            <div className="flex flex-wrap gap-4">
              {programSession.actualThrows != null && (
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">
                    Actual Throws
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                    {programSession.actualThrows}
                  </p>
                </div>
              )}
              {programSession.bestMark != null && (
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">
                    Best Mark
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                    {programSession.bestMark.toFixed(2)}m
                  </p>
                </div>
              )}
              {programSession.rpe != null && (
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">
                    RPE
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                    {programSession.rpe} / 10
                  </p>
                </div>
              )}
              {programSession.selfFeeling && (
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">
                    Feeling
                  </p>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {programSession.selfFeeling.replace(/_/g, " ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Session notes */}
      {programSession.sessionNotes && (
        <div className="card px-4 py-3">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">
            Session Notes
          </p>
          <p className="text-sm text-[var(--foreground)]">
            {programSession.sessionNotes}
          </p>
        </div>
      )}

      {/* Modification notice */}
      {programSession.wasModified && programSession.modificationNotes && (
        <div className="card px-4 py-3 border-l-4 border-warning-500">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">
            Session Modified
          </p>
          <p className="text-sm text-[var(--foreground)]">
            {programSession.modificationNotes}
          </p>
        </div>
      )}

      {/* Read-only notice for planned/scheduled sessions */}
      {(programSession.status === "PLANNED" ||
        programSession.status === "SCHEDULED") && (
        <div className="card p-6 text-center">
          <p className="text-muted text-sm">
            This is a prescribed session from your Bondarchuk program.
          </p>
          <p className="text-muted text-xs mt-1">
            Session logging will be available when your coach activates it.
          </p>
        </div>
      )}
    </div>
  );
}
