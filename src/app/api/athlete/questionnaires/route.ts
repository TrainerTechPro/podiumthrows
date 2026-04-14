import { NextResponse } from "next/server";
import { requireAthleteSession, getAthleteAssignedQuestionnaires } from "@/lib/data/athlete";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { athlete } = await requireAthleteSession();
    const questionnaires = await getAthleteAssignedQuestionnaires(athlete.id);
    return NextResponse.json({ success: true, data: { questionnaires } });
  } catch (err) {
    logger.error("GET /api/athlete/questionnaires", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}
