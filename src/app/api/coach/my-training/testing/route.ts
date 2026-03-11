import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const records = await prisma.coachTestingRecord.findMany({
      where: { coachId: coach.id },
      orderBy: { testDate: "desc" },
    });

    return NextResponse.json({ ok: true, data: records });
  } catch (err) {
    console.error("[GET /api/coach/my-training/testing]", err);
    return NextResponse.json({ error: "Failed to fetch testing records" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coach = await prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    const body = await request.json();
    const { testDate } = body;
    if (!testDate) {
      return NextResponse.json({ error: "testDate is required" }, { status: 400 });
    }

    const record = await prisma.coachTestingRecord.create({
      data: {
        coachId: coach.id,
        testDate,
        event: body.event || null,
        competitionMark: body.competitionMark ?? null,
        heavyImplMark: body.heavyImplMark ?? null,
        heavyImplKg: body.heavyImplKg ?? null,
        lightImplMark: body.lightImplMark ?? null,
        lightImplKg: body.lightImplKg ?? null,
        squatKg: body.squatKg ?? null,
        benchKg: body.benchKg ?? null,
        snatchKg: body.snatchKg ?? null,
        cleanKg: body.cleanKg ?? null,
        ohpKg: body.ohpKg ?? null,
        rdlKg: body.rdlKg ?? null,
        bodyWeightKg: body.bodyWeightKg ?? null,
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true, data: record }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/coach/my-training/testing]", err);
    return NextResponse.json({ error: "Failed to create testing record" }, { status: 500 });
  }
}
