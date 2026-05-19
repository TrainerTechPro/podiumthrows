import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildWeeklyRecap } from "@/lib/recap/weekly";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  athleteId: z.string().nullable().optional(),
  /** YYYY-MM-DD; treated as the Monday of the requested week. Defaults to current week. */
  week: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .nullable()
    .optional(),
});

/**
 * GET /api/recap/preview?athleteId=&week=
 *
 * Returns the same payload the cron uses, on demand. The session athlete
 * can preview their own recap without passing athleteId. Coaches can pass
 * any athleteId on their roster. Admins can pass any athleteId.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      athleteId: url.searchParams.get("athleteId"),
      week: url.searchParams.get("week"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid query parameters" },
        { status: 400 }
      );
    }

    const requestedAthleteId = parsed.data.athleteId ?? null;

    // Resolve target athlete + authorize.
    let targetAthleteId: string;
    if (session.role === "ATHLETE") {
      const ownProfile = await prisma.athleteProfile.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      });
      if (!ownProfile) {
        return NextResponse.json(
          { success: false, error: "Athlete profile not found" },
          { status: 404 }
        );
      }
      if (requestedAthleteId && requestedAthleteId !== ownProfile.id) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      targetAthleteId = ownProfile.id;
    } else {
      // Coach (or admin) — must specify, must own (unless admin).
      if (!requestedAthleteId) {
        return NextResponse.json(
          { success: false, error: "athleteId is required" },
          { status: 400 }
        );
      }
      if (session.isAdmin) {
        targetAthleteId = requestedAthleteId;
      } else {
        const coach = await prisma.coachProfile.findUnique({
          where: { userId: session.userId },
          select: { id: true },
        });
        if (!coach) {
          return NextResponse.json(
            { success: false, error: "Coach profile not found" },
            { status: 404 }
          );
        }
        const owns = await prisma.athleteProfile.findFirst({
          where: { id: requestedAthleteId, coachId: coach.id },
          select: { id: true },
        });
        if (!owns) {
          return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
        targetAthleteId = requestedAthleteId;
      }
    }

    const weekStartingMonday = parsed.data.week
      ? new Date(`${parsed.data.week}T00:00:00Z`)
      : undefined;
    const recap = await buildWeeklyRecap(targetAthleteId, { weekStartingMonday });
    return NextResponse.json({ success: true, data: recap });
  } catch (err) {
    logger.error("GET /api/recap/preview", { context: "api", metadata: { error: String(err) } });
    return NextResponse.json(
      { success: false, error: "Couldn’t load recap preview" },
      { status: 500 }
    );
  }
}
