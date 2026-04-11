import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoachAthlete } from "@/lib/data/coach";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ athleteId: string; throwId: string }> }
) {
  const { athleteId, throwId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  // Only allow delete on unclaimed profiles, or throws without a session (coach-created)
  const throwLog = await prisma.throwLog.findFirst({
    where: { id: throwId, athleteId },
  });

  if (!throwLog) {
    return NextResponse.json(
      { success: false, error: "Throw not found" },
      { status: 404 }
    );
  }

  const isClaimed = ctx.athlete.user.claimedAt != null;
  if (isClaimed && throwLog.sessionId != null) {
    return NextResponse.json(
      { success: false, error: "Cannot delete athlete-logged throws on claimed profiles" },
      { status: 403 }
    );
  }

  await prisma.throwLog.delete({ where: { id: throwId } });

  return NextResponse.json({ success: true, data: { deleted: throwId } });
}
