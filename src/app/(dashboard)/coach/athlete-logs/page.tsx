import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { AthleteLogsList } from "./_athlete-logs-client";

export default async function CoachAthleteLogsPage() {
  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!coach) redirect("/login");

  const sessions = await prisma.athleteThrowsSession.findMany({
    where: { athlete: { coachId: coach.id } },
    orderBy: { date: "desc" },
    take: 100,
    include: {
      drillLogs: { orderBy: { createdAt: "asc" } },
      athlete: { select: { firstName: true, lastName: true, id: true } },
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Athlete Session Logs
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Self-logged practice sessions from your athletes
        </p>
      </div>

      <AthleteLogsList sessions={JSON.parse(JSON.stringify(sessions))} />
    </div>
  );
}
