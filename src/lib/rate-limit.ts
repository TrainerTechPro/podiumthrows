// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Accept either the upstream Upstash names or the names Vercel's Upstash
// (KV) marketplace integration provisions (KV_REST_API_URL / KV_REST_API_TOKEN).
// The KV_REST_API_* pair is the same REST endpoint + token the @upstash/redis
// client needs, just under Vercel's KV naming convention.
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const USE_UPSTASH = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

// ---------------------------------------------------------------------------
// Upstash backend (production)
// ---------------------------------------------------------------------------

let redis: Redis | null = null;
const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(maxAttempts: number, windowMs: number): Ratelimit {
  const key = `${maxAttempts}:${windowMs}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    if (!redis) {
      if (!UPSTASH_URL || !UPSTASH_TOKEN) {
        throw new Error(
          "UPSTASH_REDIS_REST_URL/KV_REST_API_URL and matching token must be set when USE_UPSTASH is enabled"
        );
      }
      redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
    }
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxAttempts, `${Math.ceil(windowMs / 1000)} s`),
      prefix: "podium-rl",
    });
    upstashLimiters.set(key, limiter);
  }
  return limiter;
}

// ---------------------------------------------------------------------------
// In-memory fallback (local dev / missing env vars)
// ---------------------------------------------------------------------------

class InMemoryStore {
  private attempts = new Map<string, { count: number; resetAt: number }>();
  private lastCleanup = Date.now();
  private readonly CLEANUP_INTERVAL = 60_000;

  private cleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL) return;
    this.lastCleanup = now;
    for (const [key, value] of this.attempts.entries()) {
      if (value.resetAt < now) this.attempts.delete(key);
    }
  }

  increment(key: string, windowMs: number): { count: number; resetIn: number } {
    this.cleanup();
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (!entry || entry.resetAt < now) {
      this.attempts.set(key, { count: 1, resetAt: now + windowMs });
      return { count: 1, resetIn: windowMs };
    }

    entry.count++;
    return { count: entry.count, resetIn: entry.resetAt - now };
  }
}

const memoryStore = new InMemoryStore();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfter: number;
}

function memoryLimit(
  identifier: string,
  { maxAttempts, windowMs }: RateLimitOptions
): RateLimitResult {
  const { count, resetIn } = memoryStore.increment(identifier, windowMs);
  const allowed = count <= maxAttempts;
  return {
    success: allowed,
    remaining: allowed ? maxAttempts - count : 0,
    retryAfter: allowed ? 0 : resetIn,
  };
}

export async function rateLimit(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { maxAttempts, windowMs } = options;

  if (USE_UPSTASH) {
    try {
      const limiter = getUpstashLimiter(maxAttempts, windowMs);
      const { success, remaining, reset } = await limiter.limit(identifier);
      return {
        success,
        remaining,
        retryAfter: success ? 0 : Math.max(0, reset - Date.now()),
      };
    } catch {
      // Degrade to per-instance in-memory limiting rather than fail-closed:
      // an Upstash outage/quota error must not 500 every mutation in the app.
      // Still enforces a (weaker, per-instance) limit instead of failing open.
      // Deliberately unlogged — this module is imported by middleware, which
      // keeps its bundle lean and edge-safe (no logger/Sentry, matching
      // auth-edge/csrf/flags). The degraded result is itself the handling.
      return memoryLimit(identifier, options);
    }
  }

  return memoryLimit(identifier, options);
}
