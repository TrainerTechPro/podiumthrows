import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { logger } from "@/lib/logger";
import { reorderTeamLinks } from "@/lib/data/team-hub";

/* ─── POST — reorder team links ──────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const { coach } = await requireCoachApi();
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    const { orderedIds } = body;

    if (
      !Array.isArray(orderedIds) ||
      orderedIds.length === 0 ||
      !orderedIds.every((id) => typeof id === "string")
    ) {
      return NextResponse.json(
        { success: false, error: "orderedIds must be a non-empty array of strings." },
        { status: 400 },
      );
    }

    await reorderTeamLinks(coach.id, orderedIds as string[]);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "Invalid link IDs") {
      return NextResponse.json({ success: false, error: "One or more link IDs are invalid." }, { status: 400 });
    }
    logger.error("POST /api/coach/team-links/reorder", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Failed to reorder team links." }, { status: 500 });
  }
}
