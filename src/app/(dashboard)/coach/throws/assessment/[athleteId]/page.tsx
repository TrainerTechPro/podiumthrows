import Link from "next/link";
import { notFound } from "next/navigation";
import {
  requireCoachSession,
  getAthleteBondarchukAssessments,
  getLatestBondarchukAssessment,
  getExerciseRecommendations,
} from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { AssessmentWizard } from "./_assessment-wizard";
import { AssessmentHistory } from "./_assessment-history";

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function AssessmentPage({
  params,
}: {
  params: { athleteId: string };
}) {
  const { coach } = await requireCoachSession();

  // Verify athlete belongs to this coach
  const athlete = await prisma.athleteProfile.findFirst({
    where: { id: params.athleteId, coachId: coach.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      events: true,
    },
  });

  if (!athlete) notFound();

  const athleteName = `${athlete.firstName} ${athlete.lastName}`;
  const primaryEvent = (athlete.events as string[])[0] ?? "SHOT_PUT";

  // Fetch data in parallel
  const [assessments, latestAssessment, exercises] = await Promise.all([
    getAthleteBondarchukAssessments(athlete.id, coach.id),
    getLatestBondarchukAssessment(athlete.id),
    getExerciseRecommendations(primaryEvent, coach.id),
  ]);

  // Map exercises to what the wizard needs
  const exerciseOptions = exercises.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    correlation: e.correlation,
  }));

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/coach/throws"
          className="text-sm text-muted hover:text-[var(--foreground)] transition-colors mb-2 inline-flex items-center gap-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Throws
        </Link>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Bondarchuk Assessment
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Determine training type for {athleteName}
        </p>
      </div>

      {/* Wizard */}
      <section className="card p-6">
        <AssessmentWizard
          athleteId={athlete.id}
          athleteName={athleteName}
          exercises={exerciseOptions}
          previousType={latestAssessment?.athleteType ?? null}
        />
      </section>

      {/* History */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Assessment History
        </h2>
        <AssessmentHistory
          assessments={assessments.map((a) => ({
            ...a,
            results: a.results as Record<string, { exerciseName: string; category: string; correlation: number }>,
          }))}
        />
      </section>
    </div>
  );
}
