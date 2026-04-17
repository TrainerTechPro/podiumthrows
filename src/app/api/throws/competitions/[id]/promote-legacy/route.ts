import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const meet = await prisma.throwsCompetition.findUnique({
      where: { id },
      select: { athleteId: true, event: true, result: true },
    });
    if (!meet) {
      return NextResponse.json({ success: false, error: "Competition not found" }, { status: 404 });
    }
    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", meet.athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (meet.result == null) {
      return NextResponse.json(
        { success: false, error: "No legacy result to promote" },
        { status: 400 }
      );
    }

    const profile = await prisma.athleteProfile.findUnique({
      where: { id: meet.athleteId },
      select: { competitionPRs: true },
    });
    if (!profile) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const current = (profile.competitionPRs as Record<string, number | null> | null) ?? {};
    const existing = typeof current[meet.event] === "number" ? (current[meet.event] as number) : 0;

    if (meet.result <= existing) {
      // Idempotent: stored value is already higher or equal — nothing to do
      return NextResponse.json({ success: true, data: { competitionPRs: current, promoted: false } });
    }

    const updated = { ...current, [meet.event]: meet.result };
    await prisma.athleteProfile.update({
      where: { id: meet.athleteId },
      data: { competitionPRs: updated },
    });

    return NextResponse.json({ success: true, data: { competitionPRs: updated, promoted: true } });
  } catch (error) {
    logger.error("Promote legacy result error", { context: "competitions/promote-legacy", error });
    return NextResponse.json({ success: false, error: "Failed to promote legacy result" }, { status: 500 });
  }
}
