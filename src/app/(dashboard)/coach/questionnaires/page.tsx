import Link from "next/link";
import { requireCoachSession, getCoachQuestionnaires } from "@/lib/data/coach";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

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

const TYPE_BADGE_VARIANT: Record<string, "primary" | "success" | "warning" | "info" | "neutral" | "danger"> = {
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white font-medium text-sm hover:bg-primary-600 transition-colors shrink-0"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Form
        </Link>
      </div>

      {/* List */}
      {questionnaires.length === 0 ? (
        <EmptyState
          icon={
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }
          title="No questionnaires yet"
          description="Create your first questionnaire to gather health screenings, readiness data, and more from your athletes."
          action={
            <Link
              href="/coach/questionnaires/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white font-medium text-sm hover:bg-primary-600 transition-colors"
            >
              Create Form
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {questionnaires.map((q) => {
            const itemCount = q.blockCount > 0 ? q.blockCount : q.questionCount;
            const itemLabel = q.blockCount > 0 ? "blocks" : "questions";

            return (
              <Link
                key={q.id}
                href={`/coach/questionnaires/${q.id}`}
                className="card p-4 flex items-center gap-4 hover:ring-2 hover:ring-primary-500/30 transition-all group"
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
                    {q.scoringEnabled && (
                      <Badge variant="info">Scored</Badge>
                    )}
                  </div>
                  {q.description && (
                    <p className="text-sm text-muted truncate">{q.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-6 text-sm text-muted shrink-0">
                  <div className="text-center hidden sm:block">
                    <div className="font-semibold text-[var(--foreground)]">{itemCount}</div>
                    <div className="text-[10px]">{itemLabel}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-[var(--foreground)]">{q.responseCount}</div>
                    <div className="text-[10px]">responses</div>
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className="font-semibold text-[var(--foreground)]">{q.assignmentCount}</div>
                    <div className="text-[10px]">assigned</div>
                  </div>
                </div>

                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted shrink-0"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
