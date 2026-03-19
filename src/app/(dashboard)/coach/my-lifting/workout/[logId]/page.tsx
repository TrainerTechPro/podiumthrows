import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { WorkoutClient } from "./_workout-client";

export default async function WorkoutLoggerPage({
  params,
}: {
  params: Promise<{ logId: string }>;
}) {
  const { logId } = await params;
  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!coach) redirect("/login");

  const workoutLog = await prisma.liftingWorkoutLog.findFirst({
    where: { id: logId, coachId: coach.id },
    include: {
      program: { select: { name: true, rpeTargets: true } },
      phase: { select: { name: true, method: true } },
      exerciseLogs: {
        orderBy: { order: "asc" },
        include: {
          programExercise: {
            select: {
              prescribedSets: true,
              prescribedReps: true,
              prescribedDuration: true,
              isIsometric: true,
            },
          },
        },
      },
    },
  });

  if (!workoutLog) redirect("/coach/my-lifting");

  return <WorkoutClient workoutLog={JSON.parse(JSON.stringify(workoutLog))} />;
}
