import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession, getQuestionnaireResponses } from "@/lib/data/coach";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();
    const responses = await getQuestionnaireResponses(params.id, coach.id);
    return NextResponse.json({ responses });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
