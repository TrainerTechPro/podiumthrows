import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ── GET /api/throws/equipment ────────────────────────────────────────
// Returns the athlete's equipment inventory.
export async function GET(_req: NextRequest) {
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

    const inventory = await prisma.equipmentInventory.findUnique({
      where: { athleteId: athleteProfile.id },
    });

    if (!inventory) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    // Parse JSON fields
    let implements_: unknown[] = [];
    let gymEquipment: unknown = null;
    try {
      implements_ = JSON.parse(inventory.implements || "[]");
    } catch { /* empty */ }
    try {
      gymEquipment = inventory.gymEquipment
        ? JSON.parse(inventory.gymEquipment)
        : null;
    } catch { /* empty */ }

    return NextResponse.json({
      success: true,
      data: {
        id: inventory.id,
        athleteId: inventory.athleteId,
        implements: implements_,
        hasCage: inventory.hasCage,
        hasRing: inventory.hasRing,
        hasFieldAccess: inventory.hasFieldAccess,
        hasGym: inventory.hasGym,
        gymEquipment,
      },
    });
  } catch (error) {
    logger.error("Get equipment error", {
      context: "throws/equipment",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to fetch equipment" },
      { status: 500 },
    );
  }
}

// ── POST /api/throws/equipment ───────────────────────────────────────
// Create or update the athlete's equipment inventory.
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

    const body = await req.json();
    const {
      implements: implementsList,
      hasCage,
      hasRing,
      hasFieldAccess,
      hasGym,
      gymEquipment,
    } = body;

    // Validate implements array
    if (!Array.isArray(implementsList)) {
      return NextResponse.json(
        { success: false, error: "implements must be an array" },
        { status: 400 },
      );
    }

    const inventory = await prisma.equipmentInventory.upsert({
      where: { athleteId: athleteProfile.id },
      update: {
        implements: JSON.stringify(implementsList),
        hasCage: hasCage ?? true,
        hasRing: hasRing ?? true,
        hasFieldAccess: hasFieldAccess ?? true,
        hasGym: hasGym ?? true,
        gymEquipment: gymEquipment ? JSON.stringify(gymEquipment) : null,
      },
      create: {
        athleteId: athleteProfile.id,
        implements: JSON.stringify(implementsList),
        hasCage: hasCage ?? true,
        hasRing: hasRing ?? true,
        hasFieldAccess: hasFieldAccess ?? true,
        hasGym: hasGym ?? true,
        gymEquipment: gymEquipment ? JSON.stringify(gymEquipment) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: inventory.id,
        athleteId: inventory.athleteId,
        implements: implementsList,
        hasCage: inventory.hasCage,
        hasRing: inventory.hasRing,
        hasFieldAccess: inventory.hasFieldAccess,
        hasGym: inventory.hasGym,
        gymEquipment,
      },
    });
  } catch (error) {
    logger.error("Save equipment error", {
      context: "throws/equipment",
      error,
    });
    return NextResponse.json(
      { success: false, error: "Failed to save equipment" },
      { status: 500 },
    );
  }
}
