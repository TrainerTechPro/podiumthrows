import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";

export const maxDuration = 120; // Allow up to 2 minutes for large uploads
import { join } from "path";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { isR2Configured, uploadSingleFile, getPublicUrl } from "@/lib/r2";
import { logger } from "@/lib/logger";

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_DURATION = 10.5; // 10 seconds + tiny buffer
const DRILL_VIDEO_DIR = join("/tmp", "uploads", "drill-videos");

const ALLOWED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
  "video/x-m4v",
  "video/3gpp",
  "video/hevc",
];

/**
 * GET /api/drill-videos
 * Lists drill videos for the current user (or for a specific athlete if coach provides athleteId).
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");

    let videos;

    if (currentUser.role === "ATHLETE") {
      const profile = await prisma.athleteProfile.findUnique({
        where: { userId: currentUser.userId },
        select: { id: true },
      });
      if (!profile) {
        return NextResponse.json({ success: false, error: "Athlete profile not found" }, { status: 404 });
      }
      videos = await prisma.drillVideo.findMany({
        where: { athleteId: profile.id },
        orderBy: { createdAt: "desc" },
      });
    } else if (currentUser.role === "COACH") {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: currentUser.userId },
        select: { id: true },
      });
      if (!coachProfile) {
        return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
      }

      if (athleteId) {
        if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
          return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
        videos = await prisma.drillVideo.findMany({
          where: { athleteId },
          orderBy: { createdAt: "desc" },
        });
      } else {
        // Return all drill videos uploaded by this coach or for their athletes
        videos = await prisma.drillVideo.findMany({
          where: {
            OR: [
              { coachId: coachProfile.id },
              { athlete: { coachId: coachProfile.id } },
            ],
          },
          include: {
            athlete: {
              include: { user: { select: { id: true, email: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
        });
      }
    } else {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Add serve URL for local videos
    const videosWithUrls = (videos as typeof videos).map((v) => {
      const filePath = (v as { filePath: string }).filePath;
      const id = (v as { id: string }).id;
      const isLocal = !filePath.startsWith("http");
      return {
        ...v,
        videoUrl: isLocal ? `/api/drill-videos/serve?id=${id}` : filePath,
      };
    });

    return NextResponse.json({ success: true, data: videosWithUrls });
  } catch (error) {
    logger.error("List drill videos error", { context: "drill-videos", error: error });
    return NextResponse.json({ success: false, error: "Failed to list drill videos" }, { status: 500 });
  }
}

/**
 * POST /api/drill-videos
 * Upload a new drill video. Accepts multipart/form-data.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const videoBlob = formData.get("video") as File | null;
    const title = (formData.get("title") as string | null)?.trim();
    const drillType = formData.get("drillType") as string | null;
    const event = formData.get("event") as string | null;
    const notes = (formData.get("notes") as string | null)?.trim() || null;
    const trimStart = parseFloat((formData.get("trimStart") as string) || "0");
    const trimEnd = parseFloat((formData.get("trimEnd") as string) || "10");
    const duration = parseFloat((formData.get("duration") as string) || "10");
    const athleteIdParam = formData.get("athleteId") as string | null;

    if (!videoBlob || !title || !drillType || !event) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: video, title, drillType, event" },
        { status: 400 }
      );
    }

    if (videoBlob.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "File too large (max 200MB)" }, { status: 400 });
    }

    const ext = videoBlob.name?.split(".").pop()?.toLowerCase() || "mp4";
    const mimeType = videoBlob.type || "video/mp4";
    if (!ALLOWED_TYPES.includes(mimeType) && !["mp4", "mov", "webm", "avi", "mkv", "m4v", "3gp"].includes(ext)) {
      return NextResponse.json({ success: false, error: "Unsupported video format" }, { status: 400 });
    }

    if (duration > MAX_DURATION) {
      return NextResponse.json(
        { success: false, error: `Video must be ${MAX_DURATION.toFixed(0)} seconds or less` },
        { status: 400 }
      );
    }

    // Resolve who owns this video
    let resolvedAthleteId: string | null = null;
    let resolvedCoachId: string | null = null;
    let uploadedBy = "ATHLETE";

    if (currentUser.role === "ATHLETE") {
      const profile = await prisma.athleteProfile.findUnique({
        where: { userId: currentUser.userId },
        select: { id: true },
      });
      if (!profile) {
        return NextResponse.json({ success: false, error: "Athlete profile not found" }, { status: 404 });
      }
      resolvedAthleteId = profile.id;
      uploadedBy = "ATHLETE";
    } else if (currentUser.role === "COACH") {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: currentUser.userId },
        select: { id: true },
      });
      if (!coachProfile) {
        return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
      }
      resolvedCoachId = coachProfile.id;
      uploadedBy = "COACH";

      if (athleteIdParam) {
        if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteIdParam))) {
          return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
        resolvedAthleteId = athleteIdParam;
      }
    } else {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Store the file
    const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());
    const fileKey = `drill-videos/${randomUUID()}.${ext}`;
    let filePath: string;

    if (isR2Configured()) {
      await uploadSingleFile(fileKey, videoBuffer, mimeType);
      filePath = getPublicUrl(fileKey);
    } else {
      // Local storage fallback
      await mkdir(DRILL_VIDEO_DIR, { recursive: true });
      const localPath = join(DRILL_VIDEO_DIR, `${randomUUID()}.${ext}`);
      await writeFile(localPath, videoBuffer);
      filePath = localPath;
    }

    const drillVideo = await prisma.drillVideo.create({
      data: {
        athleteId: resolvedAthleteId,
        coachId: resolvedCoachId,
        title,
        drillType,
        event,
        notes,
        filePath,
        fileSize: videoBlob.size,
        mimeType,
        duration: Math.min(duration, MAX_DURATION),
        trimStart,
        trimEnd,
        uploadedBy,
      },
    });

    return NextResponse.json({ success: true, data: drillVideo }, { status: 201 });
  } catch (error) {
    logger.error("Upload drill video error", { context: "drill-videos", error: error });
    return NextResponse.json({ success: false, error: "Failed to upload drill video" }, { status: 500 });
  }
}
