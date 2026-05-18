import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { updateTeamLink, deleteTeamLink } from "@/lib/data/team-hub";

/* ─── PATCH — update a team link ─────────────────────────────────────────── */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const { title, url, category, icon } = body;

    // Validate URL format if provided
    if (typeof url === "string" && url.trim()) {
      try {
        new URL(url.trim());
      } catch {
        return NextResponse.json({ success: false, error: "Invalid URL format." }, { status: 400 });
      }
    }

    const updates: Parameters<typeof updateTeamLink>[2] = {};
    if (typeof title === "string" && title.trim()) updates.title = title.trim();
    if (typeof url === "string" && url.trim()) updates.url = url.trim();
    if (category !== undefined)
      updates.category = typeof category === "string" ? category.trim() || null : null;
    if (icon !== undefined) updates.icon = typeof icon === "string" ? icon.trim() || null : null;

    await updateTeamLink(id, coach.id, updates);
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "Not found") {
      return NextResponse.json({ success: false, error: "Team link not found." }, { status: 404 });
    }
    logger.error("PATCH /api/coach/team-links/[id]", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to update team link." },
      { status: 500 }
    );
  }
}

/* ─── DELETE — delete a team link ────────────────────────────────────────── */

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    await deleteTeamLink(id, coach.id);
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "Not found") {
      return NextResponse.json({ success: false, error: "Team link not found." }, { status: 404 });
    }
    logger.error("DELETE /api/coach/team-links/[id]", { context: "api", error: err });
    return NextResponse.json(
      { success: false, error: "Failed to delete team link." },
      { status: 500 }
    );
  }
}
