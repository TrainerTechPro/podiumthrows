import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const exercise = await prisma.exerciseLibrary.findUnique({
      where: { id: params.id },
    });

    if (!exercise) {
      return NextResponse.json(
        { success: false, error: "Exercise not found" },
        { status: 404 }
      );
    }

    // Parse JSON arrays
    const parsed = {
      ...exercise,
      target: exercise.target ? JSON.parse(exercise.target) : [],
      synergists: exercise.synergists ? JSON.parse(exercise.synergists) : [],
      stabilizers: exercise.stabilizers ? JSON.parse(exercise.stabilizers) : [],
    };

    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    logger.error("Exercise library detail error", { context: "exercise-library", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch exercise" },
      { status: 500 }
    );
  }
}

// Update exercise (add video link, edit tips)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json(
        { success: false, error: "Only coaches can update exercises" },
        { status: 403 }
      );
    }

    // Verify exercise exists before allowing modification
    const existing = await prisma.exerciseLibrary.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Exercise not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { videoUrl, videoEmbed, tips } = body;

    // Only allow updating supplemental fields (video, tips) — not core exercise data
    const updated = await prisma.exerciseLibrary.update({
      where: { id: params.id },
      data: {
        ...(videoUrl !== undefined && { videoUrl }),
        ...(videoEmbed !== undefined && { videoEmbed }),
        ...(tips !== undefined && { tips }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error("Update exercise library error", { context: "exercise-library", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to update exercise" },
      { status: 500 }
    );
  }
}
