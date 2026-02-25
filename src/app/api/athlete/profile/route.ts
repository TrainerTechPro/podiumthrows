import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/* ─── GET — return own profile ────────────────────────────────────────────── */

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        events: true,
        gender: true,
        dateOfBirth: true,
        avatarUrl: true,
        heightCm: true,
        weightKg: true,
        currentStreak: true,
        longestStreak: true,
      },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...athlete,
      dateOfBirth: athlete.dateOfBirth?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("[GET /api/athlete/profile]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* ─── PATCH — update profile ──────────────────────────────────────────────── */

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { firstName, lastName, events, gender, dateOfBirth, heightCm, weightKg } =
      body as Record<string, unknown>;

    if (
      typeof firstName !== "string" || firstName.trim().length === 0 ||
      typeof lastName !== "string" || lastName.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "First name and last name are required." },
        { status: 400 }
      );
    }

    const updated = await prisma.athleteProfile.update({
      where: { userId: session.userId },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        events: Array.isArray(events) ? (events as never[]) : undefined,
        gender: typeof gender === "string" ? (gender as never) : undefined,
        dateOfBirth:
          typeof dateOfBirth === "string" && dateOfBirth
            ? new Date(dateOfBirth)
            : null,
        heightCm: typeof heightCm === "number" ? heightCm : null,
        weightKg: typeof weightKg === "number" ? weightKg : null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        events: true,
        gender: true,
        dateOfBirth: true,
        heightCm: true,
        weightKg: true,
      },
    });

    return NextResponse.json({
      ...updated,
      dateOfBirth: updated.dateOfBirth?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("[PATCH /api/athlete/profile]", err);
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
