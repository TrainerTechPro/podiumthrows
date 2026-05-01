import { redirect } from "next/navigation";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { canAccessSelfProgram } from "@/lib/authorize";
import prisma from "@/lib/prisma";
import { COMPETITION_WEIGHTS, EVENT_CODE_MAP } from "@/lib/throws/constants";
import type { ThrowEvent, EventCode, GenderCode } from "@/lib/throws/constants";
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

  // Fetch catalog-keyed PRs for auto-prefill (best distance per implement).
  // Reshape to the legacy {event, implement, distance} contract that the
  // prefill logic below already consumes — uniqueness on
  // (athleteId, implementId) eliminates the duplicate-label rows that
  // could confuse the comp-implement match.
  const catalogPRs = await prisma.athleteImplementPR.findMany({
    where: { athleteId: athlete.id, bestDistance: { not: null } },
    orderBy: { bestDistance: "desc" },
    include: {
      implement: { select: { throwType: true, displayLabel: true, weightKg: true } },
    },
  });
  const throwsPRs = catalogPRs.map((pr) => ({
    event: pr.implement.throwType === "SHOT" ? "SHOT_PUT" : pr.implement.throwType,
    implement: pr.implement.displayLabel,
    weightKg: pr.implement.weightKg,
    distance: pr.bestDistance!,
  }));

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
      OR: [{ isGlobal: true }, { coachId: athlete.coachId }, { athleteProfileId: athlete.id }],
    },
    select: { id: true, name: true, category: true, event: true, implementWeight: true },
    orderBy: { name: "asc" },
  });

  // Find competition-implement PR for the athlete's primary event.
  // Competition weight is the standard implement (e.g. 7.26kg for men's shot).
  // Match on numeric kg (with 0.05 kg tolerance) instead of string equality —
  // catalog labels are "7.26 kg" with a space, but the legacy compImplementStr
  // is "7.26kg" without; comparing weightKg is robust to both.
  const primaryEvent = (athlete.events[0] ?? "SHOT_PUT") as ThrowEvent;
  const eventCode = EVENT_CODE_MAP[primaryEvent] as EventCode;
  const genderCode = (athlete.gender === "MALE" ? "M" : "F") as GenderCode;
  const compWeight = COMPETITION_WEIGHTS[eventCode]?.[genderCode];

  // Prefer the competition implement PR; fall back to any PR for this event
  const compPR = compWeight
    ? throwsPRs.find((pr) => pr.event === primaryEvent && Math.abs(pr.weightKg - compWeight) < 0.05)
    : null;
  const eventPR = !compPR ? throwsPRs.find((pr) => pr.event === primaryEvent) : null;
  const bestPR = compPR ?? eventPR ?? null;

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
      userId={session.userId}
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
