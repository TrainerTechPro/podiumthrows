import { notFound, redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { AnalysisView, type AnalysisData } from "./_analysis-view";

export const metadata = { title: "Throw Analysis — Podium Throws" };

export default async function ThrowFlowResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let coach;
  try {
    const session = await requireCoachSession();
    coach = session.coach;
  } catch {
    redirect("/login");
  }

  const analysis = await prisma.throwAnalysis.findUnique({
    where: { id },
    include: {
      athlete: {
        include: { user: { select: { id: true, email: true } } },
      },
    },
  });

  if (!analysis || analysis.coachId !== coach.id) notFound();

  const initialAnalysis: AnalysisData = {
    id: analysis.id,
    event: analysis.event,
    drillType: analysis.drillType,
    cameraAngle: analysis.cameraAngle,
    athleteHeight: analysis.athleteHeight,
    implementWeight: analysis.implementWeight,
    knownDistance: analysis.knownDistance,
    phaseScores: parseJson(analysis.phaseScores, { phases: [] }).phases || [],
    energyLeaks: parseJson(analysis.energyLeaks, []),
    releaseMetrics: parseJson(analysis.releaseMetrics, null),
    overallScore: analysis.overallScore,
    issueCards: parseJson(analysis.issueCards, []),
    drillRecs: parseJson(analysis.drillRecs, []),
    rawAnalysis: analysis.rawAnalysis,
    frameCount: analysis.frameCount,
    videoDuration: analysis.videoDuration,
    status: analysis.status,
    errorMessage: analysis.errorMessage,
    createdAt: analysis.createdAt.toISOString(),
    athleteName: analysis.athlete?.user.email ?? null,
  };

  return <AnalysisView initialAnalysis={initialAnalysis} />;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
