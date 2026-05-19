import Link from "next/link";
import { Plus, ChevronRight, HelpCircle } from "lucide-react";
import { requireCoachSession, getCoachQuestionnaires } from "@/lib/data/coach";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaggeredList } from "@/components/ui/StaggeredList";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding",
  ASSESSMENT: "Assessment",
  CHECK_IN: "Check-in",
  READINESS: "Readiness",
  COMPETITION: "Competition",
  INJURY: "Injury",
  CUSTOM: "Custom",
};

/**
 * Compact completion indicator that collapses three numbers (completed /
 * assigned / overdue) into one pill. Color carries the urgency:
 *   - muted gray when every assignment is done
 *   - amber when any are outstanding
 *   - red when any are past due
 */
function CompletionPill({
  completed,
  total,
  overdue,
}: {
  completed: number;
  total: number;
  overdue: number;
}) {
  const allDone = completed >= total;
  const tone =
    overdue > 0
      ? "border-danger-500/30 bg-danger-500/10 text-danger-700 dark:text-danger-400"
      : allDone
        ? "border-[var(--card-border)] bg-surface-100 dark:bg-surface-800 text-muted"
        : "border-primary-500/30 bg-primary-500/10 text-primary-700 dark:text-primary-400";

  return (
    <div
      className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-micro font-semibold tabular-nums ${tone}`}
      title={
        overdue > 0
          ? `${completed} of ${total} completed · ${overdue} overdue`
          : `${completed} of ${total} completed`
      }
    >
      <span>
        {completed} / {total}
      </span>
      {overdue > 0 && (
        <span className="text-nano font-bold uppercase tracking-wider">{overdue} late</span>
      )}
    </div>
  );
}

const TYPE_BADGE_VARIANT: Record<
  string,
  "primary" | "success" | "warning" | "info" | "neutral" | "danger"
> = {
  ONBOARDING: "info",
  ASSESSMENT: "warning",
  CHECK_IN: "primary",
  READINESS: "success",
  COMPETITION: "info",
  INJURY: "danger",
  CUSTOM: "neutral",
};

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default async function QuestionnairesPage() {
  // Middleware gates /coach/questionnaires via FLAG_GATED_ROUTES
  // (questionnaireBuilder flag). When disabled the route redirects
  // to /coach/dashboard before reaching this handler.
  const { coach } = await requireCoachSession();
  const questionnaires = await getCoachQuestionnaires(coach.id);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Questionnaires
          </h1>
          <p className="text-sm text-muted mt-1">
            Create and manage forms, check-ins, and assessments for your athletes.
          </p>
        </div>
        <Link
          href="/coach/questionnaires/new"
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-primary-500 text-white font-medium text-sm hover:bg-primary-600 transition-colors shrink-0 min-h-[44px]"
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          Create Form
        </Link>
      </div>

      {/* List */}
      {questionnaires.length === 0 ? (
        <EmptyState
          icon={<HelpCircle size={48} strokeWidth={1.5} aria-hidden="true" />}
          title="No questionnaires yet"
          description="Create your first questionnaire to gather health screenings, readiness data, and more from your athletes."
          action={
            <Link
              href="/coach/questionnaires/new"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-primary-500 text-white font-medium text-sm hover:bg-primary-600 transition-colors min-h-[44px]"
            >
              Create Form
            </Link>
          }
        />
      ) : (
        <StaggeredList className="space-y-3">
          {questionnaires.map((q) => {
            const itemCount = q.blockCount > 0 ? q.blockCount : q.questionCount;
            const itemLabel = q.blockCount > 0 ? "blocks" : "questions";

            return (
              <Link
                key={q.id}
                href={`/coach/questionnaires/${q.id}`}
                className="card card-interactive p-4 flex items-center gap-4 hover:ring-2 hover:ring-primary-500/30 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-[var(--foreground)] group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                      {q.title}
                    </h3>
                    <Badge variant={TYPE_BADGE_VARIANT[q.type] ?? "neutral"}>
                      {TYPE_LABELS[q.type] ?? q.type}
                    </Badge>
                    <Badge variant={q.status === "published" ? "success" : "neutral"}>
                      {q.status === "published" ? "Published" : "Draft"}
                    </Badge>
                    {q.scoringEnabled && <Badge variant="info">Scored</Badge>}
                  </div>
                  {q.description && <p className="text-sm text-muted truncate">{q.description}</p>}
                </div>

                <div className="flex items-center gap-6 text-sm text-muted shrink-0">
                  <div className="text-center hidden sm:block">
                    <div className="font-semibold text-[var(--foreground)] tabular-nums">
                      {itemCount}
                    </div>
                    <div className="text-nano">{itemLabel}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-[var(--foreground)] tabular-nums">
                      {q.responseCount}
                    </div>
                    <div className="text-nano">responses</div>
                  </div>
                  {q.assignmentCount > 0 ? (
                    <CompletionPill
                      completed={q.completedCount}
                      total={q.assignmentCount}
                      overdue={q.overdueCount}
                    />
                  ) : (
                    <div className="text-center hidden sm:block">
                      <div className="font-semibold text-[var(--foreground)] tabular-nums">0</div>
                      <div className="text-nano">assigned</div>
                    </div>
                  )}
                </div>

                <ChevronRight
                  size={16}
                  strokeWidth={1.75}
                  className="text-muted shrink-0"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </StaggeredList>
      )}
    </div>
  );
}
