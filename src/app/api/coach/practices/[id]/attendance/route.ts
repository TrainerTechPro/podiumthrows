import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import {
  getPracticeDetail,
  batchUpdateAttendance,
  markAllPresent,
  AttendanceStatus,
} from "@/lib/data/practices";

/* ─── GET — attendance + eligible athletes for a practice ────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    const detail = await getPracticeDetail(id, coach.id);
    if (!detail) {
      return NextResponse.json({ error: "Practice not found." }, { status: 404 });
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/coach/practices/[id]/attendance", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to fetch attendance." },
      { status: 500 }
    );
  }
}

/* ─── PATCH — batch update attendance statuses ───────────────────────────── */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;
    const body = await req.json();

    const { updates } = body as {
      updates: Array<{
        athleteId: string;
        status: AttendanceStatus | null;
        notes?: string;
      }>;
    };

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "updates must be a non-empty array." },
        { status: 400 }
      );
    }

    const result = await batchUpdateAttendance(id, coach.id, updates);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    logger.error("PATCH /api/coach/practices/[id]/attendance", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to update attendance." },
      { status: 500 }
    );
  }
}

/* ─── POST ?action=mark-all-present ──────────────────────────────────────── */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action !== "mark-all-present") {
      return NextResponse.json(
        { error: "Unknown action. Use ?action=mark-all-present" },
        { status: 400 }
      );
    }

    const result = await markAllPresent(id, coach.id);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    logger.error("POST /api/coach/practices/[id]/attendance", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to mark all present." },
      { status: 500 }
    );
  }
}
