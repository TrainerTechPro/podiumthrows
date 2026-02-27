import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessVoiceNote } from "@/lib/authorize";
import { logger } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { noteId } = params;

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
      { success: false, error: "Failed to fetch voice note" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { noteId } = params;

    // Fetch the voice note to check ownership
    const voiceNote = await prisma.voiceNote.findUnique({
      where: { id: noteId },
      select: {
        id: true,
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

    await prisma.voiceNote.delete({
      where: { id: noteId },
    });

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error("Delete voice note error", { context: "voice-notes", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to delete voice note" },
      { status: 500 }
    );
  }
}
