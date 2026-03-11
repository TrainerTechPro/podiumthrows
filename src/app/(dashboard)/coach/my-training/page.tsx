import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CoachTrainingList } from "./_coach-training-client";

export default async function CoachMyTrainingPage() {
  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!coach) redirect("/login");

  const sessions = await prisma.coachThrowsSession.findMany({
    where: { coachId: coach.id },
    orderBy: { date: "desc" },
    take: 100,
    include: { drillLogs: { orderBy: { createdAt: "asc" } } },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            My Training
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} logged
          </p>
        </div>
        <Link href="/coach/log-session" className="btn-primary whitespace-nowrap">
          + Log Session
        </Link>
      </div>

      <CoachTrainingList sessions={JSON.parse(JSON.stringify(sessions))} />
    </div>
  );
}
