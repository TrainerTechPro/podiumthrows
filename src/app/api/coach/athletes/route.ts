import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/data/coach";
import { randomUUID } from "crypto";
import { parseBody, CoachAddAthleteSchema } from "@/lib/api-schemas";
import { logger } from "@/lib/logger";

/* ── POST — coach creates a placeholder athlete profile ── */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, plan: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
    }

    const parsed = await parseBody(request, CoachAddAthleteSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { firstName, lastName, events } = parsed;

    // Check plan limits (exclude self-coached athlete created by Training Mode)
    const athleteCount = await prisma.athleteProfile.count({
      where: { coachId: coach.id, isSelfCoached: false },
    });
    const limit = PLAN_LIMITS[coach.plan];
    if (limit !== Infinity && athleteCount >= limit) {
      return NextResponse.json(
        { success: false, error: `Your ${coach.plan} plan supports up to ${limit} athletes. Upgrade to add more.` },
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

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    logger.error("Error creating athlete", { context: "api", error });
    return NextResponse.json({ success: false, error: "Failed to create athlete" }, { status: 500 });
  }
}

/* ── GET — list all athletes on coach's roster with claim status ── */
/* Optional query param: ?teamId=<id> to filter by event group, ?teamId=unassigned for athletes in no group */
export async function GET(request: NextRequest) {
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

    const teamId = request.nextUrl.searchParams.get("teamId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let where: any = { coachId: coach.id };

    if (teamId === "unassigned") {
      where = { coachId: coach.id, eventGroupMemberships: { none: {} } };
    } else if (teamId) {
      where = { coachId: coach.id, eventGroupMemberships: { some: { groupId: teamId } } };
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

    return NextResponse.json({ success: true, data: athletes });
  } catch (error) {
    logger.error("Error listing athletes", { context: "api", error });
    return NextResponse.json({ success: false, error: "Failed to list athletes" }, { status: 500 });
  }
}
