import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { getPracticeDetail, batchUpdateAttendance, markAllPresent } from "@/lib/data/practices";
import { parseBody, CoachAttendanceBatchSchema } from "@/lib/api-schemas";

/* ─── GET — attendance + eligible athletes for a practice ────────────────── */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    const detail = await getPracticeDetail(id, coach.id);
    if (!detail) {
      return NextResponse.json({ success: false, error: "Practice not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        practice: {
          id: detail.practice.id,
          title: detail.practice.title,
          date: detail.practice.date,
          startTime: detail.practice.startTime,
          endTime: detail.practice.endTime,
          location: detail.practice.location,
          status: detail.practice.status,
          totalEligibleAthletes: detail.practice.totalEligibleAthletes,
          attendingCount: detail.practice.attendingCount,
        },
        attendance: detail.practice.attendance,
        conflicts: detail.conflicts,
        eligibleAthletes: detail.eligibleAthletes,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/coach/practices/[id]/attendance", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to fetch attendance." },
      { status: 500 }
    );
  }
}

/* ─── PATCH — batch update attendance statuses ───────────────────────────── */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    const parsed = await parseBody(req, CoachAttendanceBatchSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { updates } = parsed;

    const result = await batchUpdateAttendance(
      id,
      coach.id,
      updates.map((u) => ({
        athleteId: u.athleteId,
        status: u.status,
        notes: u.notes ?? undefined,
      }))
    );
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    logger.error("PATCH /api/coach/practices/[id]/attendance", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to update attendance." },
      { status: 500 }
    );
  }
}

/* ─── POST ?action=mark-all-present ──────────────────────────────────────── */

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action !== "mark-all-present") {
      return NextResponse.json(
        { success: false, error: "Unknown action. Use ?action=mark-all-present" },
        { status: 400 }
      );
    }

    const result = await markAllPresent(id, coach.id);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    logger.error("POST /api/coach/practices/[id]/attendance", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Failed to mark all present." },
      { status: 500 }
    );
  }
}
