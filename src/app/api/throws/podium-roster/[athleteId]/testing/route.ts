/**
 * /api/throws/podium-roster/[athleteId]/testing
 *
 * GET  — List testing records for an athlete (most recent first)
 * POST — Log a new testing record, then recompute + persist profile deficits
 */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import {
  computeDistanceBand,
  calculateDeficits,
} from "@/lib/throws/podium-profile";
import type { EventCode, GenderCode } from "@/lib/throws/constants";
import { CODE_EVENT_MAP } from "@/lib/throws/constants";
import type { StrengthBenchmarks } from "@/lib/throws/podium-profile";
import { logger } from "@/lib/logger";

// Convert profile codes ("HT"/"F") → KPI standard names ("HAMMER"/"FEMALE")
const GENDER_FULL: Record<string, string> = { M: "MALE", F: "FEMALE" };
function kpiEvent(e: string) { return CODE_EVENT_MAP[e as EventCode] ?? e; }
function kpiGender(g: string) { return GENDER_FULL[g] ?? g; }

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { athleteId } = await params;

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const records = await prisma.throwsTestingRecord.findMany({
      where: { athleteId },
      orderBy: { testDate: "desc" },
      take: 20,
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    logger.error("Get testing records error", { context: "throws/podium-roster/testing", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch testing records" },
      { status: 500 }
    );
  }
}

// ── POST ───────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }
    if (currentUser.role !== "COACH") {
      return NextResponse.json(
        { success: false, error: "Coaches only" },
        { status: 403 }
      );
    }

    const { athleteId } = await params;

    if (!(await canAccessAthlete(currentUser.userId, currentUser.role as "COACH" | "ATHLETE", athleteId))) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const profile = await prisma.throwsProfile.findFirst({
      where: { athleteId, status: "active" },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Athlete is not enrolled in Podium Throws" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      testDate,
      testType = "FULL_BATTERY",
      competitionMark,
      heavyImplMark,
      heavyImplKg,
      lightImplMark,
      lightImplKg,
      squatKg,
      benchKg,
      snatchKg,
      cleanKg,
      ohpKg,
      rdlKg,
      bodyWeightKg,
      notes,
    } = body;

    if (!testDate) {
      return NextResponse.json(
        { success: false, error: "testDate is required" },
        { status: 400 }
      );
    }

    // ── Resolve PB (use test mark if better than stored PB) ────────────
    const resolvedCompMark =
      competitionMark != null && competitionMark > 0
        ? competitionMark
        : (profile.competitionPb ?? 0);

    const resolvedBand =
      resolvedCompMark > 0
        ? computeDistanceBand(
            profile.event as EventCode,
            profile.gender as GenderCode,
            resolvedCompMark
          )
        : profile.currentDistanceBand;

    // ── Compute deficits for snapshot ──────────────────────────────────
    let deficitPrimaryAtTest: string | null = null;
    let deficitSecondaryAtTest: string | null = null;
    let overPoweredAtTest: boolean | null = null;

    if (resolvedCompMark > 0 && resolvedBand) {
      const kpiStandard = await prisma.throwsKpiStandard.findUnique({
        where: {
          event_gender_distanceBand: {
            event: kpiEvent(profile.event),
            gender: kpiGender(profile.gender),
            distanceBand: resolvedBand,
          },
        },
      });

      if (kpiStandard) {
        const strengthBenchmarks: StrengthBenchmarks | null =
          squatKg || benchKg || cleanKg || snatchKg || bodyWeightKg
            ? { squatKg, benchKg, cleanKg, snatchKg, bodyWeightKg }
            : null;

        const deficits = calculateDeficits(
          resolvedCompMark,
          heavyImplMark,
          lightImplMark,
          strengthBenchmarks,
          kpiStandard
        );

        deficitPrimaryAtTest = deficits.primary;
        deficitSecondaryAtTest = deficits.secondary;
        overPoweredAtTest = deficits.overPowered;
      }
    }

    // ── Create testing record ──────────────────────────────────────────
    const record = await prisma.throwsTestingRecord.create({
      data: {
        throwsProfileId: profile.id,
        athleteId,
        testDate,
        testType,
        ...(competitionMark != null ? { competitionMark } : {}),
        ...(heavyImplMark != null ? { heavyImplMark } : {}),
        ...(heavyImplKg != null ? { heavyImplKg } : {}),
        ...(lightImplMark != null ? { lightImplMark } : {}),
        ...(lightImplKg != null ? { lightImplKg } : {}),
        ...(squatKg != null ? { squatKg } : {}),
        ...(benchKg != null ? { benchKg } : {}),
        ...(snatchKg != null ? { snatchKg } : {}),
        ...(cleanKg != null ? { cleanKg } : {}),
        ...(ohpKg != null ? { ohpKg } : {}),
        ...(rdlKg != null ? { rdlKg } : {}),
        ...(bodyWeightKg != null ? { bodyWeightKg } : {}),
        ...(notes != null ? { notes } : {}),
        distanceBandAtTest: resolvedBand,
        ...(deficitPrimaryAtTest != null
          ? { deficitPrimaryAtTest }
          : {}),
        ...(deficitSecondaryAtTest != null
          ? { deficitSecondaryAtTest }
          : {}),
        ...(overPoweredAtTest != null ? { overPoweredAtTest } : {}),
      },
    });

    // ── Update profile: promote PRs if this test sets new bests ───────
    const profileUpdate: Record<string, unknown> = {};

    // Competition PB
    if (
      competitionMark != null &&
      competitionMark > 0 &&
      (profile.competitionPb == null || competitionMark > profile.competitionPb)
    ) {
      profileUpdate.competitionPb = competitionMark;
      profileUpdate.currentDistanceBand = computeDistanceBand(
        profile.event as EventCode,
        profile.gender as GenderCode,
        competitionMark
      );
    }

    // Heavy implement PR
    if (
      heavyImplMark != null &&
      heavyImplMark > 0 &&
      (profile.heavyImplementPr == null || heavyImplMark > profile.heavyImplementPr)
    ) {
      profileUpdate.heavyImplementPr = heavyImplMark;
      if (heavyImplKg != null) profileUpdate.heavyImplementKg = heavyImplKg;
    }

    // Light implement PR
    if (
      lightImplMark != null &&
      lightImplMark > 0 &&
      (profile.lightImplementPr == null || lightImplMark > profile.lightImplementPr)
    ) {
      profileUpdate.lightImplementPr = lightImplMark;
      if (lightImplKg != null) profileUpdate.lightImplementKg = lightImplKg;
    }

    // Strength benchmarks — always update snapshot with latest values
    if (squatKg || benchKg || cleanKg || snatchKg || bodyWeightKg) {
      const existingBenchmarks: StrengthBenchmarks = profile.strengthBenchmarks
        ? JSON.parse(profile.strengthBenchmarks as string)
        : {};
      const merged: StrengthBenchmarks = {
        ...existingBenchmarks,
        ...(squatKg != null ? { squatKg } : {}),
        ...(benchKg != null ? { benchKg } : {}),
        ...(cleanKg != null ? { cleanKg } : {}),
        ...(snatchKg != null ? { snatchKg } : {}),
        ...(ohpKg != null ? { ohpKg } : {}),
        ...(bodyWeightKg != null ? { bodyWeightKg } : {}),
      };
      profileUpdate.strengthBenchmarks = JSON.stringify(merged);
    }

    // Recompute profile-level deficits with latest data
    const finalPb =
      (profileUpdate.competitionPb as number | null | undefined) ?? profile.competitionPb;
    const finalBand =
      (profileUpdate.currentDistanceBand as string | null | undefined) ?? profile.currentDistanceBand;

    if (finalPb && finalBand) {
      const kpiStandard = await prisma.throwsKpiStandard.findUnique({
        where: {
          event_gender_distanceBand: {
            event: kpiEvent(profile.event),
            gender: kpiGender(profile.gender),
            distanceBand: finalBand,
          },
        },
      });

      if (kpiStandard) {
        const heavyPr =
          (profileUpdate.heavyImplementPr as number | null | undefined) ?? profile.heavyImplementPr;
        const lightPr =
          (profileUpdate.lightImplementPr as number | null | undefined) ?? profile.lightImplementPr;
        const rawBenchmarks =
          (profileUpdate.strengthBenchmarks as string | null | undefined) ?? profile.strengthBenchmarks;
        const strengthBenchmarks: StrengthBenchmarks | null = rawBenchmarks
          ? JSON.parse(rawBenchmarks as string)
          : null;

        const deficits = calculateDeficits(
          finalPb,
          heavyPr,
          lightPr,
          strengthBenchmarks,
          kpiStandard
        );

        profileUpdate.deficitPrimary = deficits.primary;
        profileUpdate.deficitSecondary = deficits.secondary;
        profileUpdate.deficitStatus = deficits.overallStatus;
        profileUpdate.overPowered = deficits.overPowered;
      }
    }

    if (Object.keys(profileUpdate).length > 0) {
      await prisma.throwsProfile.update({
        where: { id: profile.id },
        data: profileUpdate as Prisma.ThrowsProfileUpdateInput,
      });
    }

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    logger.error("Create testing record error", { context: "throws/podium-roster/testing", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to create testing record" },
      { status: 500 }
    );
  }
}
