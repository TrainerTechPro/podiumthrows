import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getTeamStreakStandings } from "@/lib/data/team-leaderboard";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  limit: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (!v) return 10;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 10;
    }),
});

/**
 * GET /api/athlete/team/streaks?limit=10
 *
 * Active-streak standings across the requesting athlete's coach's roster.
 * Athletes with `feedPrivacy.shareStreaks=false` are filtered out for
 * athlete callers; coach callers see everyone.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      limit: url.searchParams.get("limit"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid query parameters" },
        { status: 400 }
      );
    }

    let coachId: string;
    let viewerAthleteId: string | null = null;
    if (session.role === "ATHLETE") {
      const athlete = await prisma.athleteProfile.findUnique({
        where: { userId: session.userId },
        select: { id: true, coachId: true, isSelfCoached: true },
      });
      if (!athlete) {
        return NextResponse.json(
          { success: false, error: "Athlete profile not found" },
          { status: 404 }
        );
      }
      if (athlete.isSelfCoached) {
        return NextResponse.json({ success: true, data: { entries: [] } });
      }
      coachId = athlete.coachId;
      viewerAthleteId = athlete.id;
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
      coachId = coach.id;
    }

    const entries = await getTeamStreakStandings({
      coachId,
      viewerAthleteId,
      viewerRole: session.role,
      limit: parsed.data.limit,
    });

    return NextResponse.json({ success: true, data: { entries } });
  } catch (err) {
    logger.error("GET /api/athlete/team/streaks", {
      context: "api",
      metadata: { error: String(err) },
    });
    return NextResponse.json(
      { success: false, error: "Failed to load streak standings." },
      { status: 500 }
    );
  }
}
