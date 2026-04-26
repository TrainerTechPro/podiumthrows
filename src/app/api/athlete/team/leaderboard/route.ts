import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getTeamLeaderboardByEvent } from "@/lib/data/team-leaderboard";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  event: z
    .string()
    .min(1)
    .regex(/^[A-Z_]+$/, "event must be uppercase enum (e.g. SHOT_PUT)"),
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
 * GET /api/athlete/team/leaderboard?event=HAMMER&limit=10
 *
 * Top PRs across the requesting athlete's coach's roster for one event.
 * Athletes with `feedPrivacy.sharePRs=false` are filtered out (default
 * is on, opt-out model). Coach callers see everyone regardless.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      event: url.searchParams.get("event"),
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
      // Coach role — caller must specify whose team via ?coachId or
      // implicitly use their own roster.
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

    const entries = await getTeamLeaderboardByEvent({
      coachId,
      event: parsed.data.event,
      viewerAthleteId,
      viewerRole: session.role,
      limit: parsed.data.limit,
    });

    return NextResponse.json({ success: true, data: { entries } });
  } catch (err) {
    logger.error("GET /api/athlete/team/leaderboard", {
      context: "api",
      metadata: { error: String(err) },
    });
    return NextResponse.json(
      { success: false, error: "Failed to load leaderboard." },
      { status: 500 }
    );
  }
}
