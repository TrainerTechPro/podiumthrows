import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { notifyAthleteVideoShared } from "@/lib/notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    // Verify ownership
    const video = await prisma.videoUpload.findFirst({
      where: { id: id, coachId: coach.id },
      select: { id: true, sharedWithAthletes: true, title: true },
    });

    if (!video) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    const body = await req.json();
    const { athleteIds } = body as { athleteIds?: string[] };

    if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "athleteIds must be a non-empty array" },
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
        { success: false, error: "No valid athletes found" },
        { status: 400 }
      );
    }

    // Merge with existing shared athletes (deduplicate). Capture the diff
    // up front so only newly-added athletes get notified — re-saving the
    // share with the same recipient shouldn't re-notify.
    const existingSet = new Set(video.sharedWithAthletes);
    const newlyAdded = validIds.filter((aid) => !existingSet.has(aid));
    for (const aid of validIds) existingSet.add(aid);

    await prisma.videoUpload.update({
      where: { id: id },
      data: { sharedWithAthletes: Array.from(existingSet) },
    });

    // Fire-and-forget notifications only for newly-added athletes.
    if (newlyAdded.length > 0) {
      void Promise.allSettled(
        newlyAdded.map((aid) => notifyAthleteVideoShared(aid, video.id, video.title))
      ).then((results) => {
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed > 0) {
          logger.error("video share: some notifications failed", {
            context: "api",
            metadata: { failures: failed, total: results.length },
          });
        }
      });
    }

    // eslint-disable-next-line no-restricted-syntax -- TODO(HIGH-03-follow-up): migrate to { success: true, data } envelope
    return NextResponse.json({
      shared: validIds.length,
      total: existingSet.size,
      newlyNotified: newlyAdded.length,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("videos/[id]/share POST Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
