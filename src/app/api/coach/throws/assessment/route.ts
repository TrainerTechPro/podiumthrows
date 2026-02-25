import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

/* ─── Allowed athlete types ─────────────────────────────────────────────── */

const VALID_TYPES = ["EXPLOSIVE", "SPEED_STRENGTH", "STRENGTH_SPEED", "STRENGTH"] as const;
type ValidType = (typeof VALID_TYPES)[number];

/* ─── GET: Fetch assessments for an athlete ─────────────────────────────── */

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "COACH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!coach) {
    return NextResponse.json({ error: "Coach profile not found" }, { status: 404 });
  }

  const athleteId = req.nextUrl.searchParams.get("athleteId");
  if (!athleteId) {
    return NextResponse.json({ error: "athleteId is required" }, { status: 400 });
  }

  // Verify athlete belongs to this coach
  const athlete = await prisma.athleteProfile.findFirst({
    where: { id: athleteId, coachId: coach.id },
    select: { id: true },
  });
  if (!athlete) {
    return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
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
    assessments: assessments.map((a) => ({
      id: a.id,
      athleteType: a.athleteType,
      results: a.results,
      notes: a.notes,
      completedAt: a.completedAt.toISOString(),
    })),
  });
}

/* ─── POST: Save a new assessment ───────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "COACH") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!coach) {
    return NextResponse.json({ error: "Coach profile not found" }, { status: 404 });
  }

  const body = await req.json();
  const { athleteId, athleteType, results, notes } = body;

  // Validate required fields
  if (!athleteId || typeof athleteId !== "string") {
    return NextResponse.json({ error: "athleteId is required" }, { status: 400 });
  }
  if (!athleteType || !VALID_TYPES.includes(athleteType as ValidType)) {
    return NextResponse.json(
      { error: `athleteType must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (!results || typeof results !== "object") {
    return NextResponse.json(
      { error: "results object is required" },
      { status: 400 }
    );
  }

  // Verify athlete belongs to this coach
  const athlete = await prisma.athleteProfile.findFirst({
    where: { id: athleteId, coachId: coach.id },
    select: { id: true },
  });
  if (!athlete) {
    return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
  }

  // Create assessment
  const assessment = await prisma.bondarchukAssessment.create({
    data: {
      athleteId,
      athleteType: athleteType as ValidType,
      results,
      notes: notes || null,
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
      assessment: {
        id: assessment.id,
        athleteType: assessment.athleteType,
        results: assessment.results,
        notes: assessment.notes,
        completedAt: assessment.completedAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
