import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessVoiceNote } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { extractR2KeyFromUrl, deleteObject } from "@/lib/r2";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { noteId } = await params;

    if (!(await canAccessVoiceNote(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", noteId))) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const voiceNote = await prisma.voiceNote.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        audioData: true,
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

    if (!voiceNote) {
      return NextResponse.json(
        { success: false, error: "Voice note not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: voiceNote });
  } catch (error) {
    logger.error("Get voice note error", { context: "voice-notes", error: error });
    return NextResponse.json(
      { success: false, error: "Couldn’t fetch voice note" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { noteId } = await params;

    // Fetch the voice note to check ownership
    const voiceNote = await prisma.voiceNote.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        audioUrl: true,
        coachId: true,
        athleteId: true,
        coach: { select: { userId: true } },
        athlete: { select: { userId: true } },
      },
    });

    if (!voiceNote) {
      return NextResponse.json(
        { success: false, error: "Voice note not found" },
        { status: 404 }
      );
    }

    // Check ownership - only the creator can delete
    const isOwner =
      (voiceNote.coach && voiceNote.coach.userId === currentUser.userId) ||
      (voiceNote.athlete && voiceNote.athlete.userId === currentUser.userId);

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own voice notes" },
        { status: 403 }
      );
    }

    // Clean up R2 object if stored externally
    if (voiceNote.audioUrl) {
      const r2Key = extractR2KeyFromUrl(voiceNote.audioUrl);
      if (r2Key) {
        await deleteObject(r2Key).catch((err) => {
          logger.warn("Couldn’t delete voice note from R2", { context: "voice-notes", metadata: { r2Key, error: err } });
        });
      }
    }

    await prisma.voiceNote.delete({
      where: { id: noteId },
    });

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error("Delete voice note error", { context: "voice-notes", error: error });
    return NextResponse.json(
      { success: false, error: "Couldn’t delete voice note" },
      { status: 500 }
    );
  }
}
