import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/data/coach";
import { sendInvitationEmail } from "@/lib/email";

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
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
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

    /* ── Create invitation ── */
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.invitation.create({
      data: {
        coachId: coach.id,
        email,
        token,
        status: "PENDING",
        expiresAt,
      },
    });

    /* ── Send email ── */
    const coachName = `${coach.firstName} ${coach.lastName}`;
    await sendInvitationEmail(email, coachName, token);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/invitations]", err);
    return NextResponse.json({ error: "Failed to send invitation." }, { status: 500 });
  }
}
