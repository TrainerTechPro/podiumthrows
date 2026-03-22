import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/whoop/authorize
 * Initiates the WHOOP OAuth2 flow by redirecting the user to WHOOP's auth page.
 */
export async function GET(_request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find athlete profile (works for ATHLETE role or COACH in training mode)
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true, whoopConnection: { select: { id: true } } },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete profile not found" }, { status: 404 });
    }

    if (athlete.whoopConnection) {
      return NextResponse.json({ error: "WHOOP is already connected" }, { status: 409 });
    }

    const clientId = process.env.WHOOP_CLIENT_ID;
    if (!clientId) {
      logger.error("WHOOP_CLIENT_ID not configured", { context: "api" });
      return NextResponse.json({ error: "WHOOP integration not configured" }, { status: 500 });
    }

    const state = crypto.randomUUID();
    // Must exactly match the redirect URL registered in the WHOOP developer portal
    const redirectUri = process.env.WHOOP_REDIRECT_URI || "https://podiumthrows.vercel.app/api/whoop/callback";

    const authUrl = new URL("https://api.prod.whoop.com/oauth/oauth2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set(
      "scope",
      "read:recovery read:sleep read:cycles read:workout read:profile read:body_measurement"
    );
    authUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authUrl.toString());

    response.cookies.set("whoop-oauth-state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (err) {
    logger.error("GET /api/whoop/authorize", { context: "api", error: err });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
