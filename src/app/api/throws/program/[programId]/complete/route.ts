import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { canAccessProgram } from "@/lib/authorize";
import { triggerProgramToProgram } from "@/lib/throws/autoregulation/triggers/program-to-program";

interface Params {
  params: Promise<{ programId: string }>;
}

// ── POST /api/throws/program/[programId]/complete ────────────────────────────
// Mark a training program as COMPLETED and fire the program-to-program
// autoregulation trigger to write a ProgramCarryforward record.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { programId } = await params;

    const allowed = await canAccessProgram(
      user.userId,
      user.role as "COACH" | "ATHLETE",
      programId,
    );
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 },
      );
    }

    // Mark program COMPLETED and fetch with athlete relation for the trigger
    const completedProgram = await prisma.trainingProgram.update({
      where:   { id: programId },
      data:    { status: "COMPLETED" },
      include: { athlete: true },
    });

    // Fire program-to-program autoregulation trigger (non-blocking)
    try {
      await triggerProgramToProgram(completedProgram, prisma);
    } catch (err) {
      console.error("[autoregulation] program-to-program trigger failed:", err);
    }

    return NextResponse.json({
      success: true,
      data: { programId, status: "COMPLETED" },
    });
  } catch (error) {
    logger.error("Complete program error", {
      context: "throws/program/complete",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to complete program" },
      { status: 500 },
    );
  }
}
