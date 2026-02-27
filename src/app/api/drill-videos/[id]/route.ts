import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isR2Configured, deleteObject, extractR2KeyFromUrl } from "@/lib/r2";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const video = await prisma.drillVideo.findUnique({ where: { id: params.id } });
    if (!video) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    // Access check
    if (currentUser.role === "ATHLETE") {
      const profile = await prisma.athleteProfile.findUnique({
        where: { userId: currentUser.userId },
        select: { id: true },
      });
      if (!profile || video.athleteId !== profile.id) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    } else if (currentUser.role === "COACH") {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: currentUser.userId },
        select: { id: true },
      });
      if (!coachProfile) {
        return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
      }
      // Coach must own the video or be the coach of the athlete
      if (video.coachId !== coachProfile.id && video.athleteId) {
        const athlete = await prisma.athleteProfile.findUnique({
          where: { id: video.athleteId },
          select: { coachId: true },
        });
        if (athlete?.coachId !== coachProfile.id) {
          return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const isLocal = !video.filePath.startsWith("http");
    const videoUrl = isLocal ? `/api/drill-videos/serve?id=${video.id}` : video.filePath;

    return NextResponse.json({ success: true, data: { ...video, videoUrl } });
  } catch (error) {
    logger.error("Get drill video error", { context: "drill-videos", error: error });
    return NextResponse.json({ success: false, error: "Failed to get drill video" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const video = await prisma.drillVideo.findUnique({ where: { id: params.id } });
    if (!video) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    // Access check — only uploader or their coach can delete
    if (currentUser.role === "ATHLETE") {
      const profile = await prisma.athleteProfile.findUnique({
        where: { userId: currentUser.userId },
        select: { id: true },
      });
      if (!profile || video.athleteId !== profile.id) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    } else if (currentUser.role === "COACH") {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: currentUser.userId },
        select: { id: true },
      });
      if (!coachProfile) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (video.coachId !== coachProfile.id && video.athleteId) {
        const athlete = await prisma.athleteProfile.findUnique({
          where: { id: video.athleteId },
          select: { coachId: true },
        });
        if (athlete?.coachId !== coachProfile.id) {
          return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }
    }

    // Delete the physical file
    if (video.filePath.startsWith("http")) {
      if (isR2Configured()) {
        const key = extractR2KeyFromUrl(video.filePath);
        if (key) {
          await deleteObject(key).catch(() => {});
        }
      }
    } else {
      await unlink(video.filePath).catch(() => {});
    }

    await prisma.drillVideo.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Delete drill video error", { context: "drill-videos", error: error });
    return NextResponse.json({ success: false, error: "Failed to delete drill video" }, { status: 500 });
  }
}
