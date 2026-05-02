import { logger } from "@/lib/logger";
import { REDACTED_FIELD_NAMES, REDACTED_FIELD_PATTERN } from "./types";

const REDACTED = "[REDACTED]" as const;

/**
 * Recursively walks a JSON-serializable value and replaces sensitive
 * fields with "[REDACTED]". Mutates a deep clone — caller's object is
 * untouched. The defensive regex pattern logs each hit so new sensitive
 * fields added to the schema are surfaced post-hoc instead of leaking.
 */
export function redactSensitive<T>(input: T): T {
  const hits: string[] = [];
  const result = walk(input, hits) as T;
  if (hits.length > 0) {
    logger.info("data-export: redacted fields", {
      context: "data-export/redact",
      metadata: { fields: Array.from(new Set(hits)) },
    });
  }
  return result;
}

function walk(value: unknown, hits: string[]): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => walk(v, hits));
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (shouldRedact(key)) {
      hits.push(key);
      out[key] = REDACTED;
      continue;
    }
    out[key] = walk(v, hits);
  }
  return out;
}

function shouldRedact(key: string): boolean {
  if (REDACTED_FIELD_NAMES.has(key)) return true;
  return REDACTED_FIELD_PATTERN.test(key);
}
