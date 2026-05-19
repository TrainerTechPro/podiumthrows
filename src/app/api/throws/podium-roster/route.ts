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
import { parseBody, PodiumRosterEnrollSchema } from "@/lib/api-schemas";
import { computeDistanceBand, syncAdaptationFromTyping } from "@/lib/throws/podium-profile";
import type { EventCode, GenderCode } from "@/lib/throws/constants";
import { CODE_EVENT_MAP } from "@/lib/throws/constants";
import { logger } from "@/lib/logger";
import { EventType } from "@prisma/client";

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
            // Catalog-keyed PRs reshaped to the legacy throwsPRs contract so
            // the podium-roster UI stays unchanged. (athleteId, implementId)
            // uniqueness eliminates label-format dupes.
            athleteImplementPRs: {
              where: { bestDistance: { not: null } },
              select: {
                bestDistance: true,
                implement: { select: { throwType: true, displayLabel: true } },
              },
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

    const reshaped = roster.map((r) => ({
      ...r,
      athlete: {
        ...r.athlete,
        throwsPRs: r.athlete.athleteImplementPRs.map((pr) => ({
          event: pr.implement.throwType === "SHOT" ? "SHOT_PUT" : pr.implement.throwType,
          implement: pr.implement.displayLabel,
          distance: pr.bestDistance!,
        })),
      },
    }));

    return NextResponse.json({ success: true, data: reshaped });
  } catch (error) {
    logger.error("Get podium roster error", { context: "throws/podium-roster", error: error });
    return NextResponse.json({ success: false, error: "Couldn’t fetch roster" }, { status: 500 });
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

    const parsed = await parseBody(request, PodiumRosterEnrollSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { athleteId, gender, competitionPb } = parsed;
    // Accept both single `event` and array `events`
    const events: string[] = Array.isArray(parsed.events)
      ? parsed.events
      : parsed.event
        ? [parsed.event]
        : [];

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
      where: { id: parsed.athleteId },
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
            where: { athleteId: parsed.athleteId, event: { in: throwEventValues as EventType[] } },
            _max: { distance: true },
          })
        : [];

    // Catalog-keyed best distance per implement. ImplementType (SHOT) maps
    // to ThrowEvent (SHOT_PUT) before the EventCode lookup.
    const catalogPRBests = await prisma.athleteImplementPR.findMany({
      where: { athleteId: parsed.athleteId, bestDistance: { not: null } },
      select: {
        bestDistance: true,
        implement: { select: { throwType: true } },
      },
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
    for (const pr of catalogPRBests) {
      const event = pr.implement.throwType === "SHOT" ? "SHOT_PUT" : pr.implement.throwType;
      const code = Object.entries(CODE_EVENT_MAP).find(([, v]) => v === event)?.[0];
      if (code && pr.bestDistance != null && pr.bestDistance > 0) {
        bestMarkByEvent[code] = Math.max(bestMarkByEvent[code] ?? 0, pr.bestDistance);
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
        where: { athleteId_event: { athleteId, event: event as EventType } },
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
          event: event as EventType,
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
      { success: false, error: "Couldn’t enroll athlete" },
      { status: 500 }
    );
  }
}
