// ---------------------------------------------------------------------------
// Lightweight performance instrumentation
//
// Logs timing data to Vercel Function Logs (viewable in dashboard or
// `vercel logs`). No external dependencies required.
// ---------------------------------------------------------------------------

/**
 * Wrap an async function with timing instrumentation.
 * Logs duration to console (visible in Vercel Function Logs).
 *
 * @example
 *   const roster = await withTiming("getAthleteRoster", () => getAthleteRoster(coachId));
 */
export async function withTiming<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const ms = (performance.now() - start).toFixed(1);
    console.log(`[perf] ${label}: ${ms}ms`);
    return result;
  } catch (err) {
    const ms = (performance.now() - start).toFixed(1);
    console.log(`[perf] ${label}: FAILED after ${ms}ms`);
    throw err;
  }
}

/**
 * Log a cache hit or miss for observability.
 */
export function logCacheEvent(
  key: string,
  hit: boolean,
): void {
  console.log(`[cache] ${key}: ${hit ? "HIT" : "MISS"}`);
}

/**
 * Time a section of code and return the result with duration.
 * Useful when you need the timing value for further processing.
 */
export async function timed<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, durationMs: performance.now() - start };
}
