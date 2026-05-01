import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { getPR, getRecentThrows } from "@/lib/implements";

type RouteCtx = { params: Promise<{ athleteId: string; implementId: string }> };

/**
 * GET /api/athletes/:athleteId/prs/:implementId
 *
 * Returns the single AthleteImplementPR row + the 10 most recent throws for
 * this implement. Used on athlete detail / coach detail pages where one
 * implement is in focus.
 */
export async function GET(_request: NextRequest, ctx: RouteCtx) {
  try {
    const { athleteId, implementId } = await ctx.params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canAccessAthlete(session.userId, session.role, athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const [pr, recentThrows] = await Promise.all([
      getPR(athleteId, implementId),
      getRecentThrows(athleteId, implementId, 10),
    ]);

    return NextResponse.json({
      success: true,
      data: { pr, recentThrows },
    });
  } catch (error) {
    logger.error("GET /api/athletes/[athleteId]/prs/[implementId]", {
      context: "implements",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to load PR detail" },
      { status: 500 }
    );
  }
}
