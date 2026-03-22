import { NextResponse } from "next/server";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { syncWhoopData } from "@/lib/whoop/sync";
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAthlete = await canActAsAthlete(session);
    if (!isAthlete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete profile not found" }, { status: 404 });
    }

    const connection = await prisma.whoopConnection.findUnique({
      where: { athleteId: athlete.id },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json({ error: "No WHOOP connection found" }, { status: 404 });
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
        return NextResponse.json({ error: "Invalid sync mode" }, { status: 400 });
      }
      await prisma.whoopConnection.update({
        where: { id: connection.id },
        data: { syncMode: mode },
      });
      return NextResponse.json({ ok: true, syncMode: mode });
    }

    await syncWhoopData(connection.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("POST /api/whoop/sync", { context: "api", error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
