import { NextRequest, NextResponse } from "next/server";
import { verifyTokenEdge } from "@/lib/auth-edge";
import { fetchProfile } from "@/lib/whoop/client";
import { encrypt } from "@/lib/whoop/crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

/**
 * GET /api/whoop/callback
 * OAuth2 callback — WHOOP redirects here after the user authorizes.
 * This is a public route (no session middleware) but uses the state param for CSRF
 * and reads the auth-token cookie to identify the user.
 */
export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/athlete/settings", request.url);

  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // WHOOP may redirect with an error (e.g. user denied)
    if (error) {
      settingsUrl.searchParams.set("whoop", "error");
      settingsUrl.searchParams.set("reason", error);
      return NextResponse.redirect(settingsUrl);
    }

    if (!code || !state) {
      settingsUrl.searchParams.set("whoop", "error");
      settingsUrl.searchParams.set("reason", "missing_params");
      return NextResponse.redirect(settingsUrl);
    }

    // Validate state against cookie
    const storedState = request.cookies.get("whoop-oauth-state")?.value;
    if (!storedState || storedState !== state) {
      settingsUrl.searchParams.set("whoop", "error");
      settingsUrl.searchParams.set("reason", "state_mismatch");
      return NextResponse.redirect(settingsUrl);
    }

    // Identify the user from their auth-token cookie
    const authToken = request.cookies.get("auth-token")?.value;
    const payload = authToken ? verifyTokenEdge(authToken) : null;
    if (!payload) {
      settingsUrl.searchParams.set("whoop", "error");
      settingsUrl.searchParams.set("reason", "not_authenticated");
      return NextResponse.redirect(settingsUrl);
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: payload.userId },
      select: { id: true },
    });

    if (!athlete) {
      settingsUrl.searchParams.set("whoop", "error");
      settingsUrl.searchParams.set("reason", "no_athlete_profile");
      return NextResponse.redirect(settingsUrl);
    }

    // Exchange authorization code for tokens
    // Must exactly match the redirect URL registered in the WHOOP developer portal
    const redirectUri = process.env.WHOOP_REDIRECT_URI || "https://podiumthrows.com/api/whoop/callback";

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.WHOOP_CLIENT_ID!,
        client_secret: process.env.WHOOP_CLIENT_SECRET!,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      logger.error("WHOOP token exchange failed", {
        context: "api",
        metadata: { status: tokenRes.status, body: text },
      });
      settingsUrl.searchParams.set("whoop", "error");
      settingsUrl.searchParams.set("reason", "token_exchange_failed");
      return NextResponse.redirect(settingsUrl);
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in, scope } = tokenData as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
    };

    // Fetch WHOOP profile to get their user ID
    const profile = await fetchProfile(access_token);

    // Encrypt tokens before storage
    const encryptedAccess = encrypt(access_token);
    const encryptedRefresh = encrypt(refresh_token);
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Upsert the connection (handles reconnection after disconnect)
    await prisma.whoopConnection.upsert({
      where: { athleteId: athlete.id },
      create: {
        athleteId: athlete.id,
        whoopUserId: profile.userId,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt,
        scopes: scope,
      },
      update: {
        whoopUserId: profile.userId,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt,
        scopes: scope,
        lastSyncAt: null,
      },
    });

    // Clear the state cookie and redirect to settings
    const response = NextResponse.redirect(
      new URL("/athlete/settings?whoop=connected", request.url)
    );

    response.cookies.set("whoop-oauth-state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal_error";
    logger.error("GET /api/whoop/callback", { context: "api", error: err });
    settingsUrl.searchParams.set("whoop", "error");
    settingsUrl.searchParams.set("reason", message);
    return NextResponse.redirect(settingsUrl);
  }
}
