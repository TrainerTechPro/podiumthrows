import { NextRequest, NextResponse } from "next/server";
import { verifyTokenEdge } from "@/lib/auth-edge";
import { fetchProfile } from "@/lib/oura/client";
import { encrypt } from "@/lib/oura/crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const TOKEN_URL = "https://api.ouraring.com/oauth/token";

/**
 * GET /api/oura/callback
 * OAuth2 callback — Oura redirects here after the user authorizes.
 */
export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/athlete/settings", request.url);

  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      settingsUrl.searchParams.set("oura", "error");
      settingsUrl.searchParams.set("reason", error);
      return NextResponse.redirect(settingsUrl);
    }

    if (!code || !state) {
      settingsUrl.searchParams.set("oura", "error");
      settingsUrl.searchParams.set("reason", "missing_params");
      return NextResponse.redirect(settingsUrl);
    }

    // Validate state against cookie
    const storedState = request.cookies.get("oura-oauth-state")?.value;
    if (!storedState || storedState !== state) {
      settingsUrl.searchParams.set("oura", "error");
      settingsUrl.searchParams.set("reason", "state_mismatch");
      return NextResponse.redirect(settingsUrl);
    }

    // Identify the user from their auth-token cookie
    const authToken = request.cookies.get("auth-token")?.value;
    const payload = authToken ? verifyTokenEdge(authToken) : null;
    if (!payload) {
      settingsUrl.searchParams.set("oura", "error");
      settingsUrl.searchParams.set("reason", "not_authenticated");
      return NextResponse.redirect(settingsUrl);
    }

    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId: payload.userId },
      select: { id: true },
    });

    if (!athlete) {
      settingsUrl.searchParams.set("oura", "error");
      settingsUrl.searchParams.set("reason", "no_athlete_profile");
      return NextResponse.redirect(settingsUrl);
    }

    // Exchange authorization code for tokens
    const redirectUri = process.env.OURA_REDIRECT_URI || "https://podiumthrows.com/api/oura/callback";

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.OURA_CLIENT_ID!,
        client_secret: process.env.OURA_CLIENT_SECRET!,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      logger.error("Oura token exchange failed", {
        context: "api",
        metadata: { status: tokenRes.status, body: text },
      });
      settingsUrl.searchParams.set("oura", "error");
      settingsUrl.searchParams.set("reason", "token_exchange_failed");
      return NextResponse.redirect(settingsUrl);
    }

    const tokenData = await tokenRes.json();

    const access_token = tokenData.access_token as string | undefined;
    const refresh_token = tokenData.refresh_token as string | undefined;
    const expires_in = (tokenData.expires_in ?? 86400) as number;
    const scope = (tokenData.scope ?? "") as string;

    if (!access_token) {
      logger.error("Oura token response missing tokens", {
        context: "api",
        metadata: {
          keys: Object.keys(tokenData),
          hasAccess: !!access_token,
          hasRefresh: !!refresh_token,
        },
      });
      settingsUrl.searchParams.set("oura", "error");
      settingsUrl.searchParams.set("reason", "missing_tokens");
      return NextResponse.redirect(settingsUrl);
    }

    // Fetch Oura profile to get their user ID
    const profile = await fetchProfile(access_token);

    // Encrypt tokens before storage
    if (!process.env.OURA_ENCRYPTION_KEY) {
      logger.error("OURA_ENCRYPTION_KEY not set", { context: "api" });
      settingsUrl.searchParams.set("oura", "error");
      settingsUrl.searchParams.set("reason", "encryption_key_not_configured");
      return NextResponse.redirect(settingsUrl);
    }
    const encryptedAccess = encrypt(access_token);
    const encryptedRefresh = refresh_token ? encrypt(refresh_token) : "";
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Upsert the connection (handles reconnection after disconnect)
    await prisma.ouraConnection.upsert({
      where: { athleteId: athlete.id },
      create: {
        athleteId: athlete.id,
        ouraUserId: profile.userId,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt,
        scopes: scope,
      },
      update: {
        ouraUserId: profile.userId,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt,
        scopes: scope,
        lastSyncAt: null,
      },
    });

    // Clear the state cookie and redirect to settings
    const response = NextResponse.redirect(
      new URL("/athlete/settings?oura=connected", request.url)
    );

    response.cookies.set("oura-oauth-state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal_error";
    logger.error("GET /api/oura/callback", { context: "api", error: err });
    settingsUrl.searchParams.set("oura", "error");
    settingsUrl.searchParams.set("reason", message);
    return NextResponse.redirect(settingsUrl);
  }
}
