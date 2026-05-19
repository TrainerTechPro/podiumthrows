import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { getPRsForAthlete } from "@/lib/implements";

type RouteCtx = { params: Promise<{ athleteId: string }> };

/**
 * GET /api/athletes/:athleteId/prs
 *
 * Returns the catalog-keyed AthleteImplementPR rows for this athlete, one
 * per implement they've thrown. Reads from the materialized table — never
 * recomputes from raw ThrowLog.
 *
 * Distinct from the legacy /api/athletes/:athleteId/personal-records which
 * reads ThrowsPR. That endpoint stays during the migration window; this is
 * the new source of truth.
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

    const prs = await getPRsForAthlete(athleteId);
    return NextResponse.json({ success: true, data: prs });
  } catch (error) {
    logger.error("GET /api/athletes/[athleteId]/prs", { context: "implements", error });
    return NextResponse.json({ success: false, error: "Couldn’t load PRs" }, { status: 500 });
  }
}
