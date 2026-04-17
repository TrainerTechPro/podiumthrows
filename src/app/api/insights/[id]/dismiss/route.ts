import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, InsightDismissSchema } from "@/lib/api-schemas";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const insight = await prisma.athleteInsight.findUnique({
      where: { id },
      select: { athleteId: true },
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

    const parsed = await parseBody(request, InsightDismissSchema);
    if (parsed instanceof NextResponse) return parsed;

    const dismissedAt = parsed.undismiss ? null : new Date();
    const updated = await prisma.athleteInsight.update({
      where: { id },
      data: { dismissedAt },
      select: { id: true, dismissedAt: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        dismissedAt: updated.dismissedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    logger.error("Dismiss insight error", { context: "insights/dismiss", error });
    return NextResponse.json(
      { success: false, error: "Failed to update dismiss state" },
      { status: 500 }
    );
  }
}
