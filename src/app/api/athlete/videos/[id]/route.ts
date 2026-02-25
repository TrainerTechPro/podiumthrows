import { NextRequest, NextResponse } from "next/server";
import {
  requireAthleteSession,
  getAthleteVideoById,
} from "@/lib/data/athlete";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { athlete } = await requireAthleteSession();
    const video = await getAthleteVideoById(params.id, athlete.id);

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({ video });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
