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

    const profiles = await prisma.throwsProfile.findMany({
      where: { athleteId, status: "active" },
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

    if (profiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "Athlete is not enrolled in Podium Throws" },
        { status: 404 }
      );
    }

    // Return first profile as `data` for backward compat, plus full array
    return NextResponse.json({ success: true, data: profiles[0], profiles });
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

    const body = await request.json();

    // ── Status change (remove = set inactive for ALL profiles) ─────
    if (body.status === "inactive") {
      await prisma.throwsProfile.updateMany({
        where: { athleteId },
        data: { status: "inactive", inactiveAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    // For other updates, find the specific profile (by event if provided, else first active)
    const profile = body.event
      ? await prisma.throwsProfile.findUnique({
          where: { athleteId_event: { athleteId, event: body.event } },
        })
      : await prisma.throwsProfile.findFirst({
          where: { athleteId, status: "active" },
        });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

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
      where: { id: profile.id },
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
