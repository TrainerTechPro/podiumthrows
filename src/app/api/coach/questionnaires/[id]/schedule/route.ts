import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { calculateNextRunDate } from "@/lib/forms/recurring-scheduler";
import type { RecurrenceFrequency } from "@/lib/forms/types";

/**
 * GET /api/coach/questionnaires/[id]/schedule
 * Get the recurring schedule for a questionnaire.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { coach } = await requireCoachSession();

    // Verify ownership
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true },
    });

    if (!questionnaire) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const schedule = await prisma.recurringSchedule.findUnique({
      where: { questionnaireId: params.id },
    });

    return NextResponse.json({ schedule: schedule ?? null });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * PUT /api/coach/questionnaires/[id]/schedule
 * Create or update the recurring schedule for a questionnaire.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { coach } = await requireCoachSession();

    const questionnaire = await prisma.questionnaire.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true },
    });

    if (!questionnaire) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      frequency,
      specificDays,
      timeOfDay,
      athleteIds,
      groupIds,
      assignToAll,
      startDate,
      endDate,
      isActive,
    } = body;

    if (!frequency || !startDate) {
      return NextResponse.json({ error: "frequency and startDate are required" }, { status: 400 });
    }

    // Calculate next run date
    const nextRunAt = calculateNextRunDate({
      frequency: frequency as RecurrenceFrequency,
      specificDays: specificDays ?? [],
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      lastRunAt: null,
    });

    const schedule = await prisma.recurringSchedule.upsert({
      where: { questionnaireId: params.id },
      create: {
        questionnaireId: params.id,
        frequency,
        specificDays: specificDays ?? [],
        timeOfDay: timeOfDay ?? null,
        athleteIds: athleteIds ?? [],
        groupIds: groupIds ?? [],
        assignToAll: assignToAll ?? false,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive ?? true,
        nextRunAt,
      },
      update: {
        frequency,
        specificDays: specificDays ?? [],
        timeOfDay: timeOfDay ?? null,
        athleteIds: athleteIds ?? [],
        groupIds: groupIds ?? [],
        assignToAll: assignToAll ?? false,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive ?? true,
        nextRunAt,
      },
    });

    return NextResponse.json({ schedule });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * DELETE /api/coach/questionnaires/[id]/schedule
 * Remove the recurring schedule for a questionnaire.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { coach } = await requireCoachSession();

    const questionnaire = await prisma.questionnaire.findFirst({
      where: { id: params.id, coachId: coach.id },
      select: { id: true },
    });

    if (!questionnaire) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.recurringSchedule.deleteMany({
      where: { questionnaireId: params.id },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
