/**
 * Rate limiter for auth endpoints.
 *
 * SERVERLESS NOTE: This uses in-memory storage which resets on cold starts.
 * It still provides protection within warm instances and is sufficient for
 * low-to-moderate traffic. For production at scale, swap the store below
 * with a Redis/Upstash-backed implementation.
 *
 * Upgrade path:
 *   1. Install @upstash/ratelimit and @upstash/redis
 *   2. Implement RateLimitStore using Upstash Ratelimit
 *   3. Replace `store` below with the Redis-backed instance
 */

interface RateLimitStore {
  increment(key: string, windowMs: number): { count: number; resetIn: number };
}

class InMemoryStore implements RateLimitStore {
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

const store: RateLimitStore = new InMemoryStore();

export function checkRateLimit(
  identifier: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): { allowed: boolean; remaining: number; resetIn: number } {
  const { count, resetIn } = store.increment(identifier, windowMs);

  if (count > maxAttempts) {
    return { allowed: false, remaining: 0, resetIn };
  }

  return {
    allowed: true,
    remaining: maxAttempts - count,
    resetIn,
  };
}
