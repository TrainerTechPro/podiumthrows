/**
 * Web Push helper.
 *
 * Wraps the `web-push` package with a simpler API: given a user ID and
 * a payload, iterate that user's stored PushSubscriptions and send the
 * notification to each endpoint. Subscriptions that return 404/410 are
 * automatically purged (the browser has invalidated them).
 *
 * Server-side only. Expects the following env vars:
 *   - VAPID_PUBLIC_KEY
 *   - VAPID_PRIVATE_KEY
 *   - VAPID_SUBJECT  (e.g. "mailto:you@example.com")
 *
 * If any of these are missing, sendPushToUser() is a no-op that logs a
 * warning once. This keeps dev work unblocked on machines without VAPID
 * keys configured.
 */

// web-push transitively imports node 'net' — bundling this into a client
// chunk fails the build with "Module not found: Can't resolve 'net'" (see
// PODIUM-THROWS-G, fixed by extracting streak-milestones.ts in #67). The
// server-only marker makes that failure mode loud at the import site
// instead of waiting for the bundler to discover it three modules deep.
import "server-only";
import webpush from "web-push";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type PushPayload = {
  title: string;
  body: string;
  /** Absolute or relative URL to open on notification click */
  url?: string;
  /** Notification tag — replaces any prior push with the same tag */
  tag?: string;
  /** Optional metadata echoed back to the service worker */
  data?: Record<string, unknown>;
};

/* ─── Lazy VAPID setup ───────────────────────────────────────────────────── */

let vapidConfigured: boolean | null = null;
let missingWarningLogged = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured !== null) return vapidConfigured;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    if (!missingWarningLogged) {
      // Warn (not error) — the per-file comment promises "logs a warning once"
      // and the no-op return is by design for envs without VAPID. logger.error
      // captures to Sentry (`src/lib/logger.ts:150`); a recurring config gap
      // shouldn't escalate (PODIUM-THROWS-16: prod cron paged on every tick).
      logger.warn(
        "VAPID keys not configured — Web Push is disabled. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.",
        { context: "push" }
      );
      missingWarningLogged = true;
    }
    vapidConfigured = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

/* ─── Public API ─────────────────────────────────────────────────────────── */

/**
 * Send a push notification to every active subscription for a given user.
 * Returns the number of successful deliveries.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureVapidConfigured()) return 0;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      authSecret: true,
    },
  });
  if (subs.length === 0) return 0;

  const serializedPayload = JSON.stringify(payload);
  const staleIds: string[] = [];
  let successes = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.authSecret,
            },
          },
          serializedPayload
        );
        successes += 1;
      } catch (err) {
        // web-push throws with a statusCode property for HTTP errors
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : null;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(sub.id);
        } else {
          logger.error("Push delivery failed", {
            context: "push",
            error: err,
            metadata: { subscriptionId: sub.id },
          });
        }
      }
    })
  );

  // Purge subscriptions the browser has invalidated
  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } }).catch(() => null);
  }

  // Update lastUsedAt on surviving subscriptions in the background.
  // Not awaited — best-effort metric.
  void prisma.pushSubscription
    .updateMany({
      where: {
        userId,
        id: { notIn: staleIds },
      },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => null);

  return successes;
}

/** Returns the configured VAPID public key, or null if unset. */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}
