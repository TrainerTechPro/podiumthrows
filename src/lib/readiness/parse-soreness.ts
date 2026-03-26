import type { SoreArea } from "@/components/ui/InteractiveBodyMap";

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
  } catch {
    // Not JSON — legacy format
  }
  return { isStructured: false, areas: [], legacyText: raw };
}

export function serializeSorenessArea(areas: SoreArea[]): string | null {
  if (areas.length === 0) return null;
  return JSON.stringify(areas);
}
