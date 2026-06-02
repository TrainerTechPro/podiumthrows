import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getTeamFiles } from "@/lib/data/team-hub";
import { toServeUrl } from "@/lib/r2";

/* ─── GET — list team files visible to the authenticated athlete ─────────── */

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { coachId: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found." }, { status: 404 });
    }

    // Athletes see their coach's files (read-only)
    const rows = await getTeamFiles(athlete.coachId);
    const data = await Promise.all(
      rows.map(async (f) => ({
        ...f,
        fileUrl: (await toServeUrl(f.fileUrl, { key: f.fileKey })) ?? f.fileUrl,
      }))
    );
    return NextResponse.json({ success: true, data });
  } catch (err) {
    logger.error("GET /api/athlete/team-files", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t fetch team files." },
      { status: 500 }
    );
  }
}
