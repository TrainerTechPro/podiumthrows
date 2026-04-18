import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import {
  uploadSingleFile,
  saveFileLocally,
  generateAthleteVideoKey,
  getPublicUrl,
  isR2Configured,
  extractR2KeyFromUrl,
  deleteFile,
  ALLOWED_VIDEO_TYPES,
  MAX_VIDEO_SIZE_MB,
} from "@/lib/r2";

type RouteCtx = { params: Promise<{ id: string; throwLogId: string }> };

/**
 * Attach a video recording to a single competition throw.
 *
 * Multipart/form-data POST with `video` file field. Uploads to R2 (or local
 * fallback in dev) and writes the resulting URL onto ThrowLog.videoUrl.
 */
export async function POST(request: NextRequest, ctx: RouteCtx) {
  try {
    const { id: competitionId, throwLogId } = await ctx.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const throwRow = await prisma.throwLog.findUnique({
      where: { id: throwLogId },
      select: {
        id: true,
        athleteId: true,
        competitionId: true,
        videoUrl: true,
      },
    });
    if (!throwRow || throwRow.competitionId !== competitionId) {
      return NextResponse.json({ success: false, error: "Throw not found" }, { status: 404 });
    }
    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        throwRow.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("video") as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, error: "No video file provided" },
        { status: 400 }
      );
    }
    if (file.type && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Unsupported video type: ${file.type}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: `Video exceeds ${MAX_VIDEO_SIZE_MB}MB limit` },
        { status: 400 }
      );
    }

    const key = generateAthleteVideoKey(throwRow.athleteId, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    let publicUrl: string;
    if (isR2Configured()) {
      await uploadSingleFile(key, buffer, file.type || "video/mp4");
      publicUrl = getPublicUrl(key);
    } else {
      // Dev fallback — stores under public/uploads/
      publicUrl = await saveFileLocally(key, buffer);
    }

    // Replace a previous video on this throw (don't orphan the old file).
    const previousKey = throwRow.videoUrl ? extractR2KeyFromUrl(throwRow.videoUrl) : null;

    const updated = await prisma.throwLog.update({
      where: { id: throwLogId },
      data: { videoUrl: publicUrl },
      select: { id: true, videoUrl: true },
    });

    if (previousKey) {
      // Best-effort — never fail the upload if cleanup fails.
      deleteFile(previousKey).catch((err) =>
        logger.error("stale throw-video cleanup failed", {
          context: "competitions/throws/video",
          metadata: { previousKey },
          error: err,
        })
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error("Upload throw video error", {
      context: "competitions/throws/video",
      error,
    });
    return NextResponse.json({ success: false, error: "Failed to upload video" }, { status: 500 });
  }
}

/** Remove the video reference from a throw (and delete the underlying object). */
export async function DELETE(_request: NextRequest, ctx: RouteCtx) {
  try {
    const { id: competitionId, throwLogId } = await ctx.params;
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const throwRow = await prisma.throwLog.findUnique({
      where: { id: throwLogId },
      select: {
        athleteId: true,
        competitionId: true,
        videoUrl: true,
      },
    });
    if (!throwRow || throwRow.competitionId !== competitionId) {
      return NextResponse.json({ success: false, error: "Throw not found" }, { status: 404 });
    }
    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        throwRow.athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const previousKey = throwRow.videoUrl ? extractR2KeyFromUrl(throwRow.videoUrl) : null;

    await prisma.throwLog.update({
      where: { id: throwLogId },
      data: { videoUrl: null },
    });

    if (previousKey) {
      deleteFile(previousKey).catch((err) =>
        logger.error("throw-video cleanup failed", {
          context: "competitions/throws/video",
          metadata: { previousKey },
          error: err,
        })
      );
    }

    return NextResponse.json({ success: true, data: { id: throwLogId, videoUrl: null } });
  } catch (error) {
    logger.error("Delete throw video error", {
      context: "competitions/throws/video",
      error,
    });
    return NextResponse.json({ success: false, error: "Failed to remove video" }, { status: 500 });
  }
}
