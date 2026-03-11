/**
 * /api/coach/preferences
 *
 * GET  — Returns parsed coach preferences (default pages, dashboard layout)
 * PUT  — Updates coach preferences
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export interface CoachPreferences {
  globalDefaultPage?: string;
  workspaceDefaults?: Record<string, string>;
  dashboardLayout?: { widgets: { id: string; visible: boolean; order: number }[] };
  myTraining?: {
    mode?: "competitive" | "recreational";
    primaryEvent?: string;
    gender?: "male" | "female";
  };
}

function parsePreferences(raw: string | null): CoachPreferences {
  try {
    return JSON.parse(raw || "{}") as CoachPreferences;
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coaches only" }, { status: 403 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { preferences: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: parsePreferences(coach.preferences) });
  } catch (error) {
    logger.error("Get preferences error", { context: "coach/preferences", error });
    return NextResponse.json({ success: false, error: "Failed to fetch preferences" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "COACH") {
      return NextResponse.json({ success: false, error: "Coaches only" }, { status: 403 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: currentUser.userId },
      select: { id: true, preferences: true },
    });
    if (!coach) {
      return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const current = parsePreferences(coach.preferences);

    // Merge patch — only update keys present in request body
    const updated: CoachPreferences = {
      ...current,
      ...(body.globalDefaultPage !== undefined ? { globalDefaultPage: body.globalDefaultPage } : {}),
      ...(body.workspaceDefaults !== undefined
        ? { workspaceDefaults: { ...current.workspaceDefaults, ...body.workspaceDefaults } }
        : {}),
      ...(body.dashboardLayout !== undefined ? { dashboardLayout: body.dashboardLayout } : {}),
      ...(body.myTraining !== undefined
        ? { myTraining: { ...current.myTraining, ...body.myTraining } }
        : {}),
    };

    await prisma.coachProfile.update({
      where: { id: coach.id },
      data: { preferences: JSON.stringify(updated) },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error("Update preferences error", { context: "coach/preferences", error });
    return NextResponse.json({ success: false, error: "Failed to update preferences" }, { status: 500 });
  }
}
