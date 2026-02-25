import Link from "next/link";
import { requireAthleteSession, getAthleteAssignedQuestionnaires } from "@/lib/data/athlete";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding",
  ASSESSMENT: "Assessment",
  CHECK_IN: "Check-in",
  CUSTOM: "Custom",
};

const TYPE_BADGE_VARIANT: Record<string, "primary" | "success" | "warning" | "info" | "neutral"> = {
  ONBOARDING: "info",
  ASSESSMENT: "warning",
  CHECK_IN: "primary",
  CUSTOM: "neutral",
};

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default async function AthleteQuestionnairesPage() {
  const { athlete } = await requireAthleteSession();
  const questionnaires = await getAthleteAssignedQuestionnaires(athlete.id);

  const pending = questionnaires.filter((q) => !q.completedAt);
  const completed = questionnaires.filter((q) => !!q.completedAt);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
        My Questionnaires
      </h1>

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
          title="No questionnaires assigned"
          description="Your coach hasn't assigned any questionnaires yet. Check back later!"
        />
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
                Pending ({pending.length})
              </h2>
              {pending.map((q) => (
                <Link
                  key={q.assignmentId}
                  href={`/athlete/questionnaires/${q.questionnaireId}`}
                  className="card p-4 flex items-center gap-4 hover:ring-2 hover:ring-primary-500/30 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-[var(--foreground)] group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                        {q.title}
                      </h3>
                      <Badge variant={TYPE_BADGE_VARIANT[q.type] ?? "neutral"}>
                        {TYPE_LABELS[q.type] ?? q.type}
                      </Badge>
                    </div>
                    {q.description && (
                      <p className="text-xs text-muted truncate">
                        {q.description}
                      </p>
                    )}
                    <p className="text-[10px] text-muted mt-1">
                      {q.questionCount} question{q.questionCount !== 1 ? "s" : ""} · Assigned{" "}
                      {new Date(q.assignedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium shrink-0">
                    Fill Out →
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
                Completed ({completed.length})
              </h2>
              {completed.map((q) => (
                <div
                  key={q.assignmentId}
                  className="card p-4 flex items-center gap-4 opacity-70"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-medium text-[var(--foreground)] truncate">
                        {q.title}
                      </h3>
                      <Badge variant={TYPE_BADGE_VARIANT[q.type] ?? "neutral"}>
                        {TYPE_LABELS[q.type] ?? q.type}
                      </Badge>
                      <Badge variant="success">Completed</Badge>
                    </div>
                    <p className="text-[10px] text-muted">
                      Completed{" "}
                      {q.completedAt
                        ? new Date(q.completedAt).toLocaleDateString()
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
