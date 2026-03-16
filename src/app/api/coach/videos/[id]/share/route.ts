import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachApi();

    // Verify ownership
    const video = await prisma.videoUpload.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true, sharedWithAthletes: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const body = await req.json();
    const { athleteIds } = body as { athleteIds?: string[] };

    if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
      return NextResponse.json(
        { error: "athleteIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Verify all athletes belong to this coach
    const athletes = await prisma.athleteProfile.findMany({
      where: { id: { in: athleteIds }, coachId: coach.id },
      select: { id: true },
    });

    const validIds = athletes.map((a) => a.id);
    if (validIds.length === 0) {
      return NextResponse.json(
        { error: "No valid athletes found" },
        { status: 400 }
      );
    }

    // Merge with existing shared athletes (deduplicate)
    const existingSet = new Set(video.sharedWithAthletes);
    for (const id of validIds) existingSet.add(id);

    await prisma.videoUpload.update({
      where: { id: params.id },
      data: { sharedWithAthletes: Array.from(existingSet) },
    });

    return NextResponse.json({
      shared: validIds.length,
      total: existingSet.size,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("videos/[id]/share POST Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
