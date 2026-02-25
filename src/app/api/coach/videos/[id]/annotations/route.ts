import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";

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
  { params }: { params: { id: string } }
) {
  try {
    const { coach } = await requireCoachSession();

    // Verify ownership
    const existing = await prisma.videoUpload.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const body = await req.json();
    const { annotations } = body as { annotations?: AnnotationInput[] };

    if (!Array.isArray(annotations)) {
      return NextResponse.json(
        { error: "annotations must be an array" },
        { status: 400 }
      );
    }

    // Validate each annotation
    for (const ann of annotations) {
      if (!ann.id || typeof ann.id !== "string") {
        return NextResponse.json(
          { error: "Each annotation must have a string id" },
          { status: 400 }
        );
      }
      if (typeof ann.timestamp !== "number" || ann.timestamp < 0) {
        return NextResponse.json(
          { error: "Each annotation must have a valid timestamp" },
          { status: 400 }
        );
      }
      if (!ann.type || !VALID_ANNOTATION_TYPES.includes(ann.type)) {
        return NextResponse.json(
          {
            error: `Invalid annotation type. Must be one of: ${VALID_ANNOTATION_TYPES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      if (!Array.isArray(ann.points)) {
        return NextResponse.json(
          { error: "Each annotation must have a points array" },
          { status: 400 }
        );
      }
    }

    await prisma.videoUpload.update({
      where: { id: params.id },
      data: { annotations: annotations as unknown as never },
    });

    return NextResponse.json({ success: true, count: annotations.length });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
