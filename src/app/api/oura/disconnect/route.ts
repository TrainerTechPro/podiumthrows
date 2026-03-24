import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { decrypt } from "@/lib/oura/crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * POST /api/oura/disconnect
 * Disconnects the user's Oura Ring integration by revoking the token
 * and deleting the OuraConnection record.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete profile not found" }, { status: 404 });
    }

    const connection = await prisma.ouraConnection.findUnique({
      where: { athleteId: athlete.id },
    });

    if (!connection) {
      return NextResponse.json({ error: "No Oura Ring connection found" }, { status: 404 });
    }

    // Try to revoke the access token at Oura (best-effort)
    try {
      const accessToken = decrypt(connection.accessToken);
      await fetch("https://api.ouraring.com/oauth/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: accessToken }),
      });
    } catch (revokeErr) {
      logger.warn("Oura token revocation failed (non-blocking)", {
        context: "api",
        metadata: { error: String(revokeErr) },
      });
    }

    // Delete the connection (cascades to OuraDailySnapshot)
    await prisma.ouraConnection.delete({
      where: { id: connection.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("POST /api/oura/disconnect", { context: "api", error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
