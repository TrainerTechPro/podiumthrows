import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { logAudit, auditRequestInfo } from "@/lib/audit";
import { generateInvitationToken } from "@/lib/invitation-token";
import { parseBody, InvitationCreateSchema } from "@/lib/api-schemas";

/* ── GET — list all invitations for the authenticated coach ── */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    // Note: `token` is intentionally excluded from the response.
    // After POST-creation, only the recipient's email holds the raw token;
    // the DB stores only the hash. Re-sharing a link requires a new invite.
    const invitations = await prisma.invitation.findMany({
      where: { coachId: coach.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: invitations });
  } catch (err) {
    logger.error("GET /api/invitations", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t fetch invitations." },
      { status: 500 }
    );
  }
}

/* ── POST — create a new invitation ── */
export async function POST(req: NextRequest) {
  try {
    /* ── Auth ── */
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        plan: true,
      },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    /* ── Plan limit (exclude self-coached athlete created by Training Mode) ── */
    const realAthleteCount = await prisma.athleteProfile.count({
      where: { coachId: coach.id, isSelfCoached: false },
    });
    const limit = PLAN_LIMITS[coach.plan];
    if (limit !== Infinity && realAthleteCount >= limit) {
      return NextResponse.json(
        {
          success: false,
          error: `You have reached the ${coach.plan} plan limit of ${limit} athletes. Upgrade to invite more.`,
        },
        { status: 403 }
      );
    }

    /* ── Validate body ── */
    const parsed = await parseBody(req, InvitationCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const mode = parsed.mode;
    const email = mode === "email" && parsed.email ? parsed.email.trim().toLowerCase() : null;
    const athleteProfileId = parsed.athleteProfileId ?? undefined;

    if (mode === "email" && email) {
      /* ── Check if athlete already exists for this coach ── */
      const existingAthlete = await prisma.athleteProfile.findFirst({
        where: {
          coachId: coach.id,
          user: { email },
        },
      });
      if (existingAthlete) {
        return NextResponse.json(
          { success: false, error: "An athlete with this email is already on your roster." },
          { status: 409 }
        );
      }

      /* ── Revoke any pending invitations to this email from this coach ── */
      await prisma.invitation.updateMany({
        where: {
          coachId: coach.id,
          email,
          status: "PENDING",
        },
        data: { status: "REVOKED" },
      });
    }

    /* ── Create invitation ── */
    // We store only the hash in the DB. The raw token is returned once in
    // this response (for the client's "copy link" clipboard) and also sent
    // via email. Neither persists server-side after this handler returns.
    const { raw, hashed } = generateInvitationToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        coachId: coach.id,
        ...(email ? { email } : {}),
        ...(athleteProfileId ? { athleteProfileId } : {}),
        token: hashed,
        status: "PENDING",
        expiresAt,
      },
      select: {
        id: true,
        email: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    /* ── Send email (only for email invites) ── */
    let emailSent = false;
    if (mode === "email" && email) {
      try {
        const { sendInvitationEmail } = await import("@/lib/email");
        const coachName = `${coach.firstName} ${coach.lastName}`;
        await sendInvitationEmail(email, coachName, raw);
        emailSent = true;
      } catch (emailErr) {
        logger.error("POST /api/invitations Email send failed", {
          context: "api",
          error: emailErr,
        });
        // Invitation was already created — don't fail the whole request
      }
    }

    void logAudit({
      userId: session.userId,
      action: "ATHLETE_INVITED",
      resource: `invitation:${invitation.id}`,
      metadata: { mode, email: email || undefined, coachId: coach.id },
      ...auditRequestInfo(req),
    });

    return NextResponse.json({
      success: true,
      data: { ...invitation, token: raw, emailSent },
    });
  } catch (err) {
    logger.error("POST /api/invitations", { context: "api", error: err });
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to create invitation: ${message}` },
      { status: 500 }
    );
  }
}
