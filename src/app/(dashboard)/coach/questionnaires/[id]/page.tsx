import Link from "next/link";
import { notFound } from "next/navigation";
import {
  requireCoachSession,
  getQuestionnaireById,
  getAthletePickerList,
  getQuestionnaireAssignments,
} from "@/lib/data/coach";
import { Badge } from "@/components/ui/Badge";
import { QuestionnaireBuilder } from "../_questionnaire-builder";
import { QuestionnaireActions } from "./_questionnaire-actions";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  ONBOARDING: "PAR-Q / Onboarding",
  ASSESSMENT: "Assessment",
  CHECK_IN: "Check-in",
  CUSTOM: "Custom",
};

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default async function QuestionnaireDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { edit?: string };
}) {
  const { coach } = await requireCoachSession();
  const questionnaire = await getQuestionnaireById(params.id, coach.id);

  if (!questionnaire) notFound();

  const isEditing = searchParams.edit === "true";

  // If editing, show the builder
  if (isEditing) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Edit Questionnaire
        </h1>
        <QuestionnaireBuilder
          initialData={{
            id: questionnaire.id,
            title: questionnaire.title,
            description: questionnaire.description,
            type: questionnaire.type,
            status: questionnaire.status,
            questions: questionnaire.questions as Array<{
              id: string;
              text: string;
              type: "short_text" | "long_text" | "number" | "scale_1_5" | "scale_1_10" | "single_choice" | "multiple_choice" | "yes_no";
              options?: string[];
              required: boolean;
            }>,
          }}
        />
      </div>
    );
  }

  // Otherwise show detail view
  const [athletes, assignments] = await Promise.all([
    getAthletePickerList(coach.id),
    getQuestionnaireAssignments(questionnaire.id, coach.id),
  ]);

  const assignedAthleteIds = assignments.map((a) => a.athleteId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/coach/questionnaires"
              className="text-muted hover:text-[var(--foreground)] transition-colors"
              aria-label="Back to questionnaires"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
              {questionnaire.title}
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant={questionnaire.status === "published" ? "success" : "neutral"}
            >
              {questionnaire.status === "published" ? "Published" : "Draft"}
            </Badge>
            <Badge variant="info">{TYPE_LABELS[questionnaire.type] ?? questionnaire.type}</Badge>
            <span className="text-xs text-muted">
              {questionnaire.questions.length} question
              {questionnaire.questions.length !== 1 ? "s" : ""}
            </span>
          </div>
          {questionnaire.description && (
            <p className="text-sm text-muted mt-2">{questionnaire.description}</p>
          )}
        </div>

        <QuestionnaireActions
          questionnaireId={questionnaire.id}
          status={questionnaire.status}
          athletes={athletes}
          assignedAthleteIds={assignedAthleteIds}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-[var(--foreground)]">
            {questionnaire.assignmentCount}
          </div>
          <div className="text-xs text-muted">Assigned</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-[var(--foreground)]">
            {questionnaire.responseCount}
          </div>
          <div className="text-xs text-muted">Responses</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-[var(--foreground)]">
            {questionnaire.assignmentCount > 0
              ? Math.round(
                  (questionnaire.responseCount / questionnaire.assignmentCount) * 100
                )
              : 0}
            %
          </div>
          <div className="text-xs text-muted">Completion</div>
        </div>
      </div>

      {/* Questions preview */}
      <div className="card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Questions
        </h2>
        {questionnaire.questions.map((q, i) => (
          <div key={q.id} className="flex gap-3 text-sm">
            <span className="text-muted font-mono shrink-0 w-5 text-right">
              {i + 1}.
            </span>
            <div>
              <span className="text-[var(--foreground)]">{q.text}</span>
              {q.required && (
                <span className="text-red-500 ml-1 text-xs">*</span>
              )}
              <span className="text-muted ml-2 text-xs">
                ({QUESTION_TYPE_LABELS_SIMPLE[q.type] ?? q.type})
              </span>
              {q.options && q.options.length > 0 && (
                <div className="text-xs text-muted mt-0.5">
                  Options: {q.options.join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Assignments */}
      {assignments.length > 0 && (
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Assignments ({assignments.length})
          </h2>
          <div className="space-y-2">
            {assignments.map((a) => (
              <div
                key={a.athleteId}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-[var(--foreground)]">{a.athleteName}</span>
                {a.completedAt ? (
                  <Badge variant="success">
                    Completed{" "}
                    {new Date(a.completedAt).toLocaleDateString()}
                  </Badge>
                ) : (
                  <Badge variant="warning">Pending</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response link */}
      {questionnaire.responseCount > 0 && (
        <Link
          href={`/coach/questionnaires/${questionnaire.id}/responses`}
          className="card p-4 flex items-center justify-between hover:ring-2 hover:ring-primary-500/30 transition-all group"
        >
          <span className="text-sm font-medium text-[var(--foreground)] group-hover:text-primary-600 dark:group-hover:text-primary-400">
            View {questionnaire.responseCount} Response
            {questionnaire.responseCount !== 1 ? "s" : ""}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      )}
    </div>
  );
}

const QUESTION_TYPE_LABELS_SIMPLE: Record<string, string> = {
  short_text: "Short Text",
  long_text: "Long Text",
  number: "Number",
  scale_1_5: "1-5 Scale",
  scale_1_10: "1-10 Scale",
  single_choice: "Single Choice",
  multiple_choice: "Multiple Choice",
  yes_no: "Yes/No",
};
