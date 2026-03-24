import { redirect } from "next/navigation";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { canAccessSelfProgram } from "@/lib/authorize";
import prisma from "@/lib/prisma";
import { SelfProgramWizard } from "./_wizard";

export default async function SelfProgramCreatePage({
  searchParams,
}: {
  searchParams: { draft?: string };
}) {
  const session = await getSession();
  if (!session || !(await canActAsAthlete(session))) redirect("/login");
  if (!(await canAccessSelfProgram(session.userId))) redirect("/athlete/self-program");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      events: true,
      gender: true,
      weightKg: true,
      performanceBenchmarks: true,
      throwsTyping: {
        select: {
          adaptationGroup: true,
          transferType: true,
          recoveryProfile: true,
          selfFeelingAccuracy: true,
          recommendedMethod: true,
          estimatedSessionsToForm: true,
        },
      },
      equipmentInventory: { select: { implements: true } },
      coachId: true,
    },
  });
  if (!athlete) redirect("/login");

  let draft = null;
  if (searchParams.draft) {
    draft = await prisma.selfProgramConfig.findFirst({
      where: { id: searchParams.draft, athleteProfileId: athlete.id, isDraft: true },
    });
  }

  // Fetch latest ThrowsPRs for auto-prefill (best distance per event)
  const throwsPRs = await prisma.throwsPR.findMany({
    where: { athleteId: athlete.id },
    orderBy: { distance: "desc" },
  });

  // Find the most recent completed SelfProgramConfig for prefill
  // (years of experience, competition level, etc. from their last program)
  const previousConfig = await prisma.selfProgramConfig.findFirst({
    where: { athleteProfileId: athlete.id, isDraft: false },
    orderBy: { createdAt: "desc" },
    select: {
      yearsExperience: true,
      competitionLevel: true,
      currentWeeklyVolume: true,
      daysPerWeek: true,
      sessionsPerDay: true,
      preferredDays: true,
      primaryGoal: true,
      generationMode: true,
      programType: true,
    },
  });

  const exercises = await prisma.exercise.findMany({
    where: {
      OR: [
        { isGlobal: true },
        { coachId: athlete.coachId },
        { athleteProfileId: athlete.id },
      ],
    },
    select: { id: true, name: true, category: true, event: true, implementWeight: true },
    orderBy: { name: "asc" },
  });

  // Build prefill data from profile + PRs + previous config
  const bestPR = throwsPRs.length > 0 ? throwsPRs[0] : null;
  const prefill = {
    currentPR: bestPR?.distance ?? null,
    yearsExperience: previousConfig?.yearsExperience ?? null,
    competitionLevel: previousConfig?.competitionLevel ?? null,
    currentWeeklyVolume: previousConfig?.currentWeeklyVolume ?? null,
    daysPerWeek: previousConfig?.daysPerWeek ?? null,
    sessionsPerDay: previousConfig?.sessionsPerDay ?? null,
    preferredDays: previousConfig?.preferredDays ?? null,
    primaryGoal: previousConfig?.primaryGoal ?? null,
    generationMode: previousConfig?.generationMode ?? null,
    programType: previousConfig?.programType ?? null,
    performanceBenchmarks: athlete.performanceBenchmarks ?? null,
  };

  return (
    <SelfProgramWizard
      athleteId={athlete.id}
      athleteEvents={athlete.events}
      athleteGender={athlete.gender}
      athleteWeightKg={athlete.weightKg}
      hasTypingData={!!athlete.throwsTyping}
      existingImplements={athlete.equipmentInventory?.implements ?? null}
      exercises={exercises}
      draft={draft}
      prefill={prefill}
    />
  );
}
