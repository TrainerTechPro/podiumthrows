import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(_request: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const insight = await prisma.athleteInsight.findUnique({
      where: { id },
      select: { athleteId: true, readByCoachAt: true, readByAthleteAt: true },
    });
    if (!insight) {
      return NextResponse.json({ success: false, error: "Insight not found" }, { status: 404 });
    }

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        insight.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const data =
      currentUser.role === "COACH"
        ? { readByCoachAt: insight.readByCoachAt ?? new Date() }
        : { readByAthleteAt: insight.readByAthleteAt ?? new Date() };

    await prisma.athleteInsight.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    logger.error("Mark insight read error", { context: "insights/read", error });
    return NextResponse.json(
      { success: false, error: "Failed to mark insight read" },
      { status: 500 }
    );
  }
}
