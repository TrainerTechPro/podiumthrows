import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/data/coach";

/* ── GET — list all invitations for the authenticated coach ── */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const invitations = await prisma.invitation.findMany({
      where: { coachId: coach.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        token: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, data: invitations });
  } catch (err) {
    console.error("[GET /api/invitations]", err);
    return NextResponse.json({ error: "Failed to fetch invitations." }, { status: 500 });
  }
}

/* ── POST — create a new invitation ── */
export async function POST(req: NextRequest) {
  try {
    /* ── Auth ── */
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        plan: true,
        _count: { select: { athletes: true } },
      },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    /* ── Plan limit ── */
    const limit = PLAN_LIMITS[coach.plan];
    if (limit !== Infinity && coach._count.athletes >= limit) {
      return NextResponse.json(
        {
          error: `You have reached the ${coach.plan} plan limit of ${limit} athletes. Upgrade to invite more.`,
        },
        { status: 403 }
      );
    }

    /* ── Validate body ── */
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "link" ? "link" : "email";
    const email =
      mode === "email" && typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : null;

    if (mode === "email") {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
      }

      /* ── Check if athlete already exists for this coach ── */
      const existingAthlete = await prisma.athleteProfile.findFirst({
        where: {
          coachId: coach.id,
          user: { email },
        },
      });
      if (existingAthlete) {
        return NextResponse.json(
          { error: "An athlete with this email is already on your roster." },
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
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        coachId: coach.id,
        ...(email ? { email } : {}),
        token,
        status: "PENDING",
        expiresAt,
      },
      select: {
        id: true,
        email: true,
        token: true,
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
        await sendInvitationEmail(email, coachName, token);
        emailSent = true;
      } catch (emailErr) {
        console.error("[POST /api/invitations] Email send failed:", emailErr);
        // Invitation was already created — don't fail the whole request
      }
    }

    return NextResponse.json({ ok: true, data: invitation, emailSent });
  } catch (err) {
    console.error("[POST /api/invitations]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to create invitation: ${message}` }, { status: 500 });
  }
}
