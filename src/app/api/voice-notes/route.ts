import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSession } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, VoiceNoteCreateSchema } from "@/lib/api-schemas";
import { isR2Configured, uploadSingleFile, getPublicUrl } from "@/lib/r2";

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

    const parsed = await parseBody(request, VoiceNoteCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { audioData, duration, sessionId, transcription } = parsed;

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

    // Prefer R2 storage over inline Base64 to reduce DB bloat (~33% smaller)
    let storedAudioData: string | null = audioData;
    let storedAudioUrl: string | null = null;

    if (isR2Configured()) {
      try {
        // Decode Base64 data URI → raw buffer
        const base64Match = audioData.match(/^data:[^;]+;base64,(.+)$/);
        const raw = base64Match
          ? Buffer.from(base64Match[1], "base64")
          : Buffer.from(audioData, "base64");
        const key = `audio/${currentUser.userId}/${Date.now()}.webm`;
        await uploadSingleFile(key, raw, "audio/webm");
        storedAudioUrl = getPublicUrl(key);
        storedAudioData = null; // Don't store Base64 inline when R2 is available
      } catch (r2Err) {
        // R2 upload failed — fall back to inline Base64
        logger.warn("Voice note R2 upload failed, falling back to inline storage", {
          context: "voice-notes",
          metadata: { error: r2Err },
        });
      }
    }

    const voiceNote = await prisma.voiceNote.create({
      data: {
        coachId,
        athleteId,
        sessionId: sessionId || null,
        audioData: storedAudioData,
        audioUrl: storedAudioUrl,
        duration: Math.round(duration),
        transcription: transcription || null,
      },
      select: {
        id: true,
        audioUrl: true,
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
