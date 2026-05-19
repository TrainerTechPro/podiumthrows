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
      return NextResponse.json(
        { success: false, error: "Athlete profile not found" },
        { status: 404 }
      );
    }

    const connection = await prisma.whoopConnection.findUnique({
      where: { athleteId: athlete.id },
      select: { id: true },
    });

    if (!connection) {
      return NextResponse.json(
        { success: false, error: "No WHOOP connection found" },
        { status: 404 }
      );
    }

    // INTENTIONAL EXEMPTION from parseBody: this endpoint accepts a fully
    // optional body. With no body it triggers a normal sync; with
    // `{ updateSyncMode: "AUTO" | "ASSISTED" }` it switches the sync mode
    // without firing a data sync. The auto-sync client (`_whoop-auto-sync.tsx`)
    // POSTs with no JSON body and no Content-Type, so `parseBody` would 400
    // it. The try/catch tolerates that case.
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch (err) {
      logger.debug("WHOOP sync: empty body — treating as a normal sync request", {
        context: "src/app/api/whoop/sync/route.ts",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }

    if (body.updateSyncMode != null) {
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

    // Successful sync — clear any prior error stamp so the dashboard banner
    // and integrations card stop nagging.
    await prisma.whoopConnection.update({
      where: { id: connection.id },
      data: { lastSyncError: null, lastSyncErrorAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isExpectedReauth = isReauthError(message);

    // Expected reauth errors aren't actionable engineering issues — the user
    // needs to reconnect WHOOP. Log at info instead of error so it doesn't
    // get captured as a Sentry exception. Fixes PODIUM-THROWS-17.
    if (isExpectedReauth) {
      logger.info("POST /api/whoop/sync: reauth required", {
        context: "api",
        metadata: { message },
      });
    } else {
      logger.error("POST /api/whoop/sync", {
        context: "api",
        error: err,
        metadata: { message },
      });
    }

    // Persist the failure so the dashboard banner + integrations page can
    // surface it without round-tripping. We look up by athleteId again
    // (rather than relying on the in-scope `connection`) because the throw
    // could have come from before we set that variable.
    try {
      const session = await getSession();
      if (session) {
        const athlete = await prisma.athleteProfile.findUnique({
          where: { userId: session.userId },
          select: { id: true },
        });
        if (athlete) {
          await prisma.whoopConnection.update({
            where: { athleteId: athlete.id },
            data: { lastSyncError: message.slice(0, 500), lastSyncErrorAt: new Date() },
          });
        }
      }
    } catch (writeErr) {
      // ok: best-effort error stamp. If we can't update the row, we still
      // want to return the original sync error to the client below.
      logger.debug("Couldn’t record whoop lastSyncError", {
        context: "api/whoop/sync",
        metadata: { reason: writeErr instanceof Error ? writeErr.message : "unknown" },
      });
    }

    if (isExpectedReauth) {
      return NextResponse.json(
        {
          success: false,
          error: "reauth_required",
          detail: "Your WHOOP authorization has expired. Please reconnect your WHOOP.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "WHOOP sync failed", detail: message },
      { status: 500 }
    );
  }
}
