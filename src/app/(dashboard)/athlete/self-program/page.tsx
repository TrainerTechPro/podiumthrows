import { redirect } from "next/navigation";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { SelfProgramHub } from "./_hub";

export default async function SelfProgramPage() {
  const session = await getSession();
  if (!session || !(await canActAsAthlete(session))) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, isSelfCoached: true, events: true },
  });
  if (!athlete) redirect("/login");

  if (!athlete.isSelfCoached) {
    return <SelfProgramHub state="blocked" />;
  }

  // Check for active program
  const activeConfig = await prisma.selfProgramConfig.findFirst({
    where: { athleteProfileId: athlete.id, isActive: true, isDraft: false },
    include: {
      trainingProgram: {
        include: {
          phases: { orderBy: { phaseOrder: "asc" } },
          sessions: {
            select: {
              id: true,
              status: true,
              scheduledDate: true,
              sessionType: true,
              focusLabel: true,
              estimatedDuration: true,
              weekNumber: true,
            },
          },
        },
      },
    },
  });

  // Check for draft
  const draft = await prisma.selfProgramConfig.findFirst({
    where: { athleteProfileId: athlete.id, isDraft: true, isActive: true },
    select: { id: true, updatedAt: true, event: true },
  });

  const eventMismatch =
    activeConfig != null &&
    !athlete.events.includes(activeConfig.event as (typeof athlete.events)[number]);

  return (
    <SelfProgramHub
      state={activeConfig ? "active" : draft ? "draft" : "empty"}
      config={activeConfig ? JSON.parse(JSON.stringify(activeConfig)) : null}
      draft={draft ? JSON.parse(JSON.stringify(draft)) : null}
      eventMismatch={eventMismatch ?? false}
    />
  );
}
