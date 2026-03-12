// ── Block-to-Block Autoregulation Trigger ───────────────────────────────────
// Fires after an AdaptationCheckpoint is created.
// Creates an AutoregulationSuggestion when the engine recommends ROTATE_COMPLEX
// or ADVANCE_PHASE, which are the only decisions that warrant a block-level action.

import type { PrismaClient, AdaptationCheckpoint, TrainingProgram } from '@prisma/client';
import { getAutoregDecision } from '../resolve-settings';

/** Decisions that warrant a block-level autoregulation suggestion. */
const BLOCK_DECISIONS = new Set(['ROTATE_COMPLEX', 'ADVANCE_PHASE']);

/**
 * Evaluate a freshly-created AdaptationCheckpoint and create a block-to-block
 * AutoregulationSuggestion if warranted.
 *
 * @param checkpoint - The checkpoint including its parent program relation.
 * @param prisma     - PrismaClient instance from the calling route.
 */
export async function triggerBlockToBlock(
  checkpoint: AdaptationCheckpoint & { program: TrainingProgram },
  prisma: PrismaClient,
): Promise<void> {
  const decision = checkpoint.recommendation;

  if (!BLOCK_DECISIONS.has(decision)) {
    return;
  }

  // ── Build suggestedChange ──────────────────────────────────────────────────

  const suggestedChange =
    decision === 'ROTATE_COMPLEX'
      ? {
          action: 'ROTATE_COMPLEX',
          newComplexNum: (checkpoint.program.currentComplexNum ?? 1) + 1,
        }
      : {
          action: 'ADVANCE_PHASE',
          // Cannot determine next phase without phase sequence data — surface to coach.
          newPhaseId: null,
        };

  // ── Resolve settings ───────────────────────────────────────────────────────

  const { shouldExecute, mode } = await getAutoregDecision(
    checkpoint.program.coachId ?? '',
    checkpoint.program.athleteId ?? undefined,
    'blockToBlock',
  );

  if (!shouldExecute) return;

  // ── Compute timestamps ─────────────────────────────────────────────────────

  const now = new Date();
  // AUTO mode: set a 48-hour deadline — cron auto-approves if coach doesn't act.
  const autoApproveAt =
    mode === 'AUTO' ? new Date(now.getTime() + 48 * 60 * 60 * 1000) : null;
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // ── Create suggestion ──────────────────────────────────────────────────────

  // Block-to-block suggestions always start PENDING — the 48h cron handles AUTO approval.
  await prisma.autoregulationSuggestion.create({
    data: {
      programId:      checkpoint.programId,
      athleteId:      checkpoint.program.athleteId ?? null,
      checkpointId:   checkpoint.id,
      timescale:      'BLOCK_TO_BLOCK',
      status:         'PENDING',
      suggestedChange: JSON.stringify(suggestedChange),
      reasoning:      checkpoint.reasoning,
      expiresAt,
      autoApproveAt,
    },
  });

  // ── Create notification (coach only) ──────────────────────────────────────

  if (!checkpoint.program.coachId) return;

  const actionLabel =
    decision === 'ROTATE_COMPLEX'
      ? `Rotate exercise complex to #${(checkpoint.program.currentComplexNum ?? 1) + 1}`
      : 'Advance to next training phase';

  await prisma.notification.create({
    data: {
      coachId:   checkpoint.program.coachId,
      athleteId: checkpoint.program.athleteId ?? null,
      type:      'AUTOREG_BLOCK_SUGGESTION',
      title:     'Block transition recommended',
      body:      `${actionLabel} — ${checkpoint.reasoning}`,
    },
  });
}
