import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, InsightComputeSchema } from "@/lib/api-schemas";
import { rateLimit } from "@/lib/rate-limit";
import { runInsights } from "@/lib/insights/runInsights";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const parsed = await parseBody(request, InsightComputeSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { athleteId } = parsed;

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // 1 request per 60 seconds per athlete
    const limit = await rateLimit(`insights:compute:${athleteId}`, {
      maxAttempts: 1,
      windowMs: 60_000,
    });
    if (!limit.success) {
      return NextResponse.json(
        { success: false, error: "Try again in a moment", retryAfter: limit.retryAfter },
        { status: 429 }
      );
    }

    const result = await runInsights({ athleteId, trigger: "ON_DEMAND" });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error("Compute insights error", { context: "insights/compute", error });
    return NextResponse.json(
      { success: false, error: "Couldn’t compute insights" },
      { status: 500 }
    );
  }
}
