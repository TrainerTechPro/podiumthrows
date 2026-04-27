import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, canActAsAthlete } from "@/lib/auth";
import { parseBody, DrillVideoRecommendSchema } from "@/lib/api-schemas";
import { logger } from "@/lib/logger";

// Focus keywords coaches commonly invoke when correcting throws technique.
// Lowercase. Matched as case-insensitive substrings against drill titles and
// notes. Keep this list short and concrete — false positives erode trust in
// "watch next" more than missing matches do.
const FOCUS_KEYWORDS = [
  "hip drive",
  "hip turn",
  "hip-shoulder",
  "block leg",
  "block side",
  "sweep leg",
  "single support",
  "double support",
  "balance",
  "finish",
  "recovery",
  "release",
  "knee bend",
  "low orbit",
  "high orbit",
  "separation",
  "posture",
  "head position",
  "foot speed",
  "footwork",
  "arm path",
  "shoulders",
  "pull",
  "push",
] as const;

const RECENT_VIEW_WINDOW_DAYS = 30;
const RECENT_FOCUS_WINDOW_DAYS = 14;
const TARGET_COUNT = 3;

type Candidate = {
  id: string;
  title: string;
  drillType: string;
  event: string;
  notes: string | null;
  duration: number;
  createdAt: Date;
  filePath: string;
};

function extractFocusKeywords(notes: string[]): string[] {
  const haystack = notes.join("\n").toLowerCase();
  return FOCUS_KEYWORDS.filter((kw) => haystack.includes(kw));
}

function matchesFocus(candidate: Candidate, focusKeywords: string[]): boolean {
  if (focusKeywords.length === 0) return false;
  const haystack = `${candidate.title}\n${candidate.notes ?? ""}`.toLowerCase();
  return focusKeywords.some((kw) => haystack.includes(kw));
}

/**
 * POST /api/drill-videos/recommend
 *
 * Body: { justWatchedId, athleteId? }
 *
 * Returns the top-3 ranked watch-next suggestions for the current athlete
 * after they finished a clip. Ranking signals:
 *   • +3 same drillType (the "phase" within a throw)
 *   • +2 same event
 *   • +2 title or notes match a recent coach-feedback focus keyword
 *   • +1 curated by their coach (uploadedBy = COACH)
 *   • tiebreak: most recent createdAt
 *
 * Already-watched videos in the last 30 days are excluded so the queue keeps
 * surfacing genuinely novel content. The same-athlete clip just played is
 * always excluded.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }
    if (!(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(request, DrillVideoRecommendSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { justWatchedId, athleteId: bodyAthleteId } = parsed;

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, coachId: true },
    });
    if (!athlete) {
      return NextResponse.json(
        { success: false, error: "Athlete profile not found" },
        { status: 404 }
      );
    }

    // If the body provides athleteId, it must match the session athlete.
    // Coaches don't get recs on behalf of athletes (yet) — punt that to v2.
    if (bodyAthleteId && bodyAthleteId !== athlete.id) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Verify the just-watched video belongs to this athlete. v1 keeps the
    // recommendation pool aligned with what the gallery and detail GET show
    // (athlete-owned only) so tapping a card always navigates somewhere
    // playable. v2 can broaden to the coach's library once those endpoints
    // also relax their access check.
    const justWatched = await prisma.drillVideo.findFirst({
      where: { id: justWatchedId, athleteId: athlete.id },
      select: { id: true, drillType: true, event: true },
    });
    if (!justWatched) {
      return NextResponse.json({ success: false, error: "Drill video not found" }, { status: 404 });
    }

    // Recently-seen IDs to exclude.
    const seenSince = new Date(Date.now() - RECENT_VIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recentViews = await prisma.drillVideoView.findMany({
      where: { athleteId: athlete.id, viewedAt: { gte: seenSince } },
      select: { drillVideoId: true },
    });
    const seenIds = new Set(recentViews.map((v) => v.drillVideoId));
    seenIds.add(justWatchedId);

    // Recent coach-feedback content for focus extraction. Bias toward the
    // technical category but include all categories — "hip drive" can show
    // up in a GENERAL note too.
    const focusSince = new Date(Date.now() - RECENT_FOCUS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recentNotes = await prisma.coachNote.findMany({
      where: { athleteProfileId: athlete.id, createdAt: { gte: focusSince } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { content: true },
    });
    const focusKeywords = extractFocusKeywords(recentNotes.map((n) => n.content));

    // Candidate pool: athlete's own clips, excluding seen-this-month ids.
    const candidates = await prisma.drillVideo.findMany({
      where: {
        athleteId: athlete.id,
        id: { notIn: [...seenIds] },
      },
      select: {
        id: true,
        title: true,
        drillType: true,
        event: true,
        notes: true,
        duration: true,
        createdAt: true,
        filePath: true,
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    });

    // Score and rank.
    const scored = candidates
      .map((c) => {
        let score = 0;
        if (c.drillType === justWatched.drillType) score += 3;
        if (c.event === justWatched.event) score += 2;
        if (matchesFocus(c, focusKeywords)) score += 2;
        return { candidate: c, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.candidate.createdAt.getTime() - a.candidate.createdAt.getTime();
      })
      .slice(0, TARGET_COUNT);

    const recommendations = scored.map(({ candidate: c, score }) => ({
      id: c.id,
      title: c.title,
      drillType: c.drillType,
      event: c.event,
      duration: c.duration,
      videoUrl: c.filePath.startsWith("http") ? c.filePath : `/api/drill-videos/serve?id=${c.id}`,
      score,
    }));

    // Impression log — paired with the persisted view records (source=
    // recommendation|autoplay, recommendedFromId=justWatchedId), this gives
    // CTR per source video without backfilling any tables.
    logger.info("drill recommend impressions", {
      context: "drill-videos/recommend",
      metadata: {
        athleteId: athlete.id,
        justWatchedId,
        focusKeywords,
        recommendedIds: recommendations.map((r) => r.id),
        candidatePoolSize: candidates.length,
      },
    });

    return NextResponse.json({ success: true, data: { recommendations, focusKeywords } });
  } catch (error) {
    logger.error("Drill recommend error", { context: "drill-videos/recommend", error });
    return NextResponse.json(
      { success: false, error: "Failed to compute recommendations" },
      { status: 500 }
    );
  }
}
