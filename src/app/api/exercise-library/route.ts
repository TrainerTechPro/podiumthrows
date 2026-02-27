import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const muscleGroup = searchParams.get("muscleGroup") || "";
    const equipment = searchParams.get("equipment") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { target: { contains: search, mode: "insensitive" } },
        { muscleGroup: { contains: search, mode: "insensitive" } },
      ];
    }
    if (muscleGroup) {
      where.muscleGroup = muscleGroup;
    }
    if (equipment) {
      where.equipment = equipment;
    }

    const [exercises, total] = await Promise.all([
      prisma.exerciseLibrary.findMany({
        where,
        select: {
          id: true,
          name: true,
          muscleGroup: true,
          equipment: true,
          target: true,
          videoUrl: true,
        },
        orderBy: { name: "asc" },
        skip: offset,
        take: limit,
      }),
      prisma.exerciseLibrary.count({ where }),
    ]);

    // Parse JSON target field for response
    const parsed = exercises.map((ex) => ({
      ...ex,
      target: ex.target ? JSON.parse(ex.target) : [],
    }));

    return NextResponse.json({
      success: true,
      data: {
        exercises: parsed,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Exercise library error", { context: "exercise-library", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch exercises" },
      { status: 500 }
    );
  }
}

// Get muscle groups + equipment for filter options
export async function OPTIONS() {
  try {
    const [muscleGroups, equipments] = await Promise.all([
      prisma.exerciseLibrary.findMany({
        select: { muscleGroup: true },
        distinct: ["muscleGroup"],
        orderBy: { muscleGroup: "asc" },
      }),
      prisma.exerciseLibrary.findMany({
        select: { equipment: true },
        distinct: ["equipment"],
        orderBy: { equipment: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        muscleGroups: muscleGroups.map((m) => m.muscleGroup),
        equipments: equipments.map((e) => e.equipment).filter(Boolean),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch filter options" },
      { status: 500 }
    );
  }
}
