import { redirect } from "next/navigation";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { SessionDetail } from "./_session-detail";

export default async function ProgramSessionPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const session = await getSession();
  if (!session || !(await canActAsAthlete(session))) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!athlete) redirect("/login");

  const { id: configId, sessionId } = await params;

  // Verify config ownership
  const config = await prisma.selfProgramConfig.findUnique({
    where: { id: configId },
    select: { athleteProfileId: true, trainingProgramId: true, event: true },
  });
  if (!config || config.athleteProfileId !== athlete.id) {
    redirect("/athlete/self-program");
  }

  // Load the session with its phase info
  const programSession = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: {
      phase: {
        select: { phase: true, phaseOrder: true, startWeek: true, endWeek: true },
      },
      program: {
        select: { startDate: true, event: true, gender: true, daysPerWeek: true },
      },
    },
  });

  if (!programSession || programSession.program.event !== config.event) {
    redirect(`/athlete/self-program/${configId}`);
  }

  // If IN_PROGRESS, redirect to live workout or auto-fix status
  if (programSession.status === "IN_PROGRESS") {
    const throwsSession = await prisma.throwsSession.findFirst({
      where: { tags: { contains: `selfProgram:${sessionId}` } },
      include: {
        assignments: {
          where: { athleteId: athlete.id },
          select: { id: true, status: true },
          take: 1,
        },
      },
    });

    const assignment = throwsSession?.assignments[0];
    if (assignment) {
      if (assignment.status === "IN_PROGRESS" || assignment.status === "ASSIGNED") {
        // Active workout — redirect to live view
        redirect(`/athlete/throws/live/${assignment.id}`);
      } else {
        // Assignment is COMPLETED/PARTIAL/SKIPPED but ProgramSession wasn't updated — auto-fix
        await prisma.programSession.update({
          where: { id: sessionId },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        // Refresh to show completed state
        programSession.status = "COMPLETED";
      }
    }
    // If no ThrowsSession exists at all, fall through to show session detail
    // (the Reset button is the escape hatch)
  }

  // Compute scheduled date if not set
  let scheduledDate = programSession.scheduledDate;
  if (!scheduledDate && programSession.program.startDate) {
    const start = new Date(programSession.program.startDate);
    const d = new Date(start);
    d.setDate(d.getDate() + (programSession.weekNumber - 1) * 7 + (programSession.dayOfWeek - 1));
    scheduledDate = d.toISOString().slice(0, 10);
  }

  // Get adjacent sessions for prev/next navigation
  const allSessions = await prisma.programSession.findMany({
    where: { programId: programSession.programId },
    select: { id: true, weekNumber: true, dayOfWeek: true },
    orderBy: [{ weekNumber: "asc" }, { dayOfWeek: "asc" }],
  });

  const currentIdx = allSessions.findIndex((s) => s.id === sessionId);
  const prevSessionId = currentIdx > 0 ? allSessions[currentIdx - 1].id : null;
  const nextSessionId = currentIdx < allSessions.length - 1 ? allSessions[currentIdx + 1].id : null;

  return (
    <SessionDetail
      configId={configId}
      session={JSON.parse(JSON.stringify(programSession))}
      scheduledDate={scheduledDate}
      prevSessionId={prevSessionId}
      nextSessionId={nextSessionId}
    />
  );
}
