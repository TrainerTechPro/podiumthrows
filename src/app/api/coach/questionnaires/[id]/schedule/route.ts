import { NextRequest, NextResponse } from "next/server";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { calculateNextRunDate } from "@/lib/forms/recurring-scheduler";
import type { RecurrenceFrequency } from "@/lib/forms/types";
import { parseBody, QuestionnaireScheduleSchema } from "@/lib/api-schemas";

/**
 * GET /api/coach/questionnaires/[id]/schedule
 * Get the recurring schedule for a questionnaire.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachSession();
    const { id } = await params;

    // Verify ownership
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { id: id, coachId: coach.id },
      select: { id: true },
    });

    if (!questionnaire) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const schedule = await prisma.recurringSchedule.findUnique({
      where: { questionnaireId: id },
    });

    return NextResponse.json({ success: true, data: { schedule: schedule ?? null } });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * PUT /api/coach/questionnaires/[id]/schedule
 * Create or update the recurring schedule for a questionnaire.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachSession();
    const { id } = await params;

    const questionnaire = await prisma.questionnaire.findFirst({
      where: { id: id, coachId: coach.id },
      select: { id: true },
    });

    if (!questionnaire) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const parsed = await parseBody(req, QuestionnaireScheduleSchema);
    if (parsed instanceof NextResponse) return parsed;
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
    } = parsed;

    // Calculate next run date
    const nextRunAt = calculateNextRunDate({
      frequency: frequency as RecurrenceFrequency,
      specificDays: specificDays ?? [],
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      lastRunAt: null,
    });

    const freq = frequency as RecurrenceFrequency;
    const schedule = await prisma.recurringSchedule.upsert({
      where: { questionnaireId: id },
      create: {
        questionnaireId: id,
        frequency: freq,
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
        frequency: freq,
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

    return NextResponse.json({ success: true, data: { schedule } });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * DELETE /api/coach/questionnaires/[id]/schedule
 * Remove the recurring schedule for a questionnaire.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachSession();
    const { id } = await params;

    const questionnaire = await prisma.questionnaire.findFirst({
      where: { id: id, coachId: coach.id },
      select: { id: true },
    });

    if (!questionnaire) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    await prisma.recurringSchedule.deleteMany({
      where: { questionnaireId: id },
    });

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}
