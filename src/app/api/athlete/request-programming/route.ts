import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyCoachProgrammingRequested } from "@/lib/notifications";

const COOLDOWN_MS = 48 * 60 * 60 * 1000; // 48 hours

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      coachId: true,
      events: true,
    },
  });

  if (!athlete) {
    return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
  }

  // Check cooldown — find last PROGRAMMING_REQUESTED notification
  const lastRequest = await prisma.notification.findFirst({
    where: {
      type: "PROGRAMMING_REQUESTED",
      athleteProfileId: athlete.id,
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (lastRequest) {
    const elapsed = Date.now() - lastRequest.createdAt.getTime();
    if (elapsed < COOLDOWN_MS) {
      const cooldownUntil = new Date(lastRequest.createdAt.getTime() + COOLDOWN_MS).toISOString();
      return NextResponse.json(
        {
          success: false,
          error: "Cooldown active",
          cooldownUntil,
        },
        { status: 429 }
      );
    }
  }

  // Gather context data for the notification
  const [lastSession, latestReadiness, recentPRs, activeGoals, throwsTyping] = await Promise.all([
    // Most recent completed session (any source)
    prisma.programSession.findFirst({
      where: { program: { athleteId: athlete.id }, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, scheduledDate: true },
    }),

    // Latest readiness check-in
    prisma.readinessCheckIn.findFirst({
      where: { athleteId: athlete.id },
      orderBy: { date: "desc" },
      select: { overallScore: true },
    }),

    // Recent PRs (catalog-keyed; reshaped to the legacy
    // {event, distance, implement} contract the notification code expects).
    prisma.athleteImplementPR
      .findMany({
        where: { athleteId: athlete.id, bestDistance: { not: null } },
        orderBy: { bestDistance: "desc" },
        take: 3,
        include: {
          implement: { select: { throwType: true, displayLabel: true } },
        },
      })
      .then((rows) =>
        rows.map((pr) => ({
          event: pr.implement.throwType === "SHOT" ? "SHOT_PUT" : pr.implement.throwType,
          distance: pr.bestDistance!,
          implement: pr.implement.displayLabel,
        }))
      ),

    // Active goals
    prisma.goal.findMany({
      where: { athleteId: athlete.id, status: "ACTIVE" },
      take: 3,
      select: { title: true, targetValue: true, currentValue: true },
    }),

    // Bondarchuk typing — ThrowsTyping model has the classification data.
    // ThrowsProfile has no primaryType field; use recommendedMethod from ThrowsTyping.
    prisma.throwsTyping.findUnique({
      where: { athleteId: athlete.id },
      select: { recommendedMethod: true },
    }),
  ]);

  // Compute days since last session
  let lastSessionDate: string | null = null;
  let daysSince: number | null = null;
  if (lastSession) {
    const dateStr =
      lastSession.scheduledDate ?? lastSession.completedAt?.toISOString().slice(0, 10);
    if (dateStr) {
      lastSessionDate = typeof dateStr === "string" ? dateStr : null;
      const lastDate = new Date(dateStr + "T12:00:00");
      daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  const athleteName = `${athlete.firstName} ${athlete.lastName}`;

  // Cast EventType[] to string[] for the notification context
  const events = athlete.events as string[];

  await notifyCoachProgrammingRequested(athlete.coachId, athlete.id, athleteName, {
    events,
    lastSessionDate,
    daysSinceLastSession: daysSince,
    readinessScore: latestReadiness?.overallScore ?? null,
    recentPRs: recentPRs.map((pr) => ({
      event: pr.event,
      distance: pr.distance,
      implement: pr.implement,
    })),
    goals: activeGoals.map((g) => ({
      title: g.title,
      progress: g.targetValue > 0 ? Math.round((g.currentValue / g.targetValue) * 100) : 0,
    })),
    // ThrowsTyping.recommendedMethod is the closest Bondarchuk classification field
    bondarchukType: throwsTyping?.recommendedMethod ?? null,
  });

  const cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString();

  return NextResponse.json({ success: true, cooldownUntil });
}
