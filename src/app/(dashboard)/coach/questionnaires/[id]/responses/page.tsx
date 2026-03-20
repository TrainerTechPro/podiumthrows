import Link from "next/link";
import { notFound } from "next/navigation";
import {
  requireCoachSession,
  getQuestionnaireById,
  getQuestionnaireResponses,
  getQuestionnaireScoreTrends,
} from "@/lib/data/coach";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { ResponseViewer } from "./_response-viewer";
import { ResponseTrendChart } from "./_response-charts";

export default async function ResponsesPage({
  params,
}: {
  params: { id: string };
}) {
  const { coach } = await requireCoachSession();
  const questionnaire = await getQuestionnaireById(params.id, coach.id);

  if (!questionnaire) notFound();

  const [responses, scoreTrends] = await Promise.all([
    getQuestionnaireResponses(params.id, coach.id),
    getQuestionnaireScoreTrends(params.id, coach.id),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <ScrollProgressBar />
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={`/coach/questionnaires/${params.id}`}
            className="text-muted hover:text-[var(--foreground)] transition-colors"
            aria-label="Back to questionnaire"
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
            Responses — {questionnaire.title}
          </h1>
        </div>
        <p className="text-sm text-muted">
          {responses.length} response{responses.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Score trend chart (only shows if scoring enabled + has data) */}
      {questionnaire.scoringEnabled && scoreTrends.length > 0 && (
        <ResponseTrendChart trends={scoreTrends} />
      )}

      <ResponseViewer
        responses={responses}
        questions={questionnaire.questions}
        questionnaireType={questionnaire.type}
        scoringEnabled={questionnaire.scoringEnabled}
      />
    </div>
  );
}
