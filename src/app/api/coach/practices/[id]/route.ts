import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import {
  getPracticeDetail,
  updatePractice,
  deletePractice,
} from "@/lib/data/practices";

/* ─── GET — single practice detail ───────────────────────────────────────── */

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

    return NextResponse.json({ success: true, data: detail });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/coach/practices/[id]", { context: "api", error: err });
    return NextResponse.json(
      { error: "Failed to fetch practice." },
      { status: 500 }
    );
  }
}

/* ─── PATCH — update practice ─────────────────────────────────────────────── */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;
    const body = await req.json();

    const { applyToSeries, ...updates } = body;

    const result = await updatePractice(id, coach.id, updates, applyToSeries);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    logger.error("PATCH /api/coach/practices/[id]", { context: "api", error: err });
    return NextResponse.json(
      { error: "Failed to update practice." },
      { status: 500 }
    );
  }
}

/* ─── DELETE — cancel / delete practice ──────────────────────────────────── */

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const applyToSeries = searchParams.get("applyToSeries") === "true";

    const result = await deletePractice(id, coach.id, applyToSeries);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message.includes("not found")) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    logger.error("DELETE /api/coach/practices/[id]", { context: "api", error: err });
    return NextResponse.json(
      { error: "Failed to delete practice." },
      { status: 500 }
    );
  }
}
