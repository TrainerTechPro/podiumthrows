import { NextResponse } from "next/server";
import { getSession, canActAsAthlete } from "@/lib/auth";
import { decrypt } from "@/lib/whoop/crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const WHOOP_REVOKE_URL = "https://api.prod.whoop.com/developer/v2/user/access";

/**
 * POST /api/whoop/disconnect
 * Disconnects the user's WHOOP integration by revoking the token
 * and deleting the WhoopConnection record.
 */
export async function POST() {
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
    });

    if (!connection) {
      return NextResponse.json({ error: "No WHOOP connection found" }, { status: 404 });
    }

    // Try to revoke the access token at WHOOP (best-effort)
    try {
      const accessToken = decrypt(connection.accessToken);
      await fetch(WHOOP_REVOKE_URL, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (revokeErr) {
      // Log but don't block — the connection will be deleted regardless
      logger.warn("WHOOP token revocation failed (non-blocking)", {
        context: "api",
        metadata: { error: String(revokeErr) },
      });
    }

    // Delete the connection (cascades to WhoopDailySnapshot)
    await prisma.whoopConnection.delete({
      where: { id: connection.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("POST /api/whoop/disconnect", { context: "api", error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
