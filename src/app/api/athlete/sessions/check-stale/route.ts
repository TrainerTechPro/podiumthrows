/**
 * Check-stale — detects a TrainingSession that should be auto-completed
 * because the athlete stopped throwing a while ago.
 *
 * Rule: a session is "stale" if
 *   - status is SCHEDULED or IN_PROGRESS (i.e., not COMPLETED or SKIPPED)
 *   - has at least one throwLog
 *   - the most recent throwLog is older than STALE_MINUTES and newer than MAX_AGE_MINUTES
 *     (the MAX_AGE guard prevents surfacing week-old abandoned sessions)
 *
 * Called by the athlete dashboard on mount. If a stale session is found,
 * the client is expected to redirect the athlete to its recap URL. The
 * recap render happens independently; this endpoint only identifies the
 * session id. Auto-completion itself is performed via the existing
 * PATCH /api/athlete/sessions/[id]/complete endpoint.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

const STALE_MINUTES = 90;
const MAX_AGE_MINUTES = 60 * 6; // 6 hours — older than this, don't surface

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const now = Date.now();
    const staleThreshold = new Date(now - STALE_MINUTES * 60_000);
    const maxAgeThreshold = new Date(now - MAX_AGE_MINUTES * 60_000);

    // Find open sessions for this athlete (any non-terminal status)
    // We search the throwLogs table directly for efficiency and pick the
    // session whose most-recent throw is inside the stale window.
    const recentThrows = await prisma.throwLog.findMany({
      where: {
        athleteId: athlete.id,
        sessionId: { not: null },
        date: { gte: maxAgeThreshold },
      },
      orderBy: { date: "desc" },
      select: { sessionId: true, date: true },
      take: 50,
    });

    // Group by sessionId and take the freshest throw per session
    const sessionLastThrow = new Map<string, Date>();
    for (const t of recentThrows) {
      if (!t.sessionId) continue;
      const existing = sessionLastThrow.get(t.sessionId);
      if (!existing || t.date > existing) {
        sessionLastThrow.set(t.sessionId, t.date);
      }
    }

    // Candidate sessions: those whose last throw is older than STALE_MINUTES
    const staleCandidates = Array.from(sessionLastThrow.entries())
      .filter(([, last]) => last < staleThreshold)
      .map(([id, last]) => ({ id, lastThrowAt: last }));

    if (staleCandidates.length === 0) {
      return NextResponse.json({ staleSession: null });
    }

    // Verify the session is still open (not COMPLETED/SKIPPED)
    const openSessions = await prisma.trainingSession.findMany({
      where: {
        id: { in: staleCandidates.map((s) => s.id) },
        athleteId: athlete.id,
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      },
      select: { id: true },
    });

    if (openSessions.length === 0) {
      return NextResponse.json({ staleSession: null });
    }

    // Prefer the one with the most recent lastThrowAt (the session the
    // athlete was most actively working on)
    const openIds = new Set(openSessions.map((s) => s.id));
    const chosen = staleCandidates
      .filter((s) => openIds.has(s.id))
      .sort((a, b) => b.lastThrowAt.getTime() - a.lastThrowAt.getTime())[0];

    if (!chosen) {
      return NextResponse.json({ staleSession: null });
    }

    return NextResponse.json({
      staleSession: {
        id: chosen.id,
        lastThrowAt: chosen.lastThrowAt.toISOString(),
        staleMinutes: Math.round((now - chosen.lastThrowAt.getTime()) / 60_000),
      },
    });
  } catch (err) {
    logger.error("POST /api/athlete/sessions/check-stale", {
      context: "api",
      error: err,
    });
    return NextResponse.json({ success: false, error: "Failed to check." }, { status: 500 });
  }
}
