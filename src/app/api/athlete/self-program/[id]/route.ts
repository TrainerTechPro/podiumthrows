/**
 * GET / PUT / DELETE  /api/athlete/self-program/[id]
 *
 * CRUD operations on a single SelfProgramConfig.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { canAccessSelfProgram } from "@/lib/authorize";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { parseBody, SelfProgramUpdateSchema } from "@/lib/api-schemas";

type RouteContext = { params: Promise<{ id: string }> };

/* ─── Locked fields — identity of the program, cannot be edited ──────── */
const LOCKED_FIELDS = ["event", "gender", "competitionLevel", "yearsExperience", "currentPR"];

/* ─── Allowed fields for PUT updates ─────────────────────────────────── */
const ALLOWED_FIELDS = new Set([
  "programType",
  "goalDistance",
  "currentWeeklyVolume",
  "availableImplements",
  "daysPerWeek",
  "sessionsPerDay",
  "preferredDays",
  "startDate",
  "competitionDates",
  "primaryGoal",
  "generationMode",
  "exercisePreferences",
  "usedExistingTyping",
  "inlineTypingData",
  "isDraft",
  "isActive",
]);

/* ─── GET — fetch config with linked training program ────────────────── */

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const canAccess = await canAccessSelfProgram(session.userId);
    if (!canAccess) {
      return NextResponse.json(
        { success: false, error: "Self-programming not enabled" },
        { status: 403 }
      );
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const { id } = await params;

    const config = await prisma.selfProgramConfig.findUnique({
      where: { id },
      include: {
        trainingProgram: {
          include: {
            phases: {
              orderBy: { phaseOrder: "asc" },
              select: {
                id: true,
                phase: true,
                phaseOrder: true,
                startWeek: true,
                endWeek: true,
                durationWeeks: true,
                throwsPerWeekTarget: true,
                strengthDaysTarget: true,
                status: true,
                _count: {
                  select: {
                    sessions: {
                      where: { status: "COMPLETED" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!config) {
      return NextResponse.json({ success: false, error: "Config not found" }, { status: 404 });
    }

    // Ownership check
    if (config.athleteProfileId !== athlete.id) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: { config } });
  } catch (err) {
    logger.error("GET /api/athlete/self-program/[id]", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to fetch self-program config." },
      { status: 500 }
    );
  }
}

/* ─── PUT — update wizard fields ─────────────────────────────────────── */

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const canAccess = await canAccessSelfProgram(session.userId);
    if (!canAccess) {
      return NextResponse.json(
        { success: false, error: "Self-programming not enabled" },
        { status: 403 }
      );
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.selfProgramConfig.findUnique({
      where: { id },
      select: { id: true, athleteProfileId: true, isDraft: true, trainingProgramId: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Config not found" }, { status: 404 });
    }
    if (existing.athleteProfileId !== athlete.id) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseBody(req, SelfProgramUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const body: Record<string, unknown> = parsed;

    // Locked fields are only locked on finalized configs that already have a
    // generated program. During wizard flow (drafts or configs without a
    // program yet), all fields must be editable — the user is still choosing.
    //
    // On finalized programs, reject the request outright instead of silently
    // stripping locked fields — that way the client gets a clear error and
    // the user is told to create a new program if they want to change event,
    // gender, or their baseline PR.
    const isLocked = !existing.isDraft && !!existing.trainingProgramId;
    if (isLocked) {
      const lockedAttempt = LOCKED_FIELDS.filter((f) => f in body);
      if (lockedAttempt.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot modify locked fields: ${lockedAttempt.join(", ")}. Create a new program instead.`,
          },
          { status: 400 }
        );
      }
    }

    // Server-side validation for editable fields
    const typedBody: Record<string, unknown> = body;
    if ("daysPerWeek" in typedBody) {
      const v = typedBody.daysPerWeek;
      if (typeof v !== "number" || v < 2 || v > 5) {
        return NextResponse.json(
          { success: false, error: "daysPerWeek must be a number between 2 and 5." },
          { status: 400 }
        );
      }
    }
    if ("sessionsPerDay" in typedBody) {
      const v = typedBody.sessionsPerDay;
      if (v !== 1 && v !== 2) {
        return NextResponse.json(
          { success: false, error: "sessionsPerDay must be 1 or 2." },
          { status: 400 }
        );
      }
    }
    if ("preferredDays" in typedBody) {
      const validDays = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ];
      const v = typedBody.preferredDays;
      if (!Array.isArray(v) || v.some((d) => !validDays.includes(d as string))) {
        return NextResponse.json(
          {
            success: false,
            error: "preferredDays must be an array of valid day names (Monday–Sunday).",
          },
          { status: 400 }
        );
      }
      if ("daysPerWeek" in typedBody && v.length !== (typedBody.daysPerWeek as number)) {
        return NextResponse.json(
          { success: false, error: "preferredDays length must match daysPerWeek." },
          { status: 400 }
        );
      }
    }
    if ("availableImplements" in typedBody) {
      const v = typedBody.availableImplements;
      if (!Array.isArray(v) || v.length < 1) {
        return NextResponse.json(
          { success: false, error: "availableImplements must be an array with at least 1 item." },
          { status: 400 }
        );
      }
    }

    // When not locked, identity fields (event, gender, etc.) are also editable
    const allowedFields = new Set(ALLOWED_FIELDS);
    if (!isLocked) {
      for (const f of LOCKED_FIELDS) allowedFields.add(f);
    }

    const data: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      if (!allowedFields.has(key)) continue;

      // Convert startDate string to Date object
      if (key === "startDate" && typeof value === "string") {
        const d = new Date(value);
        if (isNaN(d.getTime())) {
          return NextResponse.json({ success: false, error: "Invalid startDate" }, { status: 400 });
        }
        data[key] = d;
      } else {
        data[key] = value;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update." },
        { status: 400 }
      );
    }

    const updated = await prisma.selfProgramConfig.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, data: { config: updated } });
  } catch (err) {
    logger.error("PUT /api/athlete/self-program/[id]", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to update self-program config." },
      { status: 500 }
    );
  }
}

/* ─── DELETE — soft-deactivate config and archive linked program ──────── */

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    if (!session || !(await canActAsAthlete(session))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const canAccess = await canAccessSelfProgram(session.userId);
    if (!canAccess) {
      return NextResponse.json(
        { success: false, error: "Self-programming not enabled" },
        { status: 403 }
      );
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
    }

    const { id } = await params;

    const existing = await prisma.selfProgramConfig.findUnique({
      where: { id },
      select: { id: true, athleteProfileId: true, trainingProgramId: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Config not found" }, { status: 404 });
    }
    if (existing.athleteProfileId !== athlete.id) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      // Deactivate the config
      await tx.selfProgramConfig.update({
        where: { id },
        data: { isActive: false },
      });

      // Archive the linked training program if one exists
      if (existing.trainingProgramId) {
        await tx.trainingProgram.update({
          where: { id: existing.trainingProgramId },
          data: { status: "ARCHIVED" },
        });
      }
    });

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (err) {
    logger.error("DELETE /api/athlete/self-program/[id]", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to deactivate self-program config." },
      { status: 500 }
    );
  }
}
