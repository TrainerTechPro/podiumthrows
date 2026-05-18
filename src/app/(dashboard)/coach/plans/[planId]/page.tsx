import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoachSession, getWorkoutPlanDetail, getAthletePickerList } from "@/lib/data/coach";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { formatEventType } from "@/lib/utils";
import { ChevronLeft, Printer } from "lucide-react";
import { PlanActions } from "./_plan-actions";

const STATUS_VARIANTS: Record<string, "info" | "warning" | "success" | "neutral" | "danger"> = {
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  SKIPPED: "neutral",
  CANCELLED: "danger",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  SKIPPED: "Skipped",
  CANCELLED: "Cancelled",
};

const PHASE_LABELS: Record<string, string> = {
  GPP: "GPP — General Physical Preparation",
  SPP: "SPP — Special Physical Preparation",
  COMPETITION: "Competition",
  TRANSITION: "Transition",
};

const PHASE_VARIANTS: Record<string, "primary" | "success" | "warning" | "info"> = {
  GPP: "info",
  SPP: "primary",
  COMPETITION: "warning",
  TRANSITION: "success",
};

export default async function PlanDetailPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const { coach } = await requireCoachSession();
  const [plan, athletes] = await Promise.all([
    getWorkoutPlanDetail(planId, coach.id),
    getAthletePickerList(coach.id),
  ]);

  if (!plan) notFound();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back link — points at the new IA Library destination directly so
          the back-button doesn't depend on commit 5's redirect to translate
          /coach/plans → /coach/library?view=plans. */}
      <Link
        href="/coach/library?view=plans"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors"
      >
        <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        All plans
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-bold font-heading text-[var(--foreground)] truncate">
              {plan.name}
            </h1>
            {plan.isTemplate && <Badge variant="primary">Template</Badge>}
          </div>
          {plan.description && <p className="text-sm text-muted">{plan.description}</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/coach/plans/${plan.id}/print`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-[var(--foreground)] border border-[var(--card-border)] hover:border-primary-500/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            aria-label="Open print view of plan"
          >
            <Printer size={14} strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden sm:inline">Print plan</span>
          </Link>
          <PlanActions
            planId={plan.id}
            planName={plan.name}
            planEvent={plan.event}
            athletes={athletes}
          />
        </div>
      </div>

      {/* Metadata row */}
      <div className="card p-4">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <dt className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              Event
            </dt>
            <dd className="text-sm text-[var(--foreground)]">
              {plan.event ? formatEventType(plan.event) : "General"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              Phase
            </dt>
            <dd className="text-sm">
              {plan.phase ? (
                <Badge variant={PHASE_VARIANTS[plan.phase] ?? "neutral"}>
                  {PHASE_LABELS[plan.phase] ?? plan.phase}
                </Badge>
              ) : (
                <span className="text-muted">Unspecified</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              Blocks
            </dt>
            <dd className="text-sm tabular-nums text-[var(--foreground)]">{plan.blocks.length}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              Assigned
            </dt>
            <dd className="text-sm tabular-nums text-[var(--foreground)]">
              {plan.assignedSessionCount > 0 ? (
                <>
                  {plan.assignedSessionCount}{" "}
                  <span className="text-muted text-xs">
                    session{plan.assignedSessionCount === 1 ? "" : "s"}
                  </span>
                </>
              ) : (
                <span className="text-muted">Not assigned</span>
              )}
            </dd>
          </div>
        </dl>
        <div className="mt-3 pt-3 border-t border-[var(--card-border)]">
          <dt className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
            Created
          </dt>
          <dd className="text-sm text-muted tabular-nums">
            {new Date(plan.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </dd>
        </div>
      </div>

      {/* Assignments */}
      {plan.assignments.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Assigned To
            </h2>
            <span className="text-xs text-muted tabular-nums">
              {plan.assignments.length} of {plan.assignedSessionCount}
            </span>
          </div>
          <div className="card divide-y divide-[var(--card-border)]">
            {plan.assignments.map((a) => (
              <Link
                key={a.id}
                href={`/coach/athletes/${a.athleteId}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
              >
                <Avatar
                  name={`${a.athleteFirstName} ${a.athleteLastName}`}
                  src={a.athleteAvatarUrl}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">
                    {a.athleteFirstName} {a.athleteLastName}
                  </p>
                  <p className="text-xs text-muted tabular-nums">
                    {new Date(a.scheduledDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANTS[a.status] ?? "neutral"}>
                  {STATUS_LABELS[a.status] ?? a.status}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Blocks */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Blocks</h2>

        {plan.blocks.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-muted">This plan has no blocks yet.</p>
          </div>
        ) : (
          plan.blocks.map((block) => (
            <div key={block.id} className="card p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono tabular-nums text-muted">
                    #{block.order + 1}
                  </span>
                  <h3 className="font-semibold text-[var(--foreground)]">{block.name}</h3>
                  <Badge variant="neutral" className="capitalize">
                    {block.blockType}
                  </Badge>
                </div>
                {block.restSeconds !== null && block.restSeconds > 0 && (
                  <span className="text-xs text-muted tabular-nums">
                    Rest: {block.restSeconds}s
                  </span>
                )}
              </div>

              {block.notes && <p className="text-xs text-muted mb-3 italic">{block.notes}</p>}

              {block.exercises.length === 0 ? (
                <p className="text-xs text-muted">No exercises configured.</p>
              ) : (
                <ul className="divide-y divide-[var(--card-border)]">
                  {block.exercises.map((ex) => (
                    <li key={ex.id} className="flex items-center justify-between py-2 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{ex.exerciseName}</p>
                        <p className="text-xs text-muted">{ex.exerciseCategory}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs tabular-nums text-muted shrink-0">
                        {ex.sets !== null && ex.reps !== null && (
                          <span>
                            {ex.sets} × {ex.reps}
                          </span>
                        )}
                        {ex.weight && <span>{ex.weight}</span>}
                        {ex.implementKg !== null && <span>{ex.implementKg}kg</span>}
                        {ex.rpe !== null && <span>RPE {ex.rpe}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
