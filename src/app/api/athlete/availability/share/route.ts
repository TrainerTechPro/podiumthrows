import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * POST /api/athlete/availability/share
 * Generates (or returns existing) a read-only share token for this athlete's
 * availability. Returns { shareUrl }.
 *
 * DELETE /api/athlete/availability/share
 * Revokes the current token by regenerating a new one.
 */

async function getAthleteId(userId: string): Promise<string | null> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athleteId = await getAthleteId(session.userId);
    if (!athleteId) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    // Return existing token if already set, otherwise generate a new one
    const existing = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      select: { availabilityShareToken: true },
    });

    const token =
      existing?.availabilityShareToken ?? randomBytes(32).toString("hex");

    if (!existing?.availabilityShareToken) {
      await prisma.athleteProfile.update({
        where: { id: athleteId },
        data: { availabilityShareToken: token },
      });
    }

    const shareUrl = `${APP_URL}/availability/${token}`;
    return NextResponse.json({ success: true, shareUrl });
  } catch (err) {
    logger.error("POST /api/athlete/availability/share", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to generate share link." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athleteId = await getAthleteId(session.userId);
    if (!athleteId) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    // Regenerate token to effectively revoke the old link
    const newToken = randomBytes(32).toString("hex");
    await prisma.athleteProfile.update({
      where: { id: athleteId },
      data: { availabilityShareToken: newToken },
    });

    const shareUrl = `${APP_URL}/availability/${newToken}`;
    return NextResponse.json({
      success: true,
      shareUrl,
      message: "Previous link revoked. New link generated.",
    });
  } catch (err) {
    logger.error("DELETE /api/athlete/availability/share", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to revoke share link." },
      { status: 500 }
    );
  }
}
