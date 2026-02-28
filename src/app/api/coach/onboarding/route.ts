/**
 * PATCH /api/coach/onboarding
 *
 * Sets onboardingCompletedAt on the coach profile.
 * Called when the coach completes all onboarding steps or clicks "Skip setup".
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "COACH") {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const action = body?.action;

    if (action !== "complete" && action !== "dismiss") {
      return NextResponse.json(
        { ok: false, error: "action must be 'complete' or 'dismiss'" },
        { status: 400 },
      );
    }

    await prisma.coachProfile.update({
      where: { userId: user.userId },
      data: { onboardingCompletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to update onboarding status" },
      { status: 500 },
    );
  }
}
