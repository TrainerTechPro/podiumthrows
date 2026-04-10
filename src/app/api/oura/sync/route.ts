import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { syncOuraData } from "@/lib/oura/sync";
import { isReauthError } from "@/lib/wearable-auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * POST /api/oura/sync
 * Manually triggers a sync of the authenticated athlete's Oura Ring data.
 * Also accepts { updateSyncMode: "AUTO" | "ASSISTED" } to change the sync mode.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!athlete) {
      return NextResponse.json({ success: false, error: "Athlete profile not found" }, { status: 404 });
    }

    const connection = await prisma.ouraConnection.findUnique({
      where: { athleteId: athlete.id },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json({ success: false, error: "No Oura Ring connection found" }, { status: 404 });
    }

    // Check if this is a sync-mode update
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
      await prisma.ouraConnection.update({
        where: { id: connection.id },
        data: { syncMode: mode },
      });
      return NextResponse.json({ success: true, data: { syncMode: mode } });
    }

    await syncOuraData(connection.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("POST /api/oura/sync", { context: "api", error: err, metadata: { message } });

    if (isReauthError(message)) {
      return NextResponse.json(
        { success: false, error: "reauth_required", detail: "Your Oura Ring authorization has expired. Please reconnect your Oura Ring." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Oura sync failed", detail: message },
      { status: 500 },
    );
  }
}
