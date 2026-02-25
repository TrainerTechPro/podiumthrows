import Link from "next/link";
import {
  requireCoachSession,
  getAthletePickerList,
  getExerciseRecommendations,
  getLatestBondarchukAssessment,
} from "@/lib/data/coach";
import { ExerciseRecommender } from "./_exercise-recommender";

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function ProgrammingPage({
  searchParams,
}: {
  searchParams: { event?: string; athlete?: string };
}) {
  const { coach } = await requireCoachSession();

  // Fetch athlete list for picker
  const athletes = await getAthletePickerList(coach.id);

  // Pre-fetch recommendations if event is in searchParams
  const event = searchParams.event?.toUpperCase() ?? null;
  const validEvents = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];
  const selectedEvent = event && validEvents.includes(event) ? event : null;

  const initialRecommendations = selectedEvent
    ? await getExerciseRecommendations(selectedEvent, coach.id)
    : [];

  // Build assessment map for all athletes
  const assessmentEntries = await Promise.all(
    athletes.map(async (a) => {
      const assessment = await getLatestBondarchukAssessment(a.id);
      return [
        a.id,
        assessment
          ? { athleteType: assessment.athleteType, completedAt: assessment.completedAt }
          : null,
      ] as const;
    })
  );
  const assessments: Record<string, { athleteType: string; completedAt: string } | null> =
    Object.fromEntries(assessmentEntries);

  const initialAthleteId = searchParams.athlete ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/coach/throws"
              className="text-muted hover:text-[var(--foreground)] transition-colors"
              aria-label="Back to throws"
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
              Exercise Programming
            </h1>
          </div>
          <p className="text-sm text-muted">
            Exercises ranked by correlation to throwing performance. Use these to build training
            plans based on Bondarchuk methodology.
          </p>
        </div>
      </div>

      <ExerciseRecommender
        athletes={athletes}
        initialRecommendations={initialRecommendations}
        initialEvent={selectedEvent}
        initialAthleteId={initialAthleteId}
        assessments={assessments}
      />
    </div>
  );
}
