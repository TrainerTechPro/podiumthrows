import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireAthleteSession, getSessionWithPrescription } from "@/lib/data/athlete";
import { parseSessionView, type SessionView } from "@/lib/sessions/types";
import { LiveTrainingSession } from "./live";
import { TrainingSessionRecap } from "./recap";
import { ProgramSessionView } from "./_program-session-view";

export const dynamic = "force-dynamic";

function defaultViewForTrainingSession(status: string): SessionView {
  return status === "COMPLETED" ? "recap" : "live";
}

export default async function AthleteSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { id } = await params;
  const { view: rawView } = await searchParams;
  const { session: authSession, athlete } = await requireAthleteSession();

  const trainingSession = await getSessionWithPrescription(athlete.id, id);

  if (trainingSession) {
    const requestedView = parseSessionView(rawView);
    if (requestedView == null) {
      const dv = defaultViewForTrainingSession(trainingSession.status);
      redirect(`/athlete/session/${id}?view=${dv}`);
    }

    if (requestedView === "recap") {
      const athleteFirstName = athlete.firstName?.trim() || "Athlete";
      return (
        <TrainingSessionRecap
          athleteId={athlete.id}
          athleteFirstName={athleteFirstName}
          sessionId={id}
        />
      );
    }

    return <LiveTrainingSession session={trainingSession} currentUserId={authSession.userId} />;
  }

  // ProgramSession fallback — Bondarchuk programs render at the same URL.
  // Independent ID space from TrainingSession but shares the route; read-only.
  const programSession = await prisma.programSession.findFirst({
    where: { id, program: { athleteId: athlete.id } },
    include: {
      program: { select: { event: true, startDate: true, gender: true } },
      phase: { select: { phase: true, phaseOrder: true } },
    },
  });

  if (!programSession) notFound();

  return <ProgramSessionView programSession={programSession} />;
}
