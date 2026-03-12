import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdaptationCheckpoint, TrainingProgram, AthleteProfile } from '@prisma/client';

// ── Mock resolve-settings (used by triggers) ────────────────────────────────

const mockGetAutoregDecision = vi.fn();

vi.mock('../resolve-settings', () => ({
  getAutoregDecision: (...args: unknown[]) => mockGetAutoregDecision(...args),
}));

import { triggerBlockToBlock } from '../triggers/block-to-block';
import { triggerProgramToProgram } from '../triggers/program-to-program';

// ── Mock Prisma client factory ──────────────────────────────────────────────

function createMockPrisma() {
  return {
    autoregulationSuggestion: {
      create: vi.fn().mockResolvedValue({}),
    },
    notification: {
      create: vi.fn().mockResolvedValue({}),
    },
    adaptationCheckpoint: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    programSession: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    programThrowResult: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    programCarryforward: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    trainingProgram: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCheckpoint(overrides: Record<string, unknown> = {}): AdaptationCheckpoint {
  return {
    id: 'cp-1',
    programId: 'prog-1',
    checkDate: '2026-03-10',
    weekNumber: 4,
    complexNumber: 1,
    recentMarks: '[]',
    markTrend: 'STABLE',
    averageMark: 18.5,
    peakMark: 19.2,
    markSlope: 0.01,
    avgReadiness: 75,
    avgSoreness: 4,
    recommendation: 'CONTINUE',
    reasoning: 'Marks stable, continue current complex.',
    applied: false,
    feedbackData: null,
    createdAt: new Date(),
    ...overrides,
  } as unknown as AdaptationCheckpoint;
}

function makeProgram(overrides: Record<string, unknown> = {}): TrainingProgram {
  return {
    id: 'prog-1',
    coachId: 'coach-1',
    athleteId: 'ath-1',
    event: 'SHOT_PUT',
    gender: 'MALE',
    competitionWeight: 7.26,
    currentComplexNum: 2,
    currentPhaseId: 'phase-1',
    currentWeekNumber: 4,
    totalWeeks: 16,
    sessionsToForm: 30,
    status: 'ACTIVE',
    notes: null,
    startDate: '2026-01-06',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as TrainingProgram;
}

function makeCompletedProgram(): TrainingProgram & { athlete: AthleteProfile | null } {
  return {
    ...makeProgram({ status: 'COMPLETED' }),
    athlete: {
      id: 'ath-1',
      userId: 'user-1',
      coachId: 'coach-1',
    } as unknown as AthleteProfile,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('trigger-chain', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockGetAutoregDecision.mockResolvedValue({ shouldExecute: true, mode: 'SUGGEST' });
  });

  // ── triggerBlockToBlock ──────────────────────────────────────────────────

  describe('triggerBlockToBlock', () => {
    it('returns early when decision is not ROTATE_COMPLEX or ADVANCE_PHASE', async () => {
      const checkpoint = makeCheckpoint({ recommendation: 'DELOAD' });
      const program = makeProgram();

      await triggerBlockToBlock(
        { ...checkpoint, program } as AdaptationCheckpoint & { program: TrainingProgram },
        mockPrisma as never,
      );

      expect(mockPrisma.autoregulationSuggestion.create).not.toHaveBeenCalled();
    });

    it('returns early when shouldExecute is false', async () => {
      mockGetAutoregDecision.mockResolvedValue({ shouldExecute: false, mode: 'OFF' });

      const checkpoint = makeCheckpoint({ recommendation: 'ROTATE_COMPLEX' });
      const program = makeProgram();

      await triggerBlockToBlock(
        { ...checkpoint, program } as AdaptationCheckpoint & { program: TrainingProgram },
        mockPrisma as never,
      );

      expect(mockPrisma.autoregulationSuggestion.create).not.toHaveBeenCalled();
    });

    it('creates PENDING suggestion for ROTATE_COMPLEX in SUGGEST mode', async () => {
      mockGetAutoregDecision.mockResolvedValue({ shouldExecute: true, mode: 'SUGGEST' });

      const checkpoint = makeCheckpoint({ recommendation: 'ROTATE_COMPLEX' });
      const program = makeProgram({ currentComplexNum: 2 });

      await triggerBlockToBlock(
        { ...checkpoint, program } as AdaptationCheckpoint & { program: TrainingProgram },
        mockPrisma as never,
      );

      expect(mockPrisma.autoregulationSuggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            timescale: 'BLOCK_TO_BLOCK',
            autoApproveAt: null,
          }),
        }),
      );

      // Verify suggestedChange contains correct newComplexNum
      const callData = mockPrisma.autoregulationSuggestion.create.mock.calls[0][0].data;
      const change = JSON.parse(callData.suggestedChange);
      expect(change.action).toBe('ROTATE_COMPLEX');
      expect(change.newComplexNum).toBe(3);
    });

    it('creates suggestion with autoApproveAt set in AUTO mode', async () => {
      mockGetAutoregDecision.mockResolvedValue({ shouldExecute: true, mode: 'AUTO' });

      const checkpoint = makeCheckpoint({ recommendation: 'ROTATE_COMPLEX' });
      const program = makeProgram();

      const beforeCall = Date.now();
      await triggerBlockToBlock(
        { ...checkpoint, program } as AdaptationCheckpoint & { program: TrainingProgram },
        mockPrisma as never,
      );

      const callData = mockPrisma.autoregulationSuggestion.create.mock.calls[0][0].data;
      expect(callData.autoApproveAt).toBeInstanceOf(Date);

      // autoApproveAt should be ~48 hours from now
      const diffHours = (callData.autoApproveAt.getTime() - beforeCall) / (60 * 60 * 1000);
      expect(diffHours).toBeGreaterThan(47);
      expect(diffHours).toBeLessThan(49);
    });

    it('creates notification for coach', async () => {
      const checkpoint = makeCheckpoint({ recommendation: 'ADVANCE_PHASE' });
      const program = makeProgram({ coachId: 'coach-1' });

      await triggerBlockToBlock(
        { ...checkpoint, program } as AdaptationCheckpoint & { program: TrainingProgram },
        mockPrisma as never,
      );

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            coachId: 'coach-1',
            type: 'AUTOREG_BLOCK_SUGGESTION',
          }),
        }),
      );
    });
  });

  // ── triggerProgramToProgram ──────────────────────────────────────────────

  describe('triggerProgramToProgram', () => {
    it('always creates ProgramCarryforward even when autoregulation is off', async () => {
      mockGetAutoregDecision.mockResolvedValue({ shouldExecute: false, mode: 'OFF' });

      const program = makeCompletedProgram();

      await triggerProgramToProgram(program, mockPrisma as never);

      expect(mockPrisma.programCarryforward.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { completedProgramId: program.id },
        }),
      );
      // But no suggestion should be created when OFF
      expect(mockPrisma.autoregulationSuggestion.create).not.toHaveBeenCalled();
    });

    it('creates suggestion and notification when autoregulation is enabled', async () => {
      mockGetAutoregDecision.mockResolvedValue({ shouldExecute: true, mode: 'SUGGEST' });

      const program = makeCompletedProgram();

      await triggerProgramToProgram(program, mockPrisma as never);

      expect(mockPrisma.programCarryforward.upsert).toHaveBeenCalled();
      expect(mockPrisma.autoregulationSuggestion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timescale: 'PROGRAM_TO_PROGRAM',
            status: 'PENDING',
          }),
        }),
      );
      expect(mockPrisma.notification.create).toHaveBeenCalled();
    });
  });
});
