import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, canActAsAthlete } from "@/lib/auth";
import { parseBody, DrillVideoViewSchema } from "@/lib/api-schemas";
import { logger } from "@/lib/logger";

/**
 * POST /api/drill-videos/views
 *
 * Records that the current athlete watched a drill clip. Powers the "unseen"
 * filter in /api/drill-videos/recommend and, via `recommendedFromId` +
 * `source`, the click-through-rate analytics for the WatchNextOverlay.
 *
 * Body: { drillVideoId, source?, recommendedFromId?, completed? }
 *
 * `source`:
 *   • "manual"         — athlete tapped a card in the gallery
 *   • "recommendation" — athlete tapped a card in the WatchNextOverlay
 *   • "autoplay"       — overlay's 5s countdown elapsed
 *
 * `recommendedFromId` is required when source is "recommendation" or
 * "autoplay". Without it we can't attribute the CTR.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }
    if (!(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(request, DrillVideoViewSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { drillVideoId, source, recommendedFromId, completed } = parsed;

    if ((source === "recommendation" || source === "autoplay") && !recommendedFromId) {
      return NextResponse.json(
        {
          success: false,
          error: "recommendedFromId is required for recommendation/autoplay views",
        },
        { status: 400 }
      );
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true },
    });
    if (!athlete) {
      return NextResponse.json(
        { success: false, error: "Athlete profile not found" },
        { status: 404 }
      );
    }

    // Verify the athlete is allowed to see this clip — own or same-coach
    // library. Without this check, an athlete could log views against
    // arbitrary IDs and pollute analytics.
    const accessible = await prisma.drillVideo.findFirst({
      where: {
        id: drillVideoId,
        OR: [{ athleteId: athlete.id }, { coachId: athlete.coachId, athleteId: null }],
      },
      select: { id: true },
    });
    if (!accessible) {
      return NextResponse.json({ success: false, error: "Drill video not found" }, { status: 404 });
    }

    const view = await prisma.drillVideoView.create({
      data: {
        athleteId: athlete.id,
        drillVideoId,
        source: source ?? "manual",
        recommendedFromId: recommendedFromId ?? null,
        completed: completed ?? false,
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, data: { id: view.id } });
  } catch (error) {
    logger.error("Drill view record error", { context: "drill-videos/views", error });
    return NextResponse.json({ success: false, error: "Couldn’t record view" }, { status: 500 });
  }
}
