import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120; // Allow up to 2 minutes for large uploads
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { getCurrentUser, canActAsAthlete } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { isR2Configured, uploadSingleFile, getPublicUrl, saveFileLocally } from "@/lib/r2";
import { logger } from "@/lib/logger";

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_DURATION = 10.5; // 10 seconds + tiny buffer

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

const DEFAULT_PAGE_LIMIT = 30;
const MAX_PAGE_LIMIT = 100;

/**
 * GET /api/drill-videos
 * Lists drill videos for the current user (or for a specific athlete if coach provides athleteId).
 *
 * Pagination: cursor-based. Pass `?cursor=<last-id>&limit=<1-100>`. Response returns
 * `nextCursor` when more rows exist; `null` when the current page is the last one.
 * Default limit is 30 to keep the payload (and any video-URL lookups downstream) bounded.
 *
 * Access model: the query is relation-filtered through `athlete.userId` / `coach.userId`,
 * so we no longer preload AthleteProfile/CoachProfile in a separate round trip. A user who
 * somehow has the role without a profile simply sees an empty list — same UX as before,
 * one fewer query.
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");
    const cursor = searchParams.get("cursor") || undefined;

    const rawLimit = parseInt(searchParams.get("limit") ?? "", 10);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, MAX_PAGE_LIMIT)
        : DEFAULT_PAGE_LIMIT;

    // Build the scope filter based on role. We only BUILD the where — the actual
    // findMany runs once below, so coach/athlete/athleteId paths collapse into a
    // single round trip regardless of which branch we're in.
    type DrillVideoWhere = Parameters<typeof prisma.drillVideo.findMany>[0] extends
      | { where?: infer W }
      | undefined
      ? W
      : never;

    let where: DrillVideoWhere;
    if (await canActAsAthlete(currentUser)) {
      where = { athlete: { userId: currentUser.userId } };
    } else if (currentUser.role === "COACH") {
      if (athleteId) {
        if (
          !(await canAccessAthlete(
            currentUser.userId,
            currentUser.role as "COACH" | "ATHLETE",
            athleteId
          ))
        ) {
          return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
        where = { athleteId };
      } else {
        where = {
          OR: [
            { coach: { userId: currentUser.userId } },
            { athlete: { coach: { userId: currentUser.userId } } },
          ],
        };
      }
    } else {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // `take: limit + 1` lets us detect "is there another page?" without a second
    // query. (createdAt, id) gives a stable order even when two rows share a ms.
    const rows = await prisma.drillVideo.findMany({
      where,
      include: {
        athlete: {
          include: { user: { select: { id: true, email: true } } },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? pageRows[pageRows.length - 1].id : null;

    const videos = pageRows.map((v) => ({
      ...v,
      videoUrl: v.filePath.startsWith("http") ? v.filePath : `/api/drill-videos/serve?id=${v.id}`,
    }));

    return NextResponse.json({ success: true, data: { videos, nextCursor } });
  } catch (error) {
    logger.error("List drill videos error", { context: "drill-videos", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to list drill videos" },
      { status: 500 }
    );
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
      return NextResponse.json(
        { success: false, error: "File too large (max 200MB)" },
        { status: 400 }
      );
    }

    const ext = videoBlob.name?.split(".").pop()?.toLowerCase() || "mp4";
    const mimeType = videoBlob.type || "video/mp4";
    if (
      !ALLOWED_TYPES.includes(mimeType) &&
      !["mp4", "mov", "webm", "avi", "mkv", "m4v", "3gp"].includes(ext)
    ) {
      return NextResponse.json(
        { success: false, error: "Unsupported video format" },
        { status: 400 }
      );
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

    if (await canActAsAthlete(currentUser)) {
      const profile = await prisma.athleteProfile.findUnique({
        where: { userId: currentUser.userId },
        select: { id: true },
      });
      if (!profile) {
        return NextResponse.json(
          { success: false, error: "Athlete profile not found" },
          { status: 404 }
        );
      }
      resolvedAthleteId = profile.id;
      uploadedBy = "ATHLETE";
    } else if (currentUser.role === "COACH") {
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: currentUser.userId },
        select: { id: true },
      });
      if (!coachProfile) {
        return NextResponse.json(
          { success: false, error: "Coach profile not found" },
          { status: 404 }
        );
      }
      resolvedCoachId = coachProfile.id;
      uploadedBy = "COACH";

      if (athleteIdParam) {
        if (
          !(await canAccessAthlete(
            currentUser.userId,
            currentUser.role as "COACH" | "ATHLETE",
            athleteIdParam
          ))
        ) {
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
      // Local storage fallback — save to public/uploads/
      filePath = await saveFileLocally(fileKey, videoBuffer);
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

    // Also create a VideoUpload record so drill videos appear in the main video library
    try {
      const validEvents = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];
      const videoUrl = filePath.startsWith("http")
        ? filePath
        : `/api/drill-videos/serve?id=${drillVideo.id}`;
      await prisma.videoUpload.create({
        data: {
          coachId: resolvedCoachId,
          athleteId: resolvedAthleteId,
          url: videoUrl,
          storageKey: fileKey,
          title: title ?? `Drill — ${drillType}`,
          event: validEvents.includes(event ?? "") ? (event as never) : undefined,
          category: "drill",
          status: "ready",
          fileSizeMb: videoBlob.size / (1024 * 1024),
          durationSec: Math.min(duration, MAX_DURATION),
        },
      });
    } catch (err) {
      // Non-fatal — drill video is saved, just not indexed in main library
      logger.error("Failed to create VideoUpload record for drill video", {
        context: "drill-videos",
        error: err,
      });
    }

    return NextResponse.json({ success: true, data: drillVideo }, { status: 201 });
  } catch (error) {
    logger.error("Upload drill video error", { context: "drill-videos", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to upload drill video" },
      { status: 500 }
    );
  }
}
