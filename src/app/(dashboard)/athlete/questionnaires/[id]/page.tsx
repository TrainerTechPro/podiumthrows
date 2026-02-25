import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAthleteSession, getQuestionnaireForFill } from "@/lib/data/athlete";
import { QuestionnaireForm } from "./_questionnaire-form";

export default async function FillQuestionnairePage({
  params,
}: {
  params: { id: string };
}) {
  const { athlete } = await requireAthleteSession();
  const questionnaire = await getQuestionnaireForFill(params.id, athlete.id);

  if (!questionnaire) notFound();

  if (questionnaire.alreadyCompleted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href="/athlete/questionnaires"
            className="text-muted hover:text-[var(--foreground)] transition-colors"
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
        <div className="card p-8 text-center space-y-3">
          <div className="text-4xl">✅</div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Already Completed
          </h2>
          <p className="text-sm text-muted">
            You have already submitted your responses for this questionnaire.
          </p>
          <Link
            href="/athlete/questionnaires"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white font-medium text-sm hover:bg-primary-600 transition-colors"
          >
            ← Back to Questionnaires
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/athlete/questionnaires"
          className="text-muted hover:text-[var(--foreground)] transition-colors"
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

      <QuestionnaireForm questionnaire={questionnaire} />
    </div>
  );
}
