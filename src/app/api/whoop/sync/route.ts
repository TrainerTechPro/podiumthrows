import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { syncWhoopData } from "@/lib/whoop/sync";
import { isReauthError } from "@/lib/wearable-auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * POST /api/whoop/sync
 * Manually triggers a sync of the authenticated athlete's WHOOP data.
 * Also accepts { updateSyncMode: "AUTO" | "ASSISTED" } to change the sync mode
 * without triggering a full data sync.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Find athlete profile — works for ATHLETE role or COACH with Training Mode
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete profile not found" }, { status: 404 });
    }

    const connection = await prisma.whoopConnection.findUnique({
      where: { athleteId: athlete.id },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json({ success: false, error: "No WHOOP connection found" }, { status: 404 });
    }

    // Check if this is a sync-mode update (no data sync needed)
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine — means a normal sync request
    }

    if (body.updateSyncMode) {
      const mode = body.updateSyncMode;
      if (mode !== "AUTO" && mode !== "ASSISTED") {
        return NextResponse.json({ success: false, error: "Invalid sync mode" }, { status: 400 });
      }
      await prisma.whoopConnection.update({
        where: { id: connection.id },
        data: { syncMode: mode },
      });
      return NextResponse.json({ success: true, data: { syncMode: mode } });
    }

    await syncWhoopData(connection.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("POST /api/whoop/sync", { context: "api", error: err, metadata: { message } });

    if (isReauthError(message)) {
      return NextResponse.json(
        { success: false, error: "reauth_required", detail: "Your WHOOP authorization has expired. Please reconnect your WHOOP." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { success: false, error: "WHOOP sync failed", detail: message },
      { status: 500 },
    );
  }
}
