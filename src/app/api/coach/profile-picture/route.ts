import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

const MAX_DATA_URL_SIZE = 4 * 1024 * 1024; // 4MB base64

/* ─── PUT — upload / update profile picture ─────────────────────────────── */

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { avatarUrl } = body as { avatarUrl?: string };

    if (!avatarUrl || typeof avatarUrl !== "string") {
      return NextResponse.json(
        { success: false, error: "avatarUrl is required" },
        { status: 400 }
      );
    }

    if (avatarUrl.length > MAX_DATA_URL_SIZE) {
      return NextResponse.json(
        { success: false, error: "Image too large (max ~3MB)" },
        { status: 400 }
      );
    }

    const updated = await prisma.coachProfile.update({
      where: { userId: session.userId },
      data: { avatarUrl },
      select: { avatarUrl: true },
    });

    return NextResponse.json({ success: true, avatarUrl: updated.avatarUrl });
  } catch (err) {
    logger.error("PUT /api/coach/profile-picture", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to update profile picture" }, { status: 500 });
  }
}

/* ─── DELETE — remove profile picture ───────────────────────────────────── */

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await prisma.coachProfile.update({
      where: { userId: session.userId },
      data: { avatarUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/coach/profile-picture", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to remove profile picture" }, { status: 500 });
  }
}
