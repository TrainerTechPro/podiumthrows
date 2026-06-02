/**
 * Centralized environment validation, run once at server boot from
 * `src/instrumentation.ts` (Node.js runtime only).
 *
 * Design — deliberately conservative to avoid turning a misconfig into an outage:
 *
 *   CRITICAL (throw): vars the app cannot serve a single request without. Missing
 *     them means every DB-backed route and auth check is already dead — failing
 *     loud at boot with a clear message is strictly better than opaque 500s
 *     scattered across the request path.
 *
 *   DEGRADABLE (warn): vars whose absence breaks one feature but leaves the app
 *     up (payments, video upload, distributed rate limiting, observability,
 *     wearable integrations, email). These previously failed silently or late
 *     — surfacing them once, loudly, at boot is the point. We never throw on
 *     these: a missing Stripe key must not take down the whole app.
 *
 * Warnings only fire in production; dev/test intentionally run without most of
 * these and shouldn't be nagged.
 */

const CRITICAL: { key: string; why: string }[] = [
  { key: "POSTGRES_PRISMA_URL", why: "Prisma pooled connection — no DB access without it" },
  { key: "POSTGRES_URL_NON_POOLING", why: "Prisma direct/migration connection" },
  {
    key: "JWT_SECRET",
    why: "session token signing/verification — auth is non-functional without it",
  },
];

/**
 * Degradable groups. A group passes if AT LEAST the listed `requires` are present.
 * For email we accept either Resend or SMTP, so it's modelled as two groups and
 * we warn only if BOTH are absent (handled below).
 */
const DEGRADABLE: { feature: string; keys: string[] }[] = [
  { feature: "Stripe billing", keys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
  { feature: "Stripe price IDs", keys: ["STRIPE_PRICE_PRO", "STRIPE_PRICE_ELITE"] },
  {
    feature: "Cloudflare R2 video/image storage",
    keys: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"],
  },
  { feature: "Cron authentication", keys: ["CRON_SECRET"] },
  {
    feature: "Distributed rate limiting (falls back to per-instance in-memory)",
    keys: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  },
  { feature: "Sentry error tracking", keys: ["SENTRY_DSN"] },
  { feature: "Encryption keys (MFA / wearable tokens)", keys: ["MFA_ENCRYPTION_KEY"] },
  { feature: "Web push (VAPID)", keys: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"] },
];

function isSet(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Validate required env vars. Throws (aggregated) on missing CRITICAL vars.
 * Logs a single grouped warning for missing DEGRADABLE features in production.
 *
 * Uses console rather than the app logger to avoid import-order issues at boot
 * and because this runs before the logger's transports are guaranteed ready.
 */
export function validateEnv(): void {
  // Production-strict, dev-lenient — matches the app's existing contract
  // (auth.ts only requires JWT_SECRET in prod; Prisma errors lazily in dev).
  // Enforcing at boot in dev would break `next dev`/`next build` on fresh
  // checkouts for zero benefit, since the dev server is non-functional
  // without these anyway and fails with its own clear error.
  if (process.env.NODE_ENV !== "production") return;

  const missingCritical = CRITICAL.filter((c) => !isSet(c.key));
  if (missingCritical.length > 0) {
    const detail = missingCritical.map((c) => `  - ${c.key}: ${c.why}`).join("\n");
    throw new Error(
      `[env] Missing required environment variable(s):\n${detail}\n` +
        `The app cannot start without these. Set them in the Vercel project.`
    );
  }

  const missingFeatures = DEGRADABLE.filter((g) => g.keys.some((k) => !isSet(k))).map((g) => {
    const absent = g.keys.filter((k) => !isSet(k));
    return `  - ${g.feature} (missing: ${absent.join(", ")})`;
  });

  // Email: warn only if NEITHER Resend nor SMTP is configured.
  const hasResend = isSet("RESEND_API_KEY");
  const hasSmtp = isSet("SMTP_HOST") && isSet("SMTP_USER") && isSet("SMTP_PASS");
  if (!hasResend && !hasSmtp) {
    missingFeatures.push("  - Transactional email (neither RESEND_API_KEY nor SMTP_* configured)");
  }

  if (missingFeatures.length > 0) {
    // eslint-disable-next-line no-console -- boot-time diagnostics; logger transports may not be ready
    console.warn(
      `[env] Optional integrations not configured — these features will be disabled in production:\n` +
        missingFeatures.join("\n")
    );
  }
}
