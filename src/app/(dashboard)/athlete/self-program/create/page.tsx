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
    />
  );
}
