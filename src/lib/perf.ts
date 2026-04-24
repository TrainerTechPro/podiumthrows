// ---------------------------------------------------------------------------
// Lightweight performance instrumentation
//
// Logs timing data through the shared logger, so entries carry timestamps and
// land as Sentry breadcrumbs alongside other app events.
// ---------------------------------------------------------------------------

import { logger } from "@/lib/logger";

export async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const ms = Number((performance.now() - start).toFixed(1));
    logger.info(`[perf] ${label}`, { context: "perf", metadata: { label, ms } });
    return result;
  } catch (err) {
    const ms = Number((performance.now() - start).toFixed(1));
    logger.warn(`[perf] ${label} FAILED`, {
      context: "perf",
      metadata: { label, ms, failed: true },
    });
    throw err;
  }
}

export function logCacheEvent(key: string, hit: boolean): void {
  logger.info(`[cache] ${key}: ${hit ? "HIT" : "MISS"}`, {
    context: "perf/cache",
    metadata: { key, hit },
  });
}

/**
 * Time a section of code and return the result with duration.
 * Useful when you need the timing value for further processing.
 */
export async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, durationMs: performance.now() - start };
}
