import type { SoreArea } from "@/components/ui/InteractiveBodyMap";
import { logger } from "@/lib/logger";

export function parseSorenessArea(raw: string | null): {
  isStructured: boolean;
  areas: SoreArea[];
  legacyText: string | null;
} {
  if (!raw) return { isStructured: false, areas: [], legacyText: null };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].slug) {
      return { isStructured: true, areas: parsed, legacyText: null };
    }
  } catch (err) {
    // Not JSON — legacy format
    logger.debug("Not JSON — legacy format", {
      context: "src/lib/readiness/parse-soreness.ts",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }
  return { isStructured: false, areas: [], legacyText: raw };
}

export function serializeSorenessArea(areas: SoreArea[]): string | null {
  if (areas.length === 0) return null;
  return JSON.stringify(areas);
}
