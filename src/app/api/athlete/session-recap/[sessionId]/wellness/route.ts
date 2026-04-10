/**
 * Session Recap Wellness Check-in
 * POST — saves a 3-question (legs / energy / focus) emoji check-in
 * to TrainingSession.wellnessCheckin. Idempotent: re-posting overwrites.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

function isWellnessValue(n: unknown): n is 1 | 2 | 3 {
  return n === 1 || n === 2 || n === 3;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const trainingSession = await prisma.trainingSession.findFirst({
      where: { id: sessionId, athleteId: athlete.id },
      select: { id: true },
    });
    if (!trainingSession) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { legs, energy, focus } = body;

    if (!isWellnessValue(legs) || !isWellnessValue(energy) || !isWellnessValue(focus)) {
      return NextResponse.json(
        { success: false, error: "legs, energy, and focus must each be 1, 2, or 3." },
        { status: 400 }
      );
    }

    const payload = {
      legs,
      energy,
      focus,
      submittedAt: new Date().toISOString(),
    };

    await prisma.trainingSession.update({
      where: { id: sessionId },
      data: {
        wellnessCheckin: payload as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true, wellnessCheckin: payload });
  } catch (err) {
    logger.error("POST /api/athlete/session-recap/[sessionId]/wellness", {
      context: "api",
      error: err,
    });
    return NextResponse.json({ success: false, error: "Failed to save wellness check-in." }, { status: 500 });
  }
}
