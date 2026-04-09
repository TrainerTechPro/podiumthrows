import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession, getQuestionnaireResponses } from "@/lib/data/coach";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { coach } = await requireCoachSession();
    const { id } = await params;
    const responses = await getQuestionnaireResponses(id, coach.id);
    return NextResponse.json({ success: true, data: { responses } });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}
