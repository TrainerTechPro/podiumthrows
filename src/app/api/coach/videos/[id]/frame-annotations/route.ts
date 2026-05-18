import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  parseBody,
  CoachFrameAnnotationSchema,
  CoachFrameAnnotationsBatchSchema,
} from "@/lib/api-schemas";

/* ─── GET — Retrieve frame annotations for a video ───────────────────────── */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    // Verify ownership
    const video = await prisma.videoUpload.findFirst({
      where: { id: id, coachId: coach.id },
      select: { id: true },
    });

    if (!video) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    // Optional timestamp range filter
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const where: { videoId: string; timestamp?: { gte?: number; lte?: number } } = {
      videoId: id,
    };

    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = parseFloat(from);
      if (to) where.timestamp.lte = parseFloat(to);
    }

    const frameAnnotations = await prisma.frameAnnotation.findMany({
      where,
      orderBy: { timestamp: "asc" },
    });

    return NextResponse.json({ success: true, data: { frameAnnotations } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("videos/[id]/frame-annotations GET Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/* ─── POST — Save a frame annotation (upsert by videoId + timestamp + source) ── */

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    // Verify ownership
    const video = await prisma.videoUpload.findFirst({
      where: { id: id, coachId: coach.id },
      select: { id: true },
    });

    if (!video) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    const parsed = await parseBody(req, CoachFrameAnnotationSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { timestamp, source, payload } = parsed;

    const src = source ?? "mediapipe";

    // Upsert: one frame annotation per (videoId, timestamp, source)
    const frameAnnotation = await prisma.frameAnnotation.upsert({
      where: {
        videoId_timestamp_source: {
          videoId: id,
          timestamp,
          source: src,
        },
      },
      create: {
        videoId: id,
        timestamp,
        source: src,
        payload: payload as never,
      },
      update: {
        payload: payload as never,
      },
    });

    return NextResponse.json({ success: true, data: { frameAnnotation } }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("videos/[id]/frame-annotations POST Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/* ─── PUT — Batch save multiple frame annotations ────────────────────────── */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    // Verify ownership
    const video = await prisma.videoUpload.findFirst({
      where: { id: id, coachId: coach.id },
      select: { id: true },
    });

    if (!video) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    const parsed = await parseBody(req, CoachFrameAnnotationsBatchSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { frameAnnotations } = parsed;

    // Batch upsert via transaction
    const results = await prisma.$transaction(
      frameAnnotations.map((fa) => {
        const src = fa.source ?? "mediapipe";
        return prisma.frameAnnotation.upsert({
          where: {
            videoId_timestamp_source: {
              videoId: id,
              timestamp: fa.timestamp,
              source: src,
            },
          },
          create: {
            videoId: id,
            timestamp: fa.timestamp,
            source: src,
            payload: fa.payload as never,
          },
          update: {
            payload: fa.payload as never,
          },
        });
      })
    );

    return NextResponse.json({ success: true, data: { count: results.length } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("videos/[id]/frame-annotations PUT Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
