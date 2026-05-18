import { NextResponse } from "next/server";
import { requireAthleteSession, getAthleteVideos } from "@/lib/data/athlete";

export async function GET() {
  try {
    const { athlete } = await requireAthleteSession();
    const videos = await getAthleteVideos(athlete.id);
    return NextResponse.json({ success: true, data: { videos } });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}
