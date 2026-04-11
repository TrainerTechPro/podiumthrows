import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAthletePRs } from "@/lib/data/personal-records";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> }
) {
  const { athleteId } = await params;

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  // Athlete can read their own PRs
  if (session.role === "ATHLETE") {
    const ownProfile = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!ownProfile || ownProfile.id !== athleteId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }
  } else if (session.role === "COACH") {
    // Coach can read PRs for any athlete they own
    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach profile not found" },
        { status: 403 }
      );
    }
    const athlete = await prisma.athleteProfile.findFirst({
      where: { id: athleteId, coachId: coach.id },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json(
        { success: false, error: "Athlete not found" },
        { status: 404 }
      );
    }
  } else {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const prs = await getAthletePRs(athleteId);
  return NextResponse.json({ success: true, data: prs });
}
