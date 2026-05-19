import { NextRequest, NextResponse } from "next/server";
import { requireCoachApi, AuthError } from "@/lib/data/coach";
import { deleteTeamFile } from "@/lib/data/team-hub";
import { isR2Configured, deleteFile } from "@/lib/r2";
import { logger } from "@/lib/logger";

/* ─── DELETE — remove a team file (DB + R2) ──────────────────────────────── */

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { coach } = await requireCoachApi();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ success: false, error: "File ID required" }, { status: 400 });
    }

    // deleteTeamFile verifies ownership and returns the R2 key
    const { fileKey } = await deleteTeamFile(id, coach.id);

    // Best-effort R2 deletion — don't fail the request if storage cleanup fails
    if (isR2Configured() && fileKey) {
      try {
        await deleteFile(fileKey);
      } catch (r2Err) {
        logger.error("DELETE /api/coach/team-files/[id] — R2 cleanup failed", {
          context: "api",
          metadata: { fileKey },
          error: r2Err,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "Not found") {
      return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
    }
    logger.error("DELETE /api/coach/team-files/[id]", {
      context: "api",
      error: err,
    });
    return NextResponse.json(
      { success: false, error: "Couldn’t delete file" },
      { status: 500 },
    );
  }
}
