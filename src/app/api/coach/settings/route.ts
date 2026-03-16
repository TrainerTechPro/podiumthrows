import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/* ─── GET — return coach profile ─────────────────────────────────────────── */

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: {
        id:           true,
        firstName:    true,
        lastName:     true,
        bio:          true,
        organization: true,
        avatarUrl:    true,
        plan:         true,
      },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    return NextResponse.json(coach);
  } catch (err) {
    logger.error("GET /api/coach/settings", { context: "api", error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* ─── PATCH — update profile ─────────────────────────────────────────────── */

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const { firstName, lastName, bio, organization } = body as Record<string, unknown>;

    if (
      typeof firstName !== "string" || firstName.trim().length === 0 ||
      typeof lastName  !== "string" || lastName.trim().length  === 0
    ) {
      return NextResponse.json(
        { error: "First name and last name are required." },
        { status: 400 }
      );
    }

    const updated = await prisma.coachProfile.update({
      where: { userId: session.userId },
      data: {
        firstName:    firstName.trim(),
        lastName:     lastName.trim(),
        bio:          typeof bio          === "string" ? bio.trim()          || null : null,
        organization: typeof organization === "string" ? organization.trim() || null : null,
      },
      select: {
        id: true, firstName: true, lastName: true, bio: true, organization: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    logger.error("PATCH /api/coach/settings", { context: "api", error: err });
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
