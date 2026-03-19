import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { LiftingEmptyState } from "./_empty-state";
import { ProgramHeader } from "./_program-header";
import { WeekGrid } from "./_week-grid";

export default async function CoachMyLiftingPage() {
  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!coach) redirect("/login");

  // Fetch the active lifting program with phases, exercises, and workout logs
  const program = await prisma.liftingProgram.findFirst({
    where: { coachId: coach.id, status: "ACTIVE" },
    include: {
      phases: {
        include: {
          exercises: { orderBy: { order: "asc" } },
        },
        orderBy: { order: "asc" },
      },
      workoutLogs: {
        include: {
          exerciseLogs: { orderBy: { order: "asc" } },
        },
        orderBy: [{ weekNumber: "asc" }, { workoutNumber: "asc" }],
      },
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          My Lifting
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Track your strength training program
        </p>
      </div>

      {!program ? (
        <LiftingEmptyState />
      ) : (
        <>
          <ProgramHeader program={program} />
          <WeekGrid program={JSON.parse(JSON.stringify(program))} />
        </>
      )}
    </div>
  );
}
