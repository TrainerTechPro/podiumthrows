import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/oura/authorize
 * Initiates the Oura Ring OAuth2 flow by redirecting the user to Oura's auth page.
 */
export async function GET(_request: Request) {
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

    // Allow re-authorization even if already connected — the callback does upsert.
    // This lets users fix expired/missing refresh tokens without disconnecting first.

    const clientId = process.env.OURA_CLIENT_ID;
    if (!clientId) {
      logger.error("OURA_CLIENT_ID not configured", { context: "api" });
      return NextResponse.json({ success: false, error: "Oura Ring integration not configured" }, { status: 500 });
    }

    const state = crypto.randomUUID();
    const redirectUri = process.env.OURA_REDIRECT_URI || "https://podiumthrows.com/api/oura/callback";

    const authUrl = new URL("https://cloud.ouraring.com/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "email personal daily heartrate spo2");
    authUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authUrl.toString());

    response.cookies.set("oura-oauth-state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (err) {
    logger.error("GET /api/oura/authorize", { context: "api", error: err });
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
