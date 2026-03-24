import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { LiveWorkout } from "./_live-workout";

export default async function LiveWorkoutPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;

  const currentUser = await getCurrentUser();
  if (!currentUser) notFound();

  const user = await prisma.user.findUnique({
    where: { id: currentUser.userId },
    include: { athleteProfile: { select: { id: true } } },
  });
  if (!user?.athleteProfile) notFound();

  const assignment = await prisma.throwsAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      session: {
        include: { blocks: { orderBy: { position: "asc" } } },
      },
      throwLogs: { orderBy: { throwNumber: "asc" } },
    },
  });

  if (!assignment || assignment.athleteId !== user.athleteProfile.id) notFound();

  // Reject completed/skipped assignments
  if (assignment.status === "COMPLETED" || assignment.status === "SKIPPED") {
    notFound();
  }

  // Serialize for client
  const data = {
    assignmentId: assignment.id,
    status: assignment.status,
    sessionName: assignment.session.name,
    event: assignment.session.event,
    sessionType: assignment.session.sessionType,
    blocks: assignment.session.blocks.map((b) => ({
      id: b.id,
      blockType: b.blockType,
      position: b.position,
      config: b.config,
    })),
    existingThrowLogs: assignment.throwLogs.map((tl) => ({
      id: tl.id,
      blockId: tl.blockId,
      throwNumber: tl.throwNumber,
      distance: tl.distance,
      implement: tl.implement,
    })),
    startedAt: assignment.startedAt?.toISOString() ?? null,
  };

  return <LiveWorkout data={data} />;
}
