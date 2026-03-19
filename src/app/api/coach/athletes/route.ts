import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/data/coach";
import { randomUUID } from "crypto";

/* ── POST — coach creates a placeholder athlete profile ── */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, plan: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const body = await request.json();
    const { firstName, lastName, events } = body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "First name and last name are required" }, { status: 400 });
    }
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
    }
    const validEvents = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];
    if (!events.every((e: string) => validEvents.includes(e))) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }

    // Check plan limits
    const athleteCount = await prisma.athleteProfile.count({
      where: { coachId: coach.id },
    });
    const limit = PLAN_LIMITS[coach.plan];
    if (limit !== Infinity && athleteCount >= limit) {
      return NextResponse.json(
        { error: `Your ${coach.plan} plan supports up to ${limit} athletes. Upgrade to add more.` },
        { status: 403 }
      );
    }

    // Create placeholder user + athlete profile in transaction
    const result = await prisma.$transaction(async (tx) => {
      const placeholderEmail = `unclaimed-${randomUUID()}@placeholder.internal`;
      const user = await tx.user.create({
        data: {
          email: placeholderEmail,
          passwordHash: null,
          role: "ATHLETE",
          claimedAt: null,
        },
      });

      const athleteProfile = await tx.athleteProfile.create({
        data: {
          userId: user.id,
          coachId: coach.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          events,
          gender: "OTHER",
        },
      });

      return athleteProfile;
    });

    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("Error creating athlete:", error);
    return NextResponse.json({ error: "Failed to create athlete" }, { status: 500 });
  }
}

/* ── GET — list all athletes on coach's roster with claim status ── */
/* Optional query param: ?teamId=<id> to filter by team, ?teamId=unassigned for athletes in no team */
export async function GET(request: NextRequest) {
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

    const teamId = request.nextUrl.searchParams.get("teamId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let where: any = { coachId: coach.id };

    if (teamId === "unassigned") {
      where = { coachId: coach.id, teamMemberships: { none: {} } };
    } else if (teamId) {
      where = { coachId: coach.id, teamMemberships: { some: { teamId } } };
    }

    const athletes = await prisma.athleteProfile.findMany({
      where,
      include: {
        user: {
          select: { email: true, claimedAt: true },
        },
        throwsPRs: {
          where: { source: "COMPETITION" },
          orderBy: { distance: "desc" },
        },
      },
      orderBy: { firstName: "asc" },
    });

    return NextResponse.json({ ok: true, data: athletes });
  } catch (error) {
    console.error("Error listing athletes:", error);
    return NextResponse.json({ error: "Failed to list athletes" }, { status: 500 });
  }
}
