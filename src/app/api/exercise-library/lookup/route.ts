import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

// Look up an exercise by exact or fuzzy name match
// Used when athletes click an exercise name in their workout
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const name = new URL(request.url).searchParams.get("name");
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Name parameter is required" },
        { status: 400 }
      );
    }

    // Try exact match first (case-insensitive)
    let exercise = await prisma.exerciseLibrary.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    // Fallback: contains match
    if (!exercise) {
      exercise = await prisma.exerciseLibrary.findFirst({
        where: { name: { contains: name, mode: "insensitive" } },
      });
    }

    if (!exercise) {
      return NextResponse.json({ success: true, data: null });
    }

    const parsed = {
      ...exercise,
      target: exercise.target ? JSON.parse(exercise.target) : [],
      synergists: exercise.synergists ? JSON.parse(exercise.synergists) : [],
      stabilizers: exercise.stabilizers ? JSON.parse(exercise.stabilizers) : [],
    };

    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    logger.error("Exercise lookup error", { context: "exercise-library/lookup", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to look up exercise" },
      { status: 500 }
    );
  }
}
