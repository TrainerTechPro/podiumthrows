import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { getCoachPractices, createPractice, createRecurringPractices } from "@/lib/data/practices";
import { parseBody, CoachPracticeCreateSchema } from "@/lib/api-schemas";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/** Returns the ISO date strings for the Monday and Sunday of the current week. */
function currentWeekRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun…6=Sat
  // Distance to Monday (week starts Monday)
  const daysToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    startDate: monday.toISOString().slice(0, 10),
    endDate: sunday.toISOString().slice(0, 10),
  };
}

/* ─── GET — list practices in date range ─────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();

    const { searchParams } = new URL(req.url);
    let startDate = searchParams.get("startDate");
    let endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      const range = currentWeekRange();
      startDate = range.startDate;
      endDate = range.endDate;
    }

    const practices = await getCoachPractices(coach.id, startDate, endDate);
    return NextResponse.json({ success: true, data: practices });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/coach/practices", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to fetch practices." },
      { status: 500 }
    );
  }
}

/* ─── POST — create practice (single or recurring) ───────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();

    const parsed = await parseBody(req, CoachPracticeCreateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { title, date, startTime, endTime, location, notes, groupId, recurring } = parsed;

    if (recurring?.untilDate) {
      const result = await createRecurringPractices(coach.id, {
        title,
        startDate: date as string,
        untilDate: recurring.untilDate,
        startTime,
        endTime,
        location: location ?? undefined,
        notes: notes ?? undefined,
        groupId: groupId ?? undefined,
      });
      return NextResponse.json({ success: true, data: result }, { status: 201 });
    }

    const result = await createPractice(coach.id, {
      title,
      date: date as string,
      startTime,
      endTime,
      location: location ?? undefined,
      notes: notes ?? undefined,
      groupId: groupId ?? undefined,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/coach/practices", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to create practice." },
      { status: 500 }
    );
  }
}
