/**
 * PATCH /api/coach/onboarding
 *
 * Sets onboardingCompletedAt on the coach profile.
 * Called when the coach completes all onboarding steps or clicks "Skip setup".
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const action = body?.action;

    if (action !== "complete" && action !== "dismiss") {
      return NextResponse.json(
        { success: false, error: "action must be 'complete' or 'dismiss'" },
        { status: 400 }
      );
    }

    await prisma.coachProfile.update({
      where: { userId: user.userId },
      data: { onboardingCompletedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (err) {
    logger.error("PATCH /api/coach/onboarding", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to update onboarding status" },
      { status: 500 }
    );
  }
}
