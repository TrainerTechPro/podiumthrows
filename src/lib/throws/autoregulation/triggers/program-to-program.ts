// ── Program-to-Program Autoregulation Trigger ───────────────────────────────
// Fires when a TrainingProgram is marked as COMPLETED.
// Aggregates the program's performance history into a ProgramCarryforward record
// so the next program can be personalised from real data.

import type { PrismaClient, TrainingProgram, AthleteProfile } from '@prisma/client';
import { getAutoregDecision } from '../resolve-settings';

/** JSON context persisted in ProgramCarryforward.previousProgramContext. */
interface PreviousProgramContext {
  programId:               string;
  programName:             string;
  completedAt:             string;
  totalSessionsCompleted:  number;
  checkpointDecisions:     string[];
  bestMarksByImplement:    Record<string, number>;
  finalComplexNum:         number;
  finalPhaseId:            string | null;
  coachNotes:              string | null;
}

/**
 * Aggregate a completed program's history and write a ProgramCarryforward record.
 * Also creates an AutoregulationSuggestion when the coach has autoregulation enabled.
 *
 * ProgramCarryforward is ALWAYS written (even when autoregulation is OFF) because
 * it contains data that may be consumed manually by the coach.
 *
 * @param completedProgram - The program (already marked COMPLETED) with its athlete relation.
 * @param prisma           - PrismaClient instance from the calling route.
 */
export async function triggerProgramToProgram(
  completedProgram: TrainingProgram & { athlete: AthleteProfile | null },
  prisma: PrismaClient,
): Promise<void> {
  // ── 1. Aggregate program-level data ─────────────────────────────────────────

  const [checkpoints, completedSessions, throwResults] = await Promise.all([
    prisma.adaptationCheckpoint.findMany({
      where:   { programId: completedProgram.id },
      orderBy: { weekNumber: 'asc' },
      select:  { recommendation: true },
    }),
    prisma.programSession.findMany({
      where:  { programId: completedProgram.id, status: 'COMPLETED' },
      select: { id: true },
    }),
    prisma.programThrowResult.findMany({
      where:  { session: { programId: completedProgram.id }, distance: { gt: 0 } },
      select: { implement: true, distance: true },
    }),
  ]);

  const totalSessionsCompleted = completedSessions.length;
  const checkpointDecisions    = checkpoints.map((c) => c.recommendation);

  // Build bestMarksByImplement: implement label → best distance (meters)
  const bestMarksByImplement: Record<string, number> = {};
  for (const result of throwResults) {
    if (result.distance == null) continue;
    const current = bestMarksByImplement[result.implement] ?? 0;
    if (result.distance > current) {
      bestMarksByImplement[result.implement] = result.distance;
    }
  }

  // ── 2. Build PreviousProgramContext ─────────────────────────────────────────

  // TrainingProgram has no name field — derive a human-readable label.
  const programName = `${completedProgram.event} Program (${completedProgram.startDate})`;

  const previousProgramContext: PreviousProgramContext = {
    programId:              completedProgram.id,
    programName,
    completedAt:            new Date().toISOString(),
    totalSessionsCompleted,
    checkpointDecisions,
    bestMarksByImplement,
    finalComplexNum:        completedProgram.currentComplexNum ?? 1,
    finalPhaseId:           completedProgram.currentPhaseId ?? null,
    coachNotes:             completedProgram.notes ?? null,
  };

  // ── 3. Upsert ProgramCarryforward ────────────────────────────────────────────
  // Idempotent — safe if called twice for the same completed program.

  await prisma.programCarryforward.upsert({
    where: { completedProgramId: completedProgram.id },
    create: {
      completedProgramId:     completedProgram.id,
      athleteId:              completedProgram.athleteId ?? '',
      coachId:                completedProgram.coachId ?? null,
      previousProgramContext: JSON.stringify(previousProgramContext),
      consumed:               false,
    },
    update: {
      previousProgramContext: JSON.stringify(previousProgramContext),
    },
  });

  // ── 4. Resolve autoregulation settings ──────────────────────────────────────
  // Carryforward is already written above — return without a suggestion if disabled.

  if (!completedProgram.coachId || !completedProgram.athleteId) return;

  const { shouldExecute } = await getAutoregDecision(
    completedProgram.coachId,
    completedProgram.athleteId,
    'programToProgram',
  );

  if (!shouldExecute) return;

  // ── 5. Create AutoregulationSuggestion ──────────────────────────────────────

  const now      = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.autoregulationSuggestion.create({
    data: {
      programId:       completedProgram.id,
      athleteId:       completedProgram.athleteId,
      timescale:       'PROGRAM_TO_PROGRAM',
      status:          'PENDING',
      suggestedChange: JSON.stringify({ previousProgramContext }),
      reasoning:       'Program completed — carryforward context ready for next program',
      expiresAt,
      autoApproveAt:   null, // program-to-program is always coach-reviewed
    },
  });

  // ── 6. Create Notification ───────────────────────────────────────────────────

  await prisma.notification.create({
    data: {
      coachId:   completedProgram.coachId,
      athleteId: completedProgram.athleteId,
      type:      'AUTOREG_PROGRAM_COMPLETE',
      title:     'Program complete — carryforward ready',
      body:      `${programName} completed with ${totalSessionsCompleted} sessions. Carryforward context is ready for the next program.`,
    },
  });
}
