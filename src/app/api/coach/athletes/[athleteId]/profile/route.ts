import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBody, CoachEditProfileSchema } from "@/lib/api-schemas";
import { requireCoachAthlete } from "@/lib/data/coach";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  const { athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const parsed = await parseBody(request, CoachEditProfileSchema);
  if (parsed instanceof NextResponse) return parsed;

  const isClaimed = ctx.athlete.user.claimedAt != null;

  // Build update data respecting permission rules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  // Core info — only editable on unclaimed profiles
  if (!isClaimed) {
    if (parsed.firstName !== undefined) updateData.firstName = parsed.firstName;
    if (parsed.lastName !== undefined) updateData.lastName = parsed.lastName;
    if (parsed.gender !== undefined) updateData.gender = parsed.gender;
    if (parsed.events !== undefined) updateData.events = parsed.events;
    if (parsed.dateOfBirth !== undefined) {
      updateData.dateOfBirth = parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : null;
    }
    if (parsed.heightCm !== undefined) updateData.heightCm = parsed.heightCm;
    if (parsed.weightKg !== undefined) updateData.weightKg = parsed.weightKg;
    if (parsed.classStanding !== undefined) updateData.classStanding = parsed.classStanding;
    if (parsed.gradYear !== undefined) updateData.gradYear = parsed.gradYear;
    if (parsed.turnDirection !== undefined) updateData.turnDirection = parsed.turnDirection;
  }

  // Coaching fields — always editable by coach
  if (parsed.strengthNumbers !== undefined) updateData.strengthNumbers = parsed.strengthNumbers;
  if (parsed.technicalProfile !== undefined) updateData.technicalProfile = parsed.technicalProfile;
  if (parsed.movementRestrictions !== undefined)
    updateData.movementRestrictions = parsed.movementRestrictions;
  if (parsed.competitionPRs !== undefined) updateData.competitionPRs = parsed.competitionPRs;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { success: false, error: "No editable fields provided" },
      { status: 400 }
    );
  }

  const updated = await prisma.athleteProfile.update({
    where: { id: athleteId },
    data: updateData,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  const { athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const profile = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    include: {
      user: { select: { email: true, claimedAt: true, createdAt: true } },
    },
  });

  return NextResponse.json({ success: true, data: profile });
}
