/**
 * GET /api/throws/program/prefill/[athleteId]
 *
 * Returns prefill data for the coach program builder wizard.
 * Fetches ThrowsProfile, ThrowsTyping, and EquipmentInventory for the given athlete.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(
  _req: NextRequest,
  { params }: { params: { athleteId: string } },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }
    if (user.role !== "COACH") {
      return NextResponse.json(
        { success: false, error: "Coaches only" },
        { status: 403 },
      );
    }

    const { athleteId } = params;

    const hasAccess = await canAccessAthlete(
      user.userId,
      "COACH",
      athleteId,
    );
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    // Fetch all data sources in parallel
    const [throwsProfile, throwsTyping, equipmentInventory] = await Promise.all([
      prisma.throwsProfile.findUnique({ where: { athleteId } }),
      prisma.throwsTyping.findUnique({ where: { athleteId } }),
      prisma.equipmentInventory.findUnique({ where: { athleteId } }),
    ]);

    // Parse JSON fields safely
    let implements_list: Array<{ weightKg: number; type: string }> = [];
    if (equipmentInventory?.implements) {
      try {
        implements_list = JSON.parse(equipmentInventory.implements);
      } catch {
        implements_list = [];
      }
    }

    let gymEquipment: Record<string, boolean> = {};
    if (equipmentInventory?.gymEquipment) {
      try {
        gymEquipment = JSON.parse(equipmentInventory.gymEquipment);
      } catch {
        gymEquipment = {};
      }
    }

    let strengthBenchmarks: Record<string, number> = {};
    if (throwsProfile?.strengthBenchmarks) {
      try {
        strengthBenchmarks = JSON.parse(throwsProfile.strengthBenchmarks);
      } catch {
        strengthBenchmarks = {};
      }
    }

    const prefill = {
      // Event & PR
      event: throwsProfile?.event ?? null,
      gender: throwsProfile?.gender ?? null,
      competitionPr: throwsProfile?.competitionPb ?? null,
      distanceBand: throwsProfile?.currentDistanceBand ?? null,

      // Equipment
      implements: implements_list,
      facilities: equipmentInventory
        ? {
            hasCage: equipmentInventory.hasCage,
            hasRing: equipmentInventory.hasRing,
            hasFieldAccess: equipmentInventory.hasFieldAccess,
            hasGym: equipmentInventory.hasGym,
            gymEquipment,
          }
        : null,

      // Lifting PRs
      liftingPrs: {
        squatKg: strengthBenchmarks.squatKg ?? null,
        benchKg: strengthBenchmarks.benchKg ?? null,
        cleanKg: strengthBenchmarks.cleanKg ?? null,
        snatchKg: strengthBenchmarks.snatchKg ?? null,
        ohpKg: strengthBenchmarks.ohpKg ?? null,
        deadliftKg: strengthBenchmarks.deadliftKg ?? null,
        bodyWeightKg: strengthBenchmarks.bodyWeightKg ?? null,
      },

      // Typing / Adaptation
      hasTyping: !!(throwsTyping?.adaptationGroup),
      typing: throwsTyping
        ? {
            adaptationGroup: throwsTyping.adaptationGroup ?? 2,
            sessionsToForm: throwsTyping.estimatedSessionsToForm ?? 25,
            recommendedMethod: throwsTyping.recommendedMethod ?? "complex",
            transferType: throwsTyping.transferType ?? null,
            recoveryProfile: throwsTyping.recoveryProfile ?? null,
          }
        : null,

      // Deficit analysis
      deficitPrimary: throwsProfile?.deficitPrimary ?? null,
      deficitSecondary: throwsProfile?.deficitSecondary ?? null,
    };

    return NextResponse.json({ success: true, data: { prefill } });
  } catch (error) {
    logger.error("Prefill program data error", {
      context: "throws/program/prefill",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to fetch prefill data" },
      { status: 500 },
    );
  }
}
