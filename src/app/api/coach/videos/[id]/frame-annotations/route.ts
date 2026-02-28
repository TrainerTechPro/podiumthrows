import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";

/* ─── GET — Retrieve frame annotations for a video ───────────────────────── */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();

    // Verify ownership
    const video = await prisma.videoUpload.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Optional timestamp range filter
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const where: { videoId: string; timestamp?: { gte?: number; lte?: number } } = {
      videoId: params.id,
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

    return NextResponse.json({ frameAnnotations });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/* ─── POST — Save a frame annotation (upsert by videoId + timestamp + source) ── */

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();

    // Verify ownership
    const video = await prisma.videoUpload.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const body = await req.json();
    const { timestamp, source, payload } = body as {
      timestamp?: number;
      source?: string;
      payload?: unknown;
    };

    if (typeof timestamp !== "number" || timestamp < 0) {
      return NextResponse.json(
        { error: "timestamp must be a non-negative number" },
        { status: 400 }
      );
    }

    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { error: "payload must be a JSON object" },
        { status: 400 }
      );
    }

    const src = source ?? "mediapipe";

    // Upsert: one frame annotation per (videoId, timestamp, source)
    const frameAnnotation = await prisma.frameAnnotation.upsert({
      where: {
        videoId_timestamp_source: {
          videoId: params.id,
          timestamp,
          source: src,
        },
      },
      create: {
        videoId: params.id,
        timestamp,
        source: src,
        payload: payload as never,
      },
      update: {
        payload: payload as never,
      },
    });

    return NextResponse.json({ frameAnnotation }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/* ─── PUT — Batch save multiple frame annotations ────────────────────────── */

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();

    // Verify ownership
    const video = await prisma.videoUpload.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const body = await req.json();
    const { frameAnnotations } = body as {
      frameAnnotations?: Array<{
        timestamp: number;
        source?: string;
        payload: unknown;
      }>;
    };

    if (!Array.isArray(frameAnnotations) || frameAnnotations.length === 0) {
      return NextResponse.json(
        { error: "frameAnnotations must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate all entries
    for (const fa of frameAnnotations) {
      if (typeof fa.timestamp !== "number" || fa.timestamp < 0) {
        return NextResponse.json(
          { error: "Each entry must have a non-negative timestamp" },
          { status: 400 }
        );
      }
      if (!fa.payload || typeof fa.payload !== "object") {
        return NextResponse.json(
          { error: "Each entry must have a payload object" },
          { status: 400 }
        );
      }
    }

    // Batch upsert via transaction
    const results = await prisma.$transaction(
      frameAnnotations.map((fa) => {
        const src = fa.source ?? "mediapipe";
        return prisma.frameAnnotation.upsert({
          where: {
            videoId_timestamp_source: {
              videoId: params.id,
              timestamp: fa.timestamp,
              source: src,
            },
          },
          create: {
            videoId: params.id,
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

    return NextResponse.json({
      success: true,
      count: results.length,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
