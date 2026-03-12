// ── Autoregulation Settings Resolver ────────────────────────────────────────
// Looks up per-coach/athlete settings from the DB and returns an AutoregDecision.
// Falls back to SUGGEST mode when no settings row exists.

import prisma from '@/lib/prisma';
import type { AutoregDecision, AutoregMode, AutoregTimescale } from './types';

const DEFAULT_MODE: AutoregMode = 'SUGGEST';

function resolveMode(
  settings: { weekToWeek: string; blockToBlock: string; programToProgram: string } | null,
  timescale: AutoregTimescale,
): AutoregMode {
  if (!settings) return DEFAULT_MODE;
  switch (timescale) {
    case 'weekToWeek':      return settings.weekToWeek as AutoregMode;
    case 'blockToBlock':    return settings.blockToBlock as AutoregMode;
    case 'programToProgram': return settings.programToProgram as AutoregMode;
  }
}

/**
 * Resolve the autoregulation mode for a given coach+athlete+timescale.
 *
 * Lookup order:
 * 1. Athlete-specific override (coachId + athleteId)
 * 2. Coach-global default (coachId + athleteId = null)
 * 3. Built-in default: SUGGEST
 *
 * Returns { shouldExecute: false, mode: 'OFF' } when coachId is missing.
 */
export async function getAutoregDecision(
  coachId: string,
  athleteId: string | null | undefined,
  timescale: AutoregTimescale,
): Promise<AutoregDecision> {
  if (!coachId) {
    return { shouldExecute: false, mode: 'OFF' };
  }

  const select = {
    weekToWeek: true,
    blockToBlock: true,
    programToProgram: true,
  } as const;

  // Try athlete-specific override first
  let settings = athleteId
    ? await prisma.autoregulationSettings.findUnique({
        where: { coachId_athleteId: { coachId, athleteId } },
        select,
      })
    : null;

  // Fall back to coach-global row (athleteId = null)
  if (!settings) {
    settings = await prisma.autoregulationSettings.findUnique({
      where: { coachId_athleteId: { coachId, athleteId: null as unknown as string } },
      select,
    });
  }

  const mode = resolveMode(settings, timescale);
  return { shouldExecute: mode !== 'OFF', mode };
}
