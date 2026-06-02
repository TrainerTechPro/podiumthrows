import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { notifyCoachInvitationExpired } from "@/lib/notifications";
import { assertCronAuth } from "@/lib/cron-auth";

export const maxDuration = 60;

/**
 * GET /api/cron/expire-invitations
 * Vercel Cron — runs daily at 00:15 UTC.
 *
 * Flips PENDING invitations whose expiresAt has passed to EXPIRED, and
 * fires an INVITATION_EXPIRED notification to the coach so they can send
 * a new invite from their roster.
 *
 * Note: /api/auth/register-claim also JIT-rejects expired tokens on
 * claim attempt (returns 410). This cron handles the case where nobody
 * ever attempts a claim — without it, the invitation lingers in PENDING
 * forever and the coach's roster keeps displaying "Invited" incorrectly.
 */
export async function GET(req: NextRequest) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  try {
    const now = new Date();

    // Fetch first so we can derive labels + notify after the update.
    // Limit to a reasonable batch to stay inside maxDuration on large prods.
    const expired = await prisma.invitation.findMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      take: 500,
      select: {
        id: true,
        coachId: true,
        email: true,
        athleteProfileId: true,
        athleteProfile: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (expired.length === 0) {
      return NextResponse.json({
        success: true,
        data: { expired: 0, notified: 0, timestamp: now.toISOString() },
      });
    }

    await prisma.invitation.updateMany({
      where: { id: { in: expired.map((e) => e.id) } },
      data: { status: "EXPIRED" },
    });

    // Fire notifications in parallel; per-notification failure must not
    // block sibling notifications or the cron response.
    const settled = await Promise.allSettled(
      expired.map((inv) => {
        const label = inv.athleteProfile
          ? `${inv.athleteProfile.firstName} ${inv.athleteProfile.lastName}`
          : (inv.email ?? "an athlete");
        return notifyCoachInvitationExpired(inv.coachId, label, {
          invitationId: inv.id,
          athleteProfileId: inv.athleteProfileId ?? undefined,
          email: inv.email ?? undefined,
        });
      })
    );

    const notified = settled.filter((s) => s.status === "fulfilled").length;
    const notifyFailures = settled.length - notified;
    if (notifyFailures > 0) {
      logger.error("expire-invitations: some notifications failed", {
        context: "cron",
        metadata: { failures: notifyFailures, total: settled.length },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        expired: expired.length,
        notified,
        notifyFailures,
        timestamp: now.toISOString(),
      },
    });
  } catch (err) {
    logger.error("expire-invitations cron error", { context: "cron", error: err });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
