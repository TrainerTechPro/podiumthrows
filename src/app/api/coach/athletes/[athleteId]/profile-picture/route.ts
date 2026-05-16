/**
 * PUT    — set proxy athlete's avatar (coach uploads photo)
 * DELETE — clear proxy athlete's avatar
 *
 * Proxy-only: the athlete's user row must have `claimedAt IS NULL`.
 * Claimed athletes keep authority over their own avatar; if a coach
 * asks for this and the athlete is claimed, we return 403 so the UI
 * can explain why.
 *
 * Same data-URI contract as /api/coach/profile-picture: 4MB cap,
 * `data:image/` prefix required. Stored inline in `AthleteProfile.avatarUrl`.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import { parseBody, ProfilePictureUpdateSchema } from "@/lib/api-schemas";

const MAX_DATA_URL_SIZE = 4 * 1024 * 1024; // ~3MB decoded

async function assertProxyOwnership(
  coachUserId: string,
  athleteId: string
): Promise<NextResponse | { ok: true }> {
  const allowed = await canAccessAthlete(coachUserId, "COACH", athleteId);
  if (!allowed) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const athlete = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: { user: { select: { claimedAt: true } } },
  });
  if (!athlete) {
    return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
  }
  if (athlete.user.claimedAt !== null) {
    return NextResponse.json(
      {
        success: false,
        error:
          "This athlete has claimed their profile — they control their own photo. Ask them to update it from their account.",
      },
      { status: 403 }
    );
  }
  return { ok: true };
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  try {
    const { athleteId } = await params;
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const guard = await assertProxyOwnership(session.userId, athleteId);
    if (guard instanceof NextResponse) return guard;

    const parsed = await parseBody(req, ProfilePictureUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { avatarUrl } = parsed;

    if (avatarUrl.length > MAX_DATA_URL_SIZE) {
      return NextResponse.json(
        { success: false, error: "Image too large (max ~3MB)" },
        { status: 400 }
      );
    }
    if (!avatarUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { success: false, error: "Only data:image/ URLs are accepted" },
        { status: 400 }
      );
    }

    const updated = await prisma.athleteProfile.update({
      where: { id: athleteId },
      data: { avatarUrl },
      select: { avatarUrl: true },
    });

    return NextResponse.json({ success: true, data: { avatarUrl: updated.avatarUrl } });
  } catch (err) {
    logger.error("PUT /api/coach/athletes/[athleteId]/profile-picture", {
      context: "api",
      error: err,
    });
    return NextResponse.json({ success: false, error: "Failed to update photo" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  try {
    const { athleteId } = await params;
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const guard = await assertProxyOwnership(session.userId, athleteId);
    if (guard instanceof NextResponse) return guard;

    await prisma.athleteProfile.update({
      where: { id: athleteId },
      data: { avatarUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/coach/athletes/[athleteId]/profile-picture", {
      context: "api",
      error: err,
    });
    return NextResponse.json({ success: false, error: "Failed to remove photo" }, { status: 500 });
  }
}
