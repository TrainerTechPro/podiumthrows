import { NextResponse } from "next/server";
import { requireAthleteSession, getAthleteAssignedQuestionnaires } from "@/lib/data/athlete";

export async function GET() {
  try {
    const { athlete } = await requireAthleteSession();
    const questionnaires = await getAthleteAssignedQuestionnaires(athlete.id);
    return NextResponse.json({ questionnaires });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
