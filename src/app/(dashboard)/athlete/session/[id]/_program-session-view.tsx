import Link from "next/link";
import { Badge } from "@/components";
import { ArrowLeft, Clock, Target, Dumbbell, Activity, CircleDot } from "lucide-react";

type ProgramSessionWithRelations = {
  id: string;
  status: string;
  weekNumber: number;
  dayOfWeek: number;
  dayType: string;
  focusLabel: string;
  sessionType: string;
  totalThrowsTarget: number;
  estimatedDuration: number | null;
  actualThrows: number | null;
  bestMark: number | null;
  rpe: number | null;
  selfFeeling: string | null;
  sessionNotes: string | null;
  wasModified: boolean;
  modificationNotes: string | null;
  scheduledDate: string | null;
  throwsPrescription: string | null;
  strengthPrescription: string | null;
  warmupPrescription: string | null;
  program: { event: string; startDate: string; gender: string };
  phase: { phase: string; phaseOrder: number };
};

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
                <p className="font-medium text-[var(--foreground)]">{item.implement}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="primary">{item.category}</Badge>
                  {item.drillType && <Badge variant="neutral">{item.drillType}</Badge>}
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
        {/* Mobile: stacked cards (no horizontal scroll on a 5-col prescription) */}
        <ul className="sm:hidden divide-y divide-[var(--card-border)]">
          {items.map((item, i) => (
            <li key={i} className="py-3 first:pt-0 last:pb-0">
              <p className="font-medium text-[var(--foreground)]">{item.exerciseName}</p>
              {item.classification && (
                <p className="text-xs text-muted mt-0.5">{item.classification}</p>
              )}
              <div className="mt-2 grid grid-cols-4 gap-2 font-mono text-xs tabular-nums">
                <div>
                  <span className="block text-nano uppercase tracking-wider text-muted">Sets</span>
                  <span className="text-[var(--foreground)]">{item.sets}</span>
                </div>
                <div>
                  <span className="block text-nano uppercase tracking-wider text-muted">Reps</span>
                  <span className="text-muted">{item.reps}</span>
                </div>
                <div>
                  <span className="block text-nano uppercase tracking-wider text-muted">Load</span>
                  <span className="text-muted">
                    {item.loadKg != null ? `${item.loadKg}kg` : "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-nano uppercase tracking-wider text-muted">%</span>
                  <span className="text-muted">
                    {item.intensityPercent != null ? `${item.intensityPercent}%` : "—"}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Desktop: dense table preserved */}
        <div className="hidden sm:block overflow-x-auto">
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
                    <p className="font-medium text-[var(--foreground)]">{item.exerciseName}</p>
                    {item.classification && (
                      <p className="text-xs text-muted mt-0.5">{item.classification}</p>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{item.sets}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted">{item.reps}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted">
                    {item.loadKg != null ? `${item.loadKg}kg` : "—"}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-muted">
                    {item.intensityPercent != null ? `${item.intensityPercent}%` : "—"}
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
                    <span className="text-muted font-normal ml-2">{item.duration}</span>
                  )}
                </p>
                {item.notes && <p className="text-xs text-muted mt-0.5">{item.notes}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function calculateScheduledDate(
  programStartDate: string,
  weekNumber: number,
  dayOfWeek: number
): string {
  const start = new Date(programStartDate + "T00:00:00");
  const dayOffset = (weekNumber - 1) * 7 + (dayOfWeek - 1);
  const date = new Date(start);
  date.setDate(date.getDate() + dayOffset);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function ProgramSessionView({
  programSession,
}: {
  programSession: ProgramSessionWithRelations;
}) {
  const throwItems = parseJson<ThrowPrescriptionItem>(programSession.throwsPrescription);
  const strengthItems = parseJson<StrengthPrescriptionItem>(programSession.strengthPrescription);
  const warmupItems = parseJson<WarmupPrescriptionItem>(programSession.warmupPrescription);

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

  const totalPrescribedThrows = throwItems.reduce((sum, t) => sum + t.sets * t.repsPerSet, 0);

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
            {formatEventName(programSession.program.event)} — {programSession.focusLabel}
          </h1>
          <p className="text-sm text-muted mt-0.5">{displayDate}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={phaseVariant}>{programSession.phase.phase}</Badge>
            <span className="text-xs text-muted">
              Week {programSession.weekNumber} &middot; Day {programSession.dayType}
            </span>
          </div>
        </div>
        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">Total Throws Target</p>
          <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
            {programSession.totalThrowsTarget}
          </p>
        </div>
        {totalPrescribedThrows > 0 &&
          totalPrescribedThrows !== programSession.totalThrowsTarget && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Prescribed Throws</p>
              <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                {totalPrescribedThrows}
              </p>
            </div>
          )}
        {programSession.estimatedDuration != null && (
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">Est. Duration</p>
            <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
              {programSession.estimatedDuration} min
            </p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">Session Type</p>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {programSession.sessionType.replace(/_/g, " ")}
          </p>
        </div>
      </div>

      <WarmupPrescriptionCard items={warmupItems} />
      <ThrowsPrescriptionCard items={throwItems} />
      <StrengthPrescriptionCard items={strengthItems} />

      {programSession.status === "COMPLETED" && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Session Results
          </h2>
          <div className="card px-4 py-3">
            <div className="flex flex-wrap gap-4">
              {programSession.actualThrows != null && (
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">Actual Throws</p>
                  <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                    {programSession.actualThrows}
                  </p>
                </div>
              )}
              {programSession.bestMark != null && (
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">Best Mark</p>
                  <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                    {programSession.bestMark.toFixed(2)}m
                  </p>
                </div>
              )}
              {programSession.rpe != null && (
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">RPE</p>
                  <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                    {programSession.rpe} / 10
                  </p>
                </div>
              )}
              {programSession.selfFeeling && (
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">Feeling</p>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {programSession.selfFeeling.replace(/_/g, " ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {programSession.sessionNotes && (
        <div className="card px-4 py-3">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">Session Notes</p>
          <p className="text-sm text-[var(--foreground)]">{programSession.sessionNotes}</p>
        </div>
      )}

      {programSession.wasModified && programSession.modificationNotes && (
        <div className="card px-4 py-3 border-l-4 border-warning-500">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">Session Modified</p>
          <p className="text-sm text-[var(--foreground)]">{programSession.modificationNotes}</p>
        </div>
      )}

      {(programSession.status === "PLANNED" || programSession.status === "SCHEDULED") && (
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
