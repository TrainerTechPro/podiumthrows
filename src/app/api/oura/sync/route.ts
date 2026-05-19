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
      return NextResponse.json(
        { success: false, error: "Athlete profile not found" },
        { status: 404 }
      );
    }

    const connection = await prisma.ouraConnection.findUnique({
      where: { athleteId: athlete.id },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json(
        { success: false, error: "No Oura Ring connection found" },
        { status: 404 }
      );
    }

    // INTENTIONAL EXEMPTION from parseBody: this endpoint accepts a fully
    // optional body. With no body it triggers a normal sync; with
    // `{ updateSyncMode: "AUTO" | "ASSISTED" }` it switches the sync mode
    // without firing a data sync. Auto-sync clients (`_oura-auto-sync.tsx`,
    // `_whoop-auto-sync.tsx`) POST with no JSON body and no Content-Type, so
    // `parseBody` would 400 them. The try/catch tolerates that case.
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch (err) {
      logger.debug("Wearable sync: empty body — treating as a normal sync request", {
        context: "src/app/api/oura/sync/route.ts",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }

    if (body.updateSyncMode != null) {
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

    // Successful sync — clear any prior error stamp so the dashboard banner
    // and integrations card stop nagging.
    await prisma.ouraConnection.update({
      where: { id: connection.id },
      data: { lastSyncError: null, lastSyncErrorAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("POST /api/oura/sync", { context: "api", error: err, metadata: { message } });

    // Persist the failure so the dashboard banner + integrations page can
    // surface it without round-tripping.
    try {
      const session = await getSession();
      if (session) {
        const athlete = await prisma.athleteProfile.findUnique({
          where: { userId: session.userId },
          select: { id: true },
        });
        if (athlete) {
          await prisma.ouraConnection.update({
            where: { athleteId: athlete.id },
            data: { lastSyncError: message.slice(0, 500), lastSyncErrorAt: new Date() },
          });
        }
      }
    } catch (writeErr) {
      // ok: best-effort error stamp; the original sync error still surfaces below.
      logger.debug("Couldn’t record oura lastSyncError", {
        context: "api/oura/sync",
        metadata: { reason: writeErr instanceof Error ? writeErr.message : "unknown" },
      });
    }

    if (isReauthError(message)) {
      return NextResponse.json(
        {
          success: false,
          error: "reauth_required",
          detail: "Your Oura Ring authorization has expired. Please reconnect your Oura Ring.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Oura sync failed", detail: message },
      { status: 500 }
    );
  }
}
