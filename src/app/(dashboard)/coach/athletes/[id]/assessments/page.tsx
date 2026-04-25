import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  requireCoachSession,
  getAthleteBondarchukAssessments,
  getLatestBondarchukAssessment,
  getExerciseRecommendations,
} from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { AssessmentWizard } from "../../../throws/assessment/[athleteId]/_assessment-wizard";
import { AssessmentHistory } from "../../../throws/assessment/[athleteId]/_assessment-history";

export const metadata = { title: "Assessments — Podium Throws" };

/**
 * Per-athlete Bondarchuk assessment surface, lifted from
 * /coach/throws/assessment/[athleteId] into the canonical athlete-detail
 * namespace. Same fetches, same components — just a path that names what
 * it is (an athlete sub-page) instead of where it came from (Throws section).
 *
 * Commit 5 redirects /coach/throws/assessment/[athleteId] → here.
 */
export default async function CoachAthleteAssessmentsPage({ params }: { params: { id: string } }) {
  const { coach } = await requireCoachSession();

  const athlete = await prisma.athleteProfile.findFirst({
    where: { id: params.id, coachId: coach.id },
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

  const [assessments, latestAssessment, exercises] = await Promise.all([
    getAthleteBondarchukAssessments(athlete.id, coach.id),
    getLatestBondarchukAssessment(athlete.id),
    getExerciseRecommendations(primaryEvent, coach.id),
  ]);

  const exerciseOptions = exercises.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    correlation: e.correlation,
  }));

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <Link
          href={`/coach/athletes/${athlete.id}`}
          className="text-sm text-muted hover:text-[var(--foreground)] transition-colors mb-2 inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Back to {athlete.firstName}
        </Link>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Bondarchuk Assessment
        </h1>
        <p className="text-sm text-muted mt-0.5">Determine training type for {athleteName}</p>
      </div>

      <section className="card p-6">
        <AssessmentWizard
          athleteId={athlete.id}
          athleteName={athleteName}
          exercises={exerciseOptions}
          previousType={latestAssessment?.athleteType ?? null}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Assessment History
        </h2>
        <AssessmentHistory
          assessments={assessments.map((a) => ({
            ...a,
            results: a.results as Record<
              string,
              { exerciseName: string; category: string; correlation: number }
            >,
          }))}
        />
      </section>
    </div>
  );
}
