/**
 * /api/throws/podium-roster
 *
 * GET  — Coach's Podium Throws roster (active enrollments only)
 * POST — Enroll an athlete in Podium Throws (coach only)
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { computeDistanceBand, syncAdaptationFromTyping } from "@/lib/throws/podium-profile";
import type { EventCode, GenderCode } from "@/lib/throws/constants";
import { CODE_EVENT_MAP } from "@/lib/throws/constants";
import { logger } from "@/lib/logger";

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }
    if (currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coaches only" }, { status: 403 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 }
      );
    }

    const roster = await prisma.throwsProfile.findMany({
      where: { enrolledBy: coach.id, status: "active" },
      include: {
        athlete: {
          select: {
            id: true,
            avatarUrl: true,
            user: {
              select: { id: true, email: true },
            },
            throwsPRs: {
              select: { event: true, implement: true, distance: true },
            },
          },
        },
        testingRecords: {
          orderBy: { testDate: "desc" },
          take: 1,
          select: { testDate: true, testType: true },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });

    return NextResponse.json({ success: true, data: roster });
  } catch (error) {
    logger.error("Get podium roster error", { context: "throws/podium-roster", error: error });
    return NextResponse.json({ success: false, error: "Failed to fetch roster" }, { status: 500 });
  }
}

// ── POST ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }
    if (currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coaches only" }, { status: 403 });
    }

    const body = await request.json();
    const { athleteId, gender, competitionPb } = body;
    // Accept both single `event` and array `events`
    const events: string[] = Array.isArray(body.events)
      ? body.events
      : body.event
        ? [body.event]
        : [];

    if (!athleteId || events.length === 0 || !gender) {
      return NextResponse.json(
        { success: false, error: "athleteId, event(s), and gender are required" },
        { status: 400 }
      );
    }

    if (
      !(await canAccessAthlete(
        currentUser.userId,
        currentUser.role as "COACH" | "ATHLETE",
        athleteId
      ))
    ) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 }
      );
    }

    // Sync adaptation profile from existing ThrowsTyping if present
    const typing = await prisma.throwsTyping.findUnique({
      where: { athleteId },
    });
    const adaptationFields = typing ? syncAdaptationFromTyping(typing) : {};

    // ── Pull athlete profile data for auto-populate ────────────────
    const athleteData = await prisma.athleteProfile.findUnique({
      where: { id: body.athleteId },
      select: { heightCm: true, weightKg: true, dateOfBirth: true, gender: true },
    });

    // ── Scan existing best marks per event ──────────────────────────
    // Map EventCode → ThrowEvent enum for querying ThrowLog
    const throwEventValues = events
      .map((e: string) => CODE_EVENT_MAP[e as EventCode])
      .filter(Boolean);

    // ThrowLog best distance per event+implement
    const throwLogBests =
      throwEventValues.length > 0
        ? await prisma.throwLog.groupBy({
            by: ["event", "implementWeight"],
            where: { athleteId: body.athleteId, event: { in: throwEventValues } },
            _max: { distance: true },
          })
        : [];

    // ThrowsPR best distance per event (already aggregated PRs)
    const throwsPRBests = await prisma.throwsPR.findMany({
      where: { athleteId: body.athleteId },
      select: { event: true, implement: true, distance: true },
    });

    // Build a map of best mark per EventCode from all sources
    const bestMarkByEvent: Record<string, number> = {};
    for (const row of throwLogBests) {
      const maxDist = row._max.distance;
      if (maxDist != null) {
        const eventStr = String(row.event);
        const code = Object.entries(CODE_EVENT_MAP).find(([, v]) => v === eventStr)?.[0];
        if (code) {
          bestMarkByEvent[code] = Math.max(bestMarkByEvent[code] ?? 0, maxDist);
        }
      }
    }
    for (const pr of throwsPRBests) {
      // ThrowsPR.event is stored as ThrowEvent (e.g. "SHOT_PUT")
      const code = Object.entries(CODE_EVENT_MAP).find(([, v]) => v === pr.event)?.[0];
      if (code && pr.distance > 0) {
        bestMarkByEvent[code] = Math.max(bestMarkByEvent[code] ?? 0, pr.distance);
      }
    }

    const autoImportedMarks = Object.keys(bestMarkByEvent).length;

    // Upsert one ThrowsProfile per event
    const profiles = [];
    for (const event of events) {
      // Use coach-provided competitionPb if available, otherwise fall back to best mark
      const effectivePb =
        competitionPb != null && competitionPb > 0
          ? competitionPb
          : (bestMarkByEvent[event] ?? null);

      const currentDistanceBand =
        effectivePb != null && effectivePb > 0
          ? computeDistanceBand(event as EventCode, gender as GenderCode, effectivePb)
          : null;

      const profile = await prisma.throwsProfile.upsert({
        where: { athleteId_event: { athleteId, event } },
        update: {
          status: "active",
          enrolledBy: coach.id,
          gender,
          enrolledAt: new Date(),
          inactiveAt: null,
          ...(effectivePb != null && effectivePb > 0 ? { competitionPb: effectivePb } : {}),
          ...(currentDistanceBand ? { currentDistanceBand } : {}),
          ...adaptationFields,
        },
        create: {
          athleteId,
          enrolledBy: coach.id,
          event,
          gender,
          status: "active",
          ...(effectivePb != null && effectivePb > 0 ? { competitionPb: effectivePb } : {}),
          ...(currentDistanceBand ? { currentDistanceBand } : {}),
          ...adaptationFields,
        },
      });
      profiles.push(profile);
    }

    return NextResponse.json(
      {
        success: true,
        data: profiles.length === 1 ? profiles[0] : profiles,
        athleteData: athleteData
          ? {
              heightCm: athleteData.heightCm,
              weightKg: athleteData.weightKg,
              dateOfBirth: athleteData.dateOfBirth,
              gender: athleteData.gender,
            }
          : null,
        autoImportedMarks,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Enroll podium throws error", { context: "throws/podium-roster", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to enroll athlete" },
      { status: 500 }
    );
  }
}
