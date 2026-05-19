import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { parseBody } from "@/lib/api-schemas";
import prisma from "@/lib/prisma";
import { parseUnitPrefs } from "@/lib/units/types";

const UnitChoiceEnum = z.enum(["metric", "imperial"]);

/**
 * Patch body: any subset of the per-type prefs. Fields the user didn't
 * include are left as-is. Server merges into the existing JSON instead of
 * replacing — keeps offline / multi-device updates from clobbering each
 * other's keys.
 */
const PatchSchema = z.object({
  throwDistance: UnitChoiceEnum.optional(),
  verticalJump: UnitChoiceEnum.optional(),
  broadJump: UnitChoiceEnum.optional(),
  bodyWeight: UnitChoiceEnum.optional(),
  liftingWeight: UnitChoiceEnum.optional(),
  height: UnitChoiceEnum.optional(),
  /// Legacy key from PR #46 — kept so an in-flight client (cached JS) can
  /// still PATCH without erroring. Server normalizes to throwDistance below.
  distance: UnitChoiceEnum.optional(),
});

/**
 * GET /api/me/display-units — return the calling user's prefs (parsed
 * with defaults filled in). Used by the Settings panel and by clients
 * that mount the provider lazily.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (session.role === "COACH") {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: session.userId },
        select: { displayUnits: true },
      });
      return NextResponse.json({ success: true, data: parseUnitPrefs(coach?.displayUnits) });
    }
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { displayUnits: true },
    });
    return NextResponse.json({ success: true, data: parseUnitPrefs(athlete?.displayUnits) });
  } catch (error) {
    logger.error("GET /api/me/display-units", { context: "units", error });
    return NextResponse.json(
      { success: false, error: "Couldn’t load unit preferences" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/me/display-units — merge a subset of prefs into the user's
 * stored JSON. The provider fires this on every toggle; a 500 here doesn't
 * break the UI because localStorage already holds the new value.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseBody(request, PatchSchema);
    if (parsed instanceof NextResponse) return parsed;
    if (Object.keys(parsed).length === 0) {
      return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
    }

    // Normalize legacy `distance` key (PR #46) → `throwDistance`. If the
    // client sent both, throwDistance wins.
    const { distance: legacyDistance, ...rest } = parsed;
    const normalized: Record<string, "metric" | "imperial"> = { ...rest };
    if (legacyDistance && !normalized.throwDistance) {
      normalized.throwDistance = legacyDistance;
    }

    if (session.role === "COACH") {
      const coach = await prisma.coachProfile.findUnique({
        where: { userId: session.userId },
        select: { id: true, displayUnits: true },
      });
      if (!coach) {
        return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
      }
      const merged = { ...parseUnitPrefs(coach.displayUnits), ...normalized };
      await prisma.coachProfile.update({
        where: { id: coach.id },
        data: { displayUnits: merged },
      });
      return NextResponse.json({ success: true, data: merged });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, displayUnits: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }
    const merged = { ...parseUnitPrefs(athlete.displayUnits), ...normalized };
    await prisma.athleteProfile.update({
      where: { id: athlete.id },
      data: { displayUnits: merged },
    });
    return NextResponse.json({ success: true, data: merged });
  } catch (error) {
    logger.error("PATCH /api/me/display-units", { context: "units", error });
    return NextResponse.json(
      { success: false, error: "Couldn’t update unit preferences" },
      { status: 500 }
    );
  }
}
