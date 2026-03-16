// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const USE_UPSTASH = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

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
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
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

export async function rateLimit(
  identifier: string,
  { maxAttempts, windowMs }: RateLimitOptions
): Promise<RateLimitResult> {
  if (USE_UPSTASH) {
    const limiter = getUpstashLimiter(maxAttempts, windowMs);
    const { success, remaining, reset } = await limiter.limit(identifier);
    return {
      success,
      remaining,
      retryAfter: success ? 0 : Math.max(0, reset - Date.now()),
    };
  }

  // In-memory fallback
  const { count, resetIn } = memoryStore.increment(identifier, windowMs);
  const allowed = count <= maxAttempts;
  return {
    success: allowed,
    remaining: allowed ? maxAttempts - count : 0,
    retryAfter: allowed ? 0 : resetIn,
  };
}
