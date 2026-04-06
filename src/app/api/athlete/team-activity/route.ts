/**
 * GET /api/athlete/team-activity
 *
 * Chronological feed of activity rows scoped to the athlete's coach's
 * roster. Paginated via ?cursor={ISO} — clients pass the createdAt
 * timestamp of the last row they received to fetch older rows.
 *
 * Query params:
 *   - cursor (optional, ISO string): return rows strictly older than this
 *   - limit (optional, 1..100, default 50): page size
 *
 * Response:
 *   {
 *     items: TeamActivityItem[],
 *     nextCursor: string | null,  // ISO of last item's createdAt, or null if end
 *     hasMore: boolean,
 *   }
 *
 * Each item includes aggregated reactions (counts per emoji) and a
 * `myReactions` array telling the client which emojis the current user
 * has already tapped — used to render the pressed/unpressed state
 * without a second query.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type ReactionCounts = Record<string, number>;

type TeamActivityItem = {
  id: string;
  type: string;
  metadata: unknown;
  createdAt: string;
  coachId: string;
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  } | null;
  reactions: ReactionCounts;
  myReactions: string[];
};

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    // Parse pagination params
    const url = new URL(req.url);
    const cursorParam = url.searchParams.get("cursor");
    const limitParam = url.searchParams.get("limit");

    const cursor =
      cursorParam && !isNaN(new Date(cursorParam).getTime())
        ? new Date(cursorParam)
        : null;
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, limitParam ? parseInt(limitParam, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT)
    );

    // Fetch one extra row to detect hasMore without a second query
    const rows = await prisma.teamActivity.findMany({
      where: {
        coachId: athlete.coachId,
        ...(cursor ? { createdAt: { lt: cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        athlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? pageRows[pageRows.length - 1].createdAt.toISOString()
      : null;

    // Aggregate reactions for the visible page in a single query
    const activityIds = pageRows.map((r) => r.id);
    let reactionsByActivity = new Map<string, ReactionCounts>();
    let myReactionsByActivity = new Map<string, Set<string>>();

    if (activityIds.length > 0) {
      const allReactions = await prisma.teamActivityReaction.findMany({
        where: { activityId: { in: activityIds } },
        select: { activityId: true, emoji: true, userId: true },
      });

      const reactionMap: Record<string, ReactionCounts> = {};
      const mineMap: Record<string, Set<string>> = {};

      for (const r of allReactions) {
        if (!reactionMap[r.activityId]) reactionMap[r.activityId] = {};
        reactionMap[r.activityId][r.emoji] =
          (reactionMap[r.activityId][r.emoji] ?? 0) + 1;

        if (r.userId === session.userId) {
          if (!mineMap[r.activityId]) mineMap[r.activityId] = new Set();
          mineMap[r.activityId].add(r.emoji);
        }
      }

      reactionsByActivity = new Map(Object.entries(reactionMap));
      myReactionsByActivity = new Map(Object.entries(mineMap));
    }

    const items: TeamActivityItem[] = pageRows.map((row) => ({
      id: row.id,
      type: row.type,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      coachId: row.coachId,
      athlete: row.athlete
        ? {
            id: row.athlete.id,
            firstName: row.athlete.firstName,
            lastName: row.athlete.lastName,
            avatarUrl: row.athlete.avatarUrl,
          }
        : null,
      reactions: reactionsByActivity.get(row.id) ?? {},
      myReactions: Array.from(myReactionsByActivity.get(row.id) ?? []),
    }));

    return NextResponse.json({
      items,
      nextCursor,
      hasMore,
    });
  } catch (err) {
    logger.error("GET /api/athlete/team-activity", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to load team activity." },
      { status: 500 }
    );
  }
}
