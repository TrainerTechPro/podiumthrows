import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import {
  getCoachPractices,
  createPractice,
  createRecurringPractices,
} from "@/lib/data/practices";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/coach/practices", { context: "api", error: err });
    return NextResponse.json(
      { error: "Failed to fetch practices." },
      { status: 500 }
    );
  }
}

/* ─── POST — create practice (single or recurring) ───────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const body = await req.json();

    const {
      title,
      date,
      startTime,
      endTime,
      location,
      notes,
      groupId,
      recurring,
    } = body;

    if (!title || !startTime || !endTime) {
      return NextResponse.json(
        { error: "title, startTime, and endTime are required." },
        { status: 400 }
      );
    }

    if (recurring?.untilDate) {
      // Recurring series
      if (!date) {
        return NextResponse.json(
          { error: "date (startDate) is required for recurring practices." },
          { status: 400 }
        );
      }
      const result = await createRecurringPractices(coach.id, {
        title,
        startDate: date,
        untilDate: recurring.untilDate,
        startTime,
        endTime,
        location,
        notes,
        groupId,
      });
      return NextResponse.json({ success: true, data: result }, { status: 201 });
    }

    // Single practice
    if (!date) {
      return NextResponse.json(
        { error: "date is required." },
        { status: 400 }
      );
    }

    const result = await createPractice(coach.id, {
      title,
      date,
      startTime,
      endTime,
      location,
      notes,
      groupId,
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/coach/practices", { context: "api", error: err });
    return NextResponse.json(
      { error: "Failed to create practice." },
      { status: 500 }
    );
  }
}
