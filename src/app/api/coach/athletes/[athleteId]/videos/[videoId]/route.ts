import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoachAthlete } from "@/lib/data/coach";
import { deleteFile } from "@/lib/r2";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ athleteId: string; videoId: string }> }
) {
  const { athleteId, videoId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const video = await prisma.athleteVideo.findFirst({
    where: { id: videoId, athleteProfileId: athleteId },
  });
  if (!video) {
    return NextResponse.json(
      { success: false, error: "Video not found" },
      { status: 404 }
    );
  }

  // Only allow delete if coach uploaded it or profile is unclaimed
  const isClaimed = ctx.athlete.user.claimedAt != null;
  if (isClaimed && video.uploadedById !== ctx.coach.id) {
    return NextResponse.json(
      { success: false, error: "Cannot delete athlete-uploaded videos on claimed profiles" },
      { status: 403 }
    );
  }

  // Delete from R2 and DB
  try {
    await deleteFile(video.r2Key);
  } catch {
    // Log but don't fail — DB record should still be cleaned up
    console.error(`Failed to delete R2 object: ${video.r2Key}`);
  }

  await prisma.athleteVideo.delete({ where: { id: videoId } });

  return NextResponse.json({ success: true, data: { deleted: videoId } });
}
