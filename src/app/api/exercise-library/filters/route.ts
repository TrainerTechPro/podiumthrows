import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const [muscleGroups, equipments, total] = await Promise.all([
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
      prisma.exerciseLibrary.count(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        muscleGroups: muscleGroups.map((m) => m.muscleGroup),
        equipments: equipments.map((e) => e.equipment).filter(Boolean),
        total,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch filter options" },
      { status: 500 }
    );
  }
}
