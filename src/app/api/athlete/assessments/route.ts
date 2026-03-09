import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

/* ─── GET — testing records & Bondarchuk assessments for athlete ────────────── */

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ATHLETE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const [testingRecords, assessments] = await Promise.all([
      prisma.throwsTestingRecord.findMany({
        where: { athleteId: athlete.id },
        orderBy: { testDate: "desc" },
        select: {
          id: true,
          testDate: true,
          testType: true,
          competitionMark: true,
          heavyImplMark: true,
          heavyImplKg: true,
          lightImplMark: true,
          lightImplKg: true,
          squatKg: true,
          benchKg: true,
          snatchKg: true,
          cleanKg: true,
          bodyWeightKg: true,
          distanceBandAtTest: true,
          notes: true,
        },
      }),
      prisma.bondarchukAssessment.findMany({
        where: { athleteId: athlete.id },
        orderBy: { completedAt: "desc" },
        select: {
          id: true,
          athleteType: true,
          completedAt: true,
          notes: true,
        },
      }),
    ]);

    return NextResponse.json({
      testingRecords: testingRecords.map((r) => ({
        id: r.id,
        testDate: r.testDate,
        testType: r.testType,
        competitionMark: r.competitionMark,
        heavyImplMark: r.heavyImplMark,
        heavyImplKg: r.heavyImplKg,
        lightImplMark: r.lightImplMark,
        lightImplKg: r.lightImplKg,
        squatKg: r.squatKg,
        benchKg: r.benchKg,
        snatchKg: r.snatchKg,
        cleanKg: r.cleanKg,
        bodyWeightKg: r.bodyWeightKg,
        distanceBandAtTest: r.distanceBandAtTest,
        notes: r.notes,
      })),
      assessments: assessments.map((a) => ({
        id: a.id,
        athleteType: a.athleteType,
        completedAt: a.completedAt.toISOString(),
        notes: a.notes,
      })),
    });
  } catch (err) {
    console.error("[GET /api/athlete/assessments]", err);
    return NextResponse.json(
      { error: "Failed to fetch assessments." },
      { status: 500 }
    );
  }
}
