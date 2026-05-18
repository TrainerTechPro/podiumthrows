import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseBody, CoachAssessmentCreateSchema } from "@/lib/api-schemas";

/* ─── GET: Fetch assessments for an athlete ─────────────────────────────── */

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "COACH") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!coach) {
    return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
  }

  const athleteId = req.nextUrl.searchParams.get("athleteId");
  if (!athleteId) {
    return NextResponse.json({ success: false, error: "athleteId is required" }, { status: 400 });
  }

  // Verify athlete belongs to this coach
  const athlete = await prisma.athleteProfile.findFirst({
    where: { id: athleteId, coachId: coach.id },
    select: { id: true },
  });
  if (!athlete) {
    return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
  }

  const assessments = await prisma.bondarchukAssessment.findMany({
    where: { athleteId },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      athleteType: true,
      results: true,
      notes: true,
      completedAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      assessments: assessments.map((a) => ({
        id: a.id,
        athleteType: a.athleteType,
        results: a.results,
        notes: a.notes,
        completedAt: a.completedAt.toISOString(),
      })),
    },
  });
}

/* ─── POST: Save a new assessment ───────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "COACH") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!coach) {
    return NextResponse.json({ success: false, error: "Coach profile not found" }, { status: 404 });
  }

  const parsed = await parseBody(req, CoachAssessmentCreateSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { athleteId, athleteType, results, notes } = parsed;

  // Verify athlete belongs to this coach
  const athlete = await prisma.athleteProfile.findFirst({
    where: { id: athleteId, coachId: coach.id },
    select: { id: true },
  });
  if (!athlete) {
    return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
  }

  // Create assessment
  const assessment = await prisma.bondarchukAssessment.create({
    data: {
      athleteId,
      athleteType,
      // Cast: schema validates shape; Prisma's InputJsonValue type doesn't accept
      // Record<string, unknown> directly even though all values serialise fine.
      results: results as Parameters<
        typeof prisma.bondarchukAssessment.create
      >[0]["data"]["results"],
      notes: notes ?? null,
    },
    select: {
      id: true,
      athleteType: true,
      results: true,
      notes: true,
      completedAt: true,
    },
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        assessment: {
          id: assessment.id,
          athleteType: assessment.athleteType,
          results: assessment.results,
          notes: assessment.notes,
          completedAt: assessment.completedAt.toISOString(),
        },
      },
    },
    { status: 201 }
  );
}
