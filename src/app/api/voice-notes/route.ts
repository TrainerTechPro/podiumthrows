import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSession } from "@/lib/authorize";
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
    const sessionId = searchParams.get("sessionId");

    let whereClause: Record<string, unknown> = {};

    if (sessionId) {
      if (!(await canAccessSession(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", sessionId))) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        );
      }
      whereClause = { sessionId };
    } else if (currentUser.role === "ATHLETE") {
      const athlete = await prisma.athleteProfile.findUnique({
        where: { userId: currentUser.userId },
      });
      if (!athlete) {
        return NextResponse.json({ success: true, data: [] });
      }
      whereClause = { athleteId: athlete.id };
    } else {
      // Coach - get all their voice notes
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: currentUser.userId },
      });
      if (!coach) {
        return NextResponse.json({ success: true, data: [] });
      }
      whereClause = { coachId: coach.id };
    }

    const voiceNotes = await prisma.voiceNote.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        // Exclude audioData from list queries (1-5MB per note) — fetch via /voice-notes/[noteId] on play
        duration: true,
        transcription: true,
        createdAt: true,
        coachId: true,
        athleteId: true,
        sessionId: true,
        coach: {
          select: {
            user: { select: { id: true, email: true } },
          },
        },
        athlete: {
          select: {
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: voiceNotes });
  } catch (error) {
    logger.error("Get voice notes error", { context: "voice-notes", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch voice notes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { audioData, duration, sessionId, transcription } = body;

    if (!audioData || !duration) {
      return NextResponse.json(
        { success: false, error: "audioData and duration are required" },
        { status: 400 }
      );
    }

    // Limit audio to ~5MB base64 (~3.75MB decoded)
    if (typeof audioData === "string" && audioData.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Audio data exceeds 5MB limit" },
        { status: 413 }
      );
    }

    let coachId: string | null = null;
    let athleteId: string | null = null;

    if (currentUser.role === "COACH") {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: currentUser.userId },
      });
      if (!coach) {
        return NextResponse.json(
          { success: false, error: "Coach profile not found" },
          { status: 404 }
        );
      }
      coachId = coach.id;
    } else if (currentUser.role === "ATHLETE") {
      const athlete = await prisma.athleteProfile.findUnique({
        where: { userId: currentUser.userId },
      });
      if (!athlete) {
        return NextResponse.json(
          { success: false, error: "Athlete profile not found" },
          { status: 404 }
        );
      }
      athleteId = athlete.id;
    }

    const voiceNote = await prisma.voiceNote.create({
      data: {
        coachId,
        athleteId,
        sessionId: sessionId || null,
        audioData,
        duration: Math.round(duration),
        transcription: transcription || null,
      },
      select: {
        id: true,
        audioData: true,
        duration: true,
        transcription: true,
        createdAt: true,
        coachId: true,
        athleteId: true,
        sessionId: true,
        coach: {
          select: {
            user: { select: { id: true, email: true } },
          },
        },
        athlete: {
          select: {
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: voiceNote });
  } catch (error) {
    logger.error("Create voice note error", { context: "voice-notes", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to create voice note" },
      { status: 500 }
    );
  }
}
