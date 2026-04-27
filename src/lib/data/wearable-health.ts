/**
 * Single source of truth for wearable connection health.
 *
 * Both the dashboard reauth banner and the /athlete/integrations page read
 * from this helper so they cannot disagree about whether a coach actually
 * needs to reconnect WHOOP / Oura.
 *
 * The two failure modes we care about:
 *   • needsReauth — refresh token is missing or scope no longer covers
 *     refresh. Hard fail; only fix is OAuth round-trip.
 *   • lastSyncError — last sync threw. Could be transient (rate limit,
 *     network) or could be the auth-expiry that the next refresh will
 *     surface as needsReauth. Show in the integrations card; only nag the
 *     dashboard when it's been failing for a while.
 */

import prisma from "@/lib/prisma";
import { needsReauth } from "@/lib/wearable-auth";
import { logger } from "@/lib/logger";

export type WearableProvider = "whoop" | "oura";

export interface WearableHealth {
  provider: WearableProvider;
  connected: boolean;
  needsReauth: boolean;
  lastSyncAt: string | null; // ISO
  lastSyncError: string | null;
  lastSyncErrorAt: string | null; // ISO
}

export interface WearableHealthSummary {
  whoop: WearableHealth | null;
  oura: WearableHealth | null;
  /** True iff any connected integration needs reauth. Drives the banner. */
  anyNeedsReauth: boolean;
}

/**
 * Fetch wearable health for a single athlete profile id. Returns null
 * connections when the integration row doesn't exist (athlete has never
 * connected the device). Catches table-missing errors so this never
 * crashes a dashboard render.
 */
export async function getWearableHealth(athleteId: string): Promise<WearableHealthSummary> {
  let whoopRow: {
    refreshToken: string;
    scopes: string;
    lastSyncAt: Date | null;
    lastSyncError: string | null;
    lastSyncErrorAt: Date | null;
  } | null = null;
  try {
    whoopRow = await prisma.whoopConnection.findUnique({
      where: { athleteId },
      select: {
        refreshToken: true,
        scopes: true,
        lastSyncAt: true,
        lastSyncError: true,
        lastSyncErrorAt: true,
      },
    });
  } catch (err) {
    logger.debug("whoopConnection lookup failed", {
      context: "lib/data/wearable-health",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }

  let ouraRow: {
    refreshToken: string;
    scopes: string;
    lastSyncAt: Date | null;
    lastSyncError: string | null;
    lastSyncErrorAt: Date | null;
  } | null = null;
  try {
    ouraRow = await prisma.ouraConnection.findUnique({
      where: { athleteId },
      select: {
        refreshToken: true,
        scopes: true,
        lastSyncAt: true,
        lastSyncError: true,
        lastSyncErrorAt: true,
      },
    });
  } catch (err) {
    logger.debug("ouraConnection lookup failed", {
      context: "lib/data/wearable-health",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }

  const whoop: WearableHealth | null = whoopRow
    ? {
        provider: "whoop",
        connected: true,
        // WHOOP needs the "offline" scope for refresh tokens to work.
        needsReauth: needsReauth(whoopRow.refreshToken, whoopRow.scopes, "offline"),
        lastSyncAt: whoopRow.lastSyncAt?.toISOString() ?? null,
        lastSyncError: whoopRow.lastSyncError,
        lastSyncErrorAt: whoopRow.lastSyncErrorAt?.toISOString() ?? null,
      }
    : null;

  const oura: WearableHealth | null = ouraRow
    ? {
        provider: "oura",
        connected: true,
        // Oura always issues refresh tokens — only the empty case fails.
        needsReauth: needsReauth(ouraRow.refreshToken, ouraRow.scopes, ""),
        lastSyncAt: ouraRow.lastSyncAt?.toISOString() ?? null,
        lastSyncError: ouraRow.lastSyncError,
        lastSyncErrorAt: ouraRow.lastSyncErrorAt?.toISOString() ?? null,
      }
    : null;

  return {
    whoop,
    oura,
    anyNeedsReauth: !!(whoop?.needsReauth || oura?.needsReauth),
  };
}
