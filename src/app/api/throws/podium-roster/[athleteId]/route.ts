/**
 * /api/throws/podium-roster/[athleteId]
 *
 * GET   — Fetch a single athlete's Podium Throws profile
 * PATCH — Update profile fields or remove athlete from roster
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

    const profile = await prisma.throwsProfile.findUnique({
      where: { athleteId },
      include: {
        athlete: {
          select: {
            id: true,
            avatarUrl: true,
            user: {
              select: { id: true, email: true },
            },
          },
        },
        testingRecords: {
          orderBy: { testDate: "desc" },
          take: 5,
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Athlete is not enrolled in Podium Throws" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    logger.error("Get podium profile error", { context: "throws/podium-roster", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// ── PATCH ──────────────────────────────────────────────────────────────────

export async function PATCH(
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

    const profile = await prisma.throwsProfile.findUnique({
      where: { athleteId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // ── Status change (remove = set inactive) ──────────────────────
    if (body.status === "inactive") {
      updateData.status = "inactive";
      updateData.inactiveAt = new Date();
    }

    // ── Competition PB → recompute distance band ───────────────────
    if (body.competitionPb != null) {
      updateData.competitionPb = body.competitionPb;
      updateData.currentDistanceBand = computeDistanceBand(
        profile.event as EventCode,
        profile.gender as GenderCode,
        body.competitionPb
      );
    }

    // ── Implement PRs ──────────────────────────────────────────────
    if (body.heavyImplementPr != null)
      updateData.heavyImplementPr = body.heavyImplementPr;
    if (body.heavyImplementKg != null)
      updateData.heavyImplementKg = body.heavyImplementKg;
    if (body.lightImplementPr != null)
      updateData.lightImplementPr = body.lightImplementPr;
    if (body.lightImplementKg != null)
      updateData.lightImplementKg = body.lightImplementKg;

    // ── Strength benchmarks ────────────────────────────────────────
    if (body.strengthBenchmarks != null) {
      updateData.strengthBenchmarks = JSON.stringify(body.strengthBenchmarks);
    }

    // ── Adaptation fields ──────────────────────────────────────────
    if (body.adaptationProfile != null)
      updateData.adaptationProfile = body.adaptationProfile;
    if (body.sessionsToForm != null)
      updateData.sessionsToForm = body.sessionsToForm;
    if (body.recommendedMethod != null)
      updateData.recommendedMethod = body.recommendedMethod;
    if (body.coachNotes != null) updateData.coachNotes = body.coachNotes;

    // ── Recompute deficits if we have enough data ──────────────────
    const resolvedPb =
      (updateData.competitionPb as number | null | undefined) ?? profile.competitionPb;
    const resolvedBand =
      (updateData.currentDistanceBand as string | null | undefined) ?? profile.currentDistanceBand;

    if (resolvedPb && resolvedBand) {
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
        const heavyPr =
          (updateData.heavyImplementPr as number | null | undefined) ?? profile.heavyImplementPr;
        const lightPr =
          (updateData.lightImplementPr as number | null | undefined) ?? profile.lightImplementPr;
        const rawBenchmarks =
          (updateData.strengthBenchmarks as string | null | undefined) ?? profile.strengthBenchmarks;
        const strengthBenchmarks: StrengthBenchmarks | null = rawBenchmarks
          ? JSON.parse(rawBenchmarks as string)
          : null;

        const deficits = calculateDeficits(
          resolvedPb,
          heavyPr,
          lightPr,
          strengthBenchmarks,
          kpiStandard
        );

        updateData.deficitPrimary = deficits.primary;
        updateData.deficitSecondary = deficits.secondary;
        updateData.deficitStatus = deficits.overallStatus;
        updateData.overPowered = deficits.overPowered;
      }
    }

    const updated = await prisma.throwsProfile.update({
      where: { athleteId },
      data: updateData as Prisma.ThrowsProfileUpdateInput,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error("Update podium profile error", { context: "throws/podium-roster", error: error });
    return NextResponse.json(
      { success: false, error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
