import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession, getExerciseRecommendations } from "@/lib/data/coach";

const VALID_EVENTS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];

export async function GET(req: NextRequest) {
  try {
    const { coach } = await requireCoachSession();
    const event = req.nextUrl.searchParams.get("event");

    if (!event || !VALID_EVENTS.includes(event)) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid event parameter required (SHOT_PUT, DISCUS, HAMMER, JAVELIN)",
        },
        { status: 400 }
      );
    }

    const recommendations = await getExerciseRecommendations(event, coach.id);

    // eslint-disable-next-line no-restricted-syntax -- TODO(HIGH-03-follow-up): migrate to { success: true, data } envelope
    return NextResponse.json({ recommendations });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}
