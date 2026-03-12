// ── Apply Suggestion ─────────────────────────────────────────────────────────
// Approves a PENDING AutoregulationSuggestion — applies the suggestedChange
// to the relevant Prisma model and marks the suggestion as APPROVED.

import prisma from '@/lib/prisma';

/**
 * Approve and apply an autoregulation suggestion.
 *
 * @param suggestionId - The suggestion to approve.
 * @param coachId      - The acting coach (for audit / notification ownership).
 * @throws If the suggestion is not found or is not in PENDING status.
 */
export async function approveSuggestion(
  suggestionId: string,
  _coachId: string,
): Promise<void> {
  const suggestion = await prisma.autoregulationSuggestion.findUnique({
    where: { id: suggestionId },
  });

  if (!suggestion) {
    throw new Error(`Suggestion not found: ${suggestionId}`);
  }

  if (suggestion.status !== 'PENDING') {
    throw new Error(`Suggestion is not PENDING (status: ${suggestion.status})`);
  }

  const change = JSON.parse(suggestion.suggestedChange);

  // ── Apply based on timescale ──────────────────────────────────────────────

  switch (suggestion.timescale) {
    case 'INTRA_SESSION': {
      const sessionId = change.targetSessionId ?? change.sessionId;
      if (sessionId) {
        await prisma.programSession.update({
          where: { id: sessionId },
          data: {
            wasModified: true,
            modificationNotes: change.note ?? 'Adjusted by autoregulation',
          },
        });
      }
      break;
    }

    case 'SESSION_TO_SESSION': {
      if (change.targetSessionId) {
        await prisma.programSession.update({
          where: { id: change.targetSessionId },
          data: {
            wasModified: true,
            modificationNotes: 'Volume adjusted by autoregulation',
          },
        });
      }
      break;
    }

    case 'BLOCK_TO_BLOCK': {
      if (change.action === 'ROTATE_COMPLEX' && change.newComplexNum != null) {
        await prisma.trainingProgram.update({
          where: { id: suggestion.programId },
          data: { currentComplexNum: change.newComplexNum },
        });
      }
      break;
    }

    case 'WEEK_TO_WEEK':
    case 'PROGRAM_TO_PROGRAM':
      // These timescales are handled by their respective trigger side-effects.
      break;
  }

  // ── Mark as APPROVED ──────────────────────────────────────────────────────

  await prisma.autoregulationSuggestion.update({
    where: { id: suggestionId },
    data: { status: 'APPROVED' },
  });

  // ── Notification ──────────────────────────────────────────────────────────

  const program = await prisma.trainingProgram.findUnique({
    where: { id: suggestion.programId },
    select: { coachId: true, athleteId: true },
  });

  if (program?.coachId) {
    await prisma.notification.create({
      data: {
        coachId: program.coachId,
        athleteId: program.athleteId ?? null,
        type: 'AUTOREG_SUGGESTION_APPLIED',
        title: 'Autoregulation suggestion applied',
        body: suggestion.reasoning,
      },
    });
  }
}
