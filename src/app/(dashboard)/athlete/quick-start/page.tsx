import { redirect } from "next/navigation";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Smart-routing redirect page for the Quick Actions "Start Session" button.
 *
 * Priority order:
 * 1. In-progress throws assignment → resume live workout
 * 2. Next planned self-program session → open session detail (can start from there)
 * 3. Pending coach-assigned assignment → start it
 * 4. Fallback → ad-hoc session logger (custom/self-directed)
 */
export default async function QuickStartPage() {
  const session = await getSession();
  if (!session || !(await canActAsAthlete(session))) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, isSelfCoached: true },
  });
  if (!athlete) redirect("/login");

  /* ── 1. Resume in-progress workout ─────────────────────────────────── */

  const inProgress = await prisma.throwsAssignment.findFirst({
    where: { athleteId: athlete.id, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (inProgress) {
    redirect(`/athlete/throws/live/${inProgress.id}`);
  }

  /* ── 2. Next self-program session ──────────────────────────────────── */

  if (athlete.isSelfCoached) {
    const config = await prisma.selfProgramConfig.findFirst({
      where: {
        athleteProfileId: athlete.id,
        isActive: true,
        isDraft: false,
      },
      select: { trainingProgramId: true },
    });

    if (config?.trainingProgramId) {
      const nextSession = await prisma.programSession.findFirst({
        where: {
          programId: config.trainingProgramId,
          status: "PLANNED",
        },
        orderBy: [{ weekNumber: "asc" }, { dayOfWeek: "asc" }],
        select: { id: true },
      });
      if (nextSession) {
        redirect(
          `/athlete/self-program/${config.trainingProgramId}/session/${nextSession.id}`,
        );
      }
    }
  }

  /* ── 3. Pending coach-assigned session ─────────────────────────────── */

  const pending = await prisma.throwsAssignment.findFirst({
    where: {
      athleteId: athlete.id,
      status: { in: ["ASSIGNED", "NOTIFIED"] },
    },
    orderBy: { assignedDate: "asc" },
    select: { id: true },
  });
  if (pending) {
    redirect(`/athlete/throws/live/${pending.id}`);
  }

  /* ── 4. Fallback — custom session ──────────────────────────────────── */

  redirect("/athlete/log-session");
}
