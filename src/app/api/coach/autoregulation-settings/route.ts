import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const DEFAULT_TIMESCALES = {
  intraSession: true,
  sessionToSession: true,
  weekToWeek: true,
  blockToBlock: true,
  programToProgram: true,
};

function parseTimescales(json: string | null | undefined) {
  if (!json) return { ...DEFAULT_TIMESCALES };
  try {
    return { ...DEFAULT_TIMESCALES, ...JSON.parse(json) };
  } catch {
    return { ...DEFAULT_TIMESCALES };
  }
}

/**
 * GET /api/coach/autoregulation-settings
 * Returns the coach's global settings + per-athlete overrides.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "COACH") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 },
      );
    }

    // Coach-global settings (athleteId = null)
    const coachRow = await prisma.autoregulationSettings.findUnique({
      where: { coachId_athleteId: { coachId: coach.id, athleteId: "" } },
    });

    // Athletes with active programs under this coach
    const athletes = await prisma.athleteProfile.findMany({
      where: {
        trainingPrograms: { some: { coachId: coach.id, status: "ACTIVE" } },
      },
      select: { id: true, firstName: true, lastName: true },
    });

    // Per-athlete overrides
    const overrides = athletes.length > 0
      ? await prisma.autoregulationSettings.findMany({
          where: {
            coachId: coach.id,
            athleteId: { in: athletes.map((a) => a.id) },
          },
        })
      : [];
    const overrideMap = new Map(overrides.map((o) => [o.athleteId, o]));

    return NextResponse.json({
      success: true,
      data: {
        coachSelf: {
          mode: coachRow?.mode ?? "NOTIFY",
          timescales: parseTimescales(coachRow?.timescalesJson),
        },
        athletes: athletes.map((a) => {
          const override = overrideMap.get(a.id);
          return {
            athleteId: a.id,
            firstName: a.firstName,
            lastName: a.lastName,
            mode: override?.mode ?? null,
            timescales: override
              ? parseTimescales(override.timescalesJson)
              : { ...DEFAULT_TIMESCALES },
          };
        }),
      },
    });
  } catch (error) {
    logger.error("GET autoregulation-settings error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to load settings" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/coach/autoregulation-settings
 * Updates coach-global or per-athlete autoregulation settings.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "COACH") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const { targetType } = body;

    if (targetType === "COACH_SELF") {
      const { mode, timescales } = body;
      await prisma.autoregulationSettings.upsert({
        where: { coachId_athleteId: { coachId: coach.id, athleteId: "" } },
        create: {
          coachId: coach.id,
          athleteId: "",
          mode: mode ?? "NOTIFY",
          timescalesJson: JSON.stringify(timescales ?? DEFAULT_TIMESCALES),
        },
        update: {
          mode: mode ?? "NOTIFY",
          timescalesJson: JSON.stringify(timescales ?? DEFAULT_TIMESCALES),
        },
      });

      return NextResponse.json({ success: true });
    }

    if (targetType === "ATHLETES") {
      const { athletes } = body as {
        athletes: { athleteId: string; mode: string | null; timescales: Record<string, boolean> }[];
      };

      await Promise.all(
        athletes.map((a) =>
          prisma.autoregulationSettings.upsert({
            where: { coachId_athleteId: { coachId: coach.id, athleteId: a.athleteId } },
            create: {
              coachId: coach.id,
              athleteId: a.athleteId,
              mode: a.mode ?? "NOTIFY",
              timescalesJson: JSON.stringify(a.timescales ?? DEFAULT_TIMESCALES),
            },
            update: {
              mode: a.mode ?? "NOTIFY",
              timescalesJson: JSON.stringify(a.timescales ?? DEFAULT_TIMESCALES),
            },
          }),
        ),
      );

      return NextResponse.json({ success: true });
    }

    if (targetType === "ATHLETE") {
      const { athleteId, mode } = body;
      if (mode === null) {
        // Reset to coach default — delete the override row
        await prisma.autoregulationSettings.deleteMany({
          where: { coachId: coach.id, athleteId },
        });
      } else {
        await prisma.autoregulationSettings.upsert({
          where: { coachId_athleteId: { coachId: coach.id, athleteId } },
          create: {
            coachId: coach.id,
            athleteId,
            mode,
            timescalesJson: JSON.stringify(DEFAULT_TIMESCALES),
          },
          update: { mode },
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Invalid targetType" },
      { status: 400 },
    );
  } catch (error) {
    logger.error("PATCH autoregulation-settings error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to save settings" },
      { status: 500 },
    );
  }
}
