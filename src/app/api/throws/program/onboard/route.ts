import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { validateOnboarding } from "@/lib/throws/engine";
import type { OnboardingData } from "@/lib/throws/engine";

// ── GET /api/throws/program/onboard ──────────────────────────────────
// Returns existing onboarding data from the athlete's profile + equipment.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const athleteProfile = await prisma.athleteProfile.findUnique({
      where: { userId: user.userId },
      include: {
        throwsTyping: true,
        throwsProfiles: true,
        equipmentInventory: true,
      },
    });

    if (!athleteProfile) {
      return NextResponse.json(
        { success: false, error: "No athlete profile found" },
        { status: 404 },
      );
    }

    // Pre-fill onboarding data from existing profile (loose typing for partial prefill)
    const prefill: Record<string, unknown> = {};

    // From ThrowsProfile
    const tp = athleteProfile.throwsProfiles?.[0];
    if (tp) {
      prefill.event = tp.event || undefined;
      prefill.gender = tp.gender || undefined;
      prefill.competitionPr = tp.competitionPb ?? undefined;
    }

    // From ThrowsTyping (adaptation data)
    const tt = athleteProfile.throwsTyping;
    if (tt) {
      prefill.typing = {
        adaptationGroup: tt.adaptationGroup ?? undefined,
        sessionsToForm: tt.estimatedSessionsToForm ?? undefined,
        recommendedMethod: tt.recommendedMethod ?? undefined,
      };
    }

    // From EquipmentInventory
    const eq = athleteProfile.equipmentInventory;
    if (eq) {
      let implementsList: unknown[] = [];
      try {
        implementsList = JSON.parse(eq.implements || "[]");
      } catch { /* empty */ }
      prefill.implements = implementsList;

      const facilities: Record<string, unknown> = {
        hasCage: eq.hasCage,
        hasRing: eq.hasRing,
        hasFieldAccess: eq.hasFieldAccess,
        hasGym: eq.hasGym,
      };
      if (eq.gymEquipment) {
        try {
          facilities.gymEquipment = JSON.parse(eq.gymEquipment);
        } catch { /* empty */ }
      }
      prefill.facilities = facilities;
    }

    return NextResponse.json({
      success: true,
      data: {
        prefill,
        hasTyping: !!tt?.adaptationGroup,
        hasEquipment: !!eq,
      },
    });
  } catch (error) {
    logger.error("Get onboarding error", {
      context: "throws/program/onboard",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to fetch onboarding data" },
      { status: 500 },
    );
  }
}

// ── POST /api/throws/program/onboard ─────────────────────────────────
// Submit completed onboarding data (validation + save).
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const athleteProfile = await prisma.athleteProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });

    if (!athleteProfile) {
      return NextResponse.json(
        { success: false, error: "No athlete profile found" },
        { status: 404 },
      );
    }

    const body = (await req.json()) as Partial<OnboardingData>;

    // Validate onboarding data
    const validation = validateOnboarding(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          errors: validation.errors,
        },
        { status: 400 },
      );
    }

    const data = body as OnboardingData;

    // Save equipment inventory
    if (data.implements) {
      await prisma.equipmentInventory.upsert({
        where: { athleteId: athleteProfile.id },
        update: {
          implements: JSON.stringify(data.implements),
          hasCage: data.facilities?.hasCage ?? true,
          hasRing: data.facilities?.hasRing ?? true,
          hasFieldAccess: data.facilities?.hasFieldAccess ?? true,
          hasGym: data.facilities?.hasGym ?? true,
          gymEquipment: data.facilities?.gymEquipment
            ? JSON.stringify(data.facilities.gymEquipment)
            : null,
        },
        create: {
          athleteId: athleteProfile.id,
          implements: JSON.stringify(data.implements),
          hasCage: data.facilities?.hasCage ?? true,
          hasRing: data.facilities?.hasRing ?? true,
          hasFieldAccess: data.facilities?.hasFieldAccess ?? true,
          hasGym: data.facilities?.hasGym ?? true,
          gymEquipment: data.facilities?.gymEquipment
            ? JSON.stringify(data.facilities.gymEquipment)
            : null,
        },
      });
    }

    // Save lifting PRs to ThrowsProfile.strengthBenchmarks if provided
    if (data.liftingPrs) {
      await prisma.throwsProfile.updateMany({
        where: { athleteId: athleteProfile.id },
        data: {
          strengthBenchmarks: JSON.stringify(data.liftingPrs),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: { validated: true, athleteId: athleteProfile.id },
    });
  } catch (error) {
    logger.error("Save onboarding error", {
      context: "throws/program/onboard",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to save onboarding data" },
      { status: 500 },
    );
  }
}
