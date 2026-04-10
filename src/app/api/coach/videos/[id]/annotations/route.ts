import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const VALID_ANNOTATION_TYPES = [
  "line",
  "arrow",
  "circle",
  "angle",
  "freehand",
  "text",
];

type AnnotationInput = {
  id?: string;
  timestamp?: number;
  duration?: number;
  type?: string;
  points?: Array<{ x: number; y: number }>;
  color?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
};

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    // Verify ownership
    const existing = await prisma.videoUpload.findFirst({
      where: { id: id, coachId: coach.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    const body = await req.json();
    const { annotations } = body as { annotations?: AnnotationInput[] };

    if (!Array.isArray(annotations)) {
      return NextResponse.json(
        { success: false, error: "annotations must be an array" },
        { status: 400 }
      );
    }

    // Validate each annotation
    for (const ann of annotations) {
      if (!ann.id || typeof ann.id !== "string") {
        return NextResponse.json(
          { success: false, error: "Each annotation must have a string id" },
          { status: 400 }
        );
      }
      if (typeof ann.timestamp !== "number" || ann.timestamp < 0) {
        return NextResponse.json(
          { success: false, error: "Each annotation must have a valid timestamp" },
          { status: 400 }
        );
      }
      if (!ann.type || !VALID_ANNOTATION_TYPES.includes(ann.type)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid annotation type. Must be one of: ${VALID_ANNOTATION_TYPES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      if (!Array.isArray(ann.points)) {
        return NextResponse.json(
          { success: false, error: "Each annotation must have a points array" },
          { status: 400 }
        );
      }
    }

    await prisma.videoUpload.update({
      where: { id: id },
      data: { annotations: annotations as unknown as never },
    });

    return NextResponse.json({ success: true, count: annotations.length });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("videos/[id]/annotations PUT Error", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
