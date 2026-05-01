import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { getRecentImplementsForAthlete, listImplements } from "@/lib/implements";

type RouteCtx = { params: Promise<{ athleteId: string }> };

/**
 * GET /api/athletes/:athleteId/implements
 *
 * Returns:
 *   recent — implements this athlete has thrown, most-recent-first (max 6)
 *   all    — full active catalog grouped by throwType, sorted
 *
 * Used by the throw entry picker. Pre-populates "recent" so an athlete who
 * always throws 7.26 kg + 6 kg sees those tiles first.
 */
export async function GET(_request: NextRequest, ctx: RouteCtx) {
  try {
    const { athleteId } = await ctx.params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await canAccessAthlete(session.userId, session.role, athleteId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const [recent, all] = await Promise.all([
      getRecentImplementsForAthlete(athleteId, 6),
      listImplements(),
    ]);

    return NextResponse.json({
      success: true,
      data: { recent, all },
    });
  } catch (error) {
    logger.error("GET /api/athletes/[athleteId]/implements", { context: "implements", error });
    return NextResponse.json(
      { success: false, error: "Failed to load implements" },
      { status: 500 }
    );
  }
}
