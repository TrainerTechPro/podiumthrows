import { Prisma, PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Slow-query threshold (ms). Queries at/over this are logged once, with the
 * parameterized SQL + duration but NOT bound params (which can hold PII).
 *
 * This is the standing early-warning system for scalability regressions — the
 * N+1, the unbounded scan, the query that's fine at 50 athletes and degrades at
 * 5,000 — surfaced in prod against real data before it becomes an incident.
 *
 * Default: 1000ms in production, off elsewhere. Override with `DB_SLOW_QUERY_MS`
 * (e.g. `500` to tighten, `0` to disable entirely — which also skips the query
 * event emission so there's zero overhead when off).
 */
export function resolveSlowQueryMs(raw: string | undefined, isProd: boolean): number {
  if (raw !== undefined) {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return isProd ? 1000 : 0;
}
const SLOW_QUERY_MS = resolveSlowQueryMs(
  process.env.DB_SLOW_QUERY_MS,
  process.env.NODE_ENV === "production"
);
const slowQueryEnabled = SLOW_QUERY_MS > 0;

/**
 * Append `key=value` to a connection URL only if that param isn't already
 * present. String-based (not `new URL()`) on purpose: a URL round-trip can
 * re-encode credentials in a Postgres connection string and corrupt them.
 * Exported for tests.
 */
export function ensureUrlParam(url: string, key: string, value: string): string {
  if (new RegExp(`[?&]${key}=`).test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${key}=${value}`;
}

/**
 * Resolve the pooled runtime connection string with an EXPLICIT connection
 * limit + pool timeout.
 *
 * Why: Prisma's implicit default is `num_cpus * 2 + 1`. On Vercel Fluid Compute
 * that's CPU-count-dependent and non-deterministic — a runtime CPU change can
 * silently shift how many connections each instance opens against PgBouncer,
 * and under burst (many instances) that multiplies into pool exhaustion
 * ("Timed out fetching a new connection from the connection pool") at peak load.
 * Pinning it makes per-instance pressure deterministic; `pool_timeout` makes a
 * starved pool fail fast instead of hanging the request.
 *
 * Tunable via env (`DB_CONNECTION_LIMIT`, `DB_POOL_TIMEOUT`) without a code
 * redeploy, and skipped per-param if the URL already specifies it (so a value
 * set directly on `POSTGRES_PRISMA_URL` always wins). `pgbouncer=true` and all
 * other existing params are preserved. Returns undefined if no pooled URL is
 * configured (e.g. some test envs) so the client falls back to defaults.
 */
export function resolvePooledUrl(): string | undefined {
  const base = process.env.POSTGRES_PRISMA_URL;
  if (!base) return undefined;
  // `||` (not `??`) so an empty env var — e.g. `DB_CONNECTION_LIMIT=` left blank
  // in the env file — is treated as unset and falls back to the default.
  let url = ensureUrlParam(base, "connection_limit", process.env.DB_CONNECTION_LIMIT || "5");
  url = ensureUrlParam(url, "pool_timeout", process.env.DB_POOL_TIMEOUT || "15");
  return url;
}

function createPrismaClient(): PrismaClient {
  const url = resolvePooledUrl();
  const client = new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    ...(slowQueryEnabled ? { log: [{ level: "query", emit: "event" }] } : {}),
  });

  if (slowQueryEnabled) {
    // $on("query") is only typed when the client was built with the query-event
    // log option; we build options dynamically, so assert the listener shape.
    (
      client as unknown as {
        $on: (event: "query", cb: (e: Prisma.QueryEvent) => void) => void;
      }
    ).$on("query", (e) => {
      if (e.duration >= SLOW_QUERY_MS) {
        // e.query is parameterized SQL ($1, $2…); e.params (bound values) is
        // intentionally NOT logged — it can contain PII.
        logger.warn("slow DB query", {
          context: "db",
          metadata: { durationMs: e.duration, query: e.query, target: e.target },
        });
      }
    });
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
