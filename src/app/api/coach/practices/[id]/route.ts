import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { getPracticeDetail, updatePractice, deletePractice } from "@/lib/data/practices";
import { parseBody, CoachPracticeUpdateSchema } from "@/lib/api-schemas";

/* ─── GET — single practice detail ───────────────────────────────────────── */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    const detail = await getPracticeDetail(id, coach.id);
    if (!detail) {
      return NextResponse.json({ success: false, error: "Practice not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: detail });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/coach/practices/[id]", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t fetch practice." },
      { status: 500 }
    );
  }
}

/* ─── PATCH — update practice ─────────────────────────────────────────────── */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    const parsed = await parseBody(req, CoachPracticeUpdateSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { applyToSeries, ...rest } = parsed;

    // updatePractice() takes `string` (not null) for title/date/startTime/endTime
    // and `string | null` for nullable optional columns. The Zod schema yields
    // `string | null | undefined` for everything to stay tolerant of the form
    // sending null for cleared fields — coerce here so the data layer receives
    // its narrower shape.
    const updates: Parameters<typeof updatePractice>[2] = {
      ...(rest.title != null ? { title: rest.title } : {}),
      ...(rest.date != null ? { date: rest.date } : {}),
      ...(rest.startTime != null ? { startTime: rest.startTime } : {}),
      ...(rest.endTime != null ? { endTime: rest.endTime } : {}),
      ...(rest.status != null ? { status: rest.status } : {}),
      ...(rest.location !== undefined ? { location: rest.location ?? null } : {}),
      ...(rest.notes !== undefined ? { notes: rest.notes ?? null } : {}),
      ...(rest.groupId !== undefined ? { groupId: rest.groupId ?? null } : {}),
    };

    const result = await updatePractice(id, coach.id, updates, applyToSeries === true);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    logger.error("PATCH /api/coach/practices/[id]", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t update practice." },
      { status: 500 }
    );
  }
}

/* ─── DELETE — cancel / delete practice ──────────────────────────────────── */

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const applyToSeries = searchParams.get("applyToSeries") === "true";

    const result = await deletePractice(id, coach.id, applyToSeries);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    logger.error("DELETE /api/coach/practices/[id]", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Couldn’t delete practice." },
      { status: 500 }
    );
  }
}
