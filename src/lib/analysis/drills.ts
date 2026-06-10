import prisma from "@/lib/prisma";
import type { AnalysisEvent, NarrativeDrillOption } from "@/lib/contracts";
import { loadShotPutRules } from "./faults/engine";

/**
 * drillTag → existing Drill rows (decisions.md D8). The narrative layer may
 * select ONLY from what this resolver returns — the LLM never invents drills
 * (F7). Matching: rules-config tag map gives a category and name keywords;
 * a drill matches a tag if it's in the mapped category OR its name contains
 * a keyword. Global drills and the coach's own drills are both eligible.
 */

const MAX_DRILLS_PER_TAG = 3;

export async function resolveDrillOptions(args: {
  event: AnalysisEvent;
  coachId: string | null;
  drillTags: string[];
}): Promise<NarrativeDrillOption[]> {
  const { event, coachId, drillTags } = args;
  if (drillTags.length === 0) return [];
  const tagMap = loadShotPutRules().drillTagMap;

  const drills = await prisma.drill.findMany({
    where: {
      event,
      OR: [{ isGlobal: true }, ...(coachId ? [{ coachId }] : [])],
    },
    select: { id: true, name: true, description: true, category: true },
    orderBy: { name: "asc" },
  });

  const options = new Map<string, NarrativeDrillOption>();
  for (const tag of drillTags) {
    const spec = tagMap[tag];
    if (!spec) continue;
    let matched = 0;
    for (const drill of drills) {
      if (matched >= MAX_DRILLS_PER_TAG) break;
      const nameLower = drill.name.toLowerCase();
      const byCategory = spec.category != null && drill.category === spec.category;
      const byKeyword = (spec.keywords ?? []).some((k) =>
        nameLower.includes(k.toLowerCase())
      );
      if (!byCategory && !byKeyword) continue;
      matched++;
      const existing = options.get(drill.id);
      if (existing) {
        if (!existing.tags.includes(tag)) existing.tags.push(tag);
      } else {
        options.set(drill.id, {
          id: drill.id,
          name: drill.name,
          description: drill.description,
          tags: [tag],
        });
      }
    }
  }
  return [...options.values()];
}
