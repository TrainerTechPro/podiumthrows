import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma ─────────────────────────────────────────────────────────────

const mockSuggestionFindUnique = vi.fn();
const mockSuggestionUpdate = vi.fn();
const mockSessionUpdate = vi.fn();
const mockProgramUpdate = vi.fn();
const mockProgramFindUnique = vi.fn();
const mockNotificationCreate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    autoregulationSuggestion: {
      findUnique: (...args: unknown[]) => mockSuggestionFindUnique(...args),
      update: (...args: unknown[]) => mockSuggestionUpdate(...args),
    },
    programSession: {
      update: (...args: unknown[]) => mockSessionUpdate(...args),
    },
    trainingProgram: {
      findUnique: (...args: unknown[]) => mockProgramFindUnique(...args),
      update: (...args: unknown[]) => mockProgramUpdate(...args),
    },
    notification: {
      create: (...args: unknown[]) => mockNotificationCreate(...args),
    },
  },
}));

import { approveSuggestion } from '../apply-suggestion';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sug-1',
    programId: 'prog-1',
    athleteId: 'ath-1',
    timescale: 'BLOCK_TO_BLOCK',
    status: 'PENDING',
    suggestedChange: JSON.stringify({ action: 'ROTATE_COMPLEX', newComplexNum: 3 }),
    reasoning: 'Mark trend declining — rotate complex',
    expiresAt: new Date(),
    autoApproveAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    checkpointId: null,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('suggestion-lifecycle (approveSuggestion)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: program lookup returns a coach
    mockProgramFindUnique.mockResolvedValue({ coachId: 'coach-1', athleteId: 'ath-1' });
    mockSuggestionUpdate.mockResolvedValue({});
    mockSessionUpdate.mockResolvedValue({});
    mockProgramUpdate.mockResolvedValue({});
    mockNotificationCreate.mockResolvedValue({});
  });

  it('throws when suggestion not found', async () => {
    mockSuggestionFindUnique.mockResolvedValue(null);

    await expect(approveSuggestion('nonexistent-id', 'coach-1'))
      .rejects.toThrow(/not found/i);
  });

  it('throws when suggestion status is not PENDING', async () => {
    mockSuggestionFindUnique.mockResolvedValue(
      makeSuggestion({ status: 'APPROVED' }),
    );

    await expect(approveSuggestion('sug-1', 'coach-1'))
      .rejects.toThrow(/not PENDING/i);
  });

  it('INTRA_SESSION: updates session with wasModified=true', async () => {
    mockSuggestionFindUnique.mockResolvedValue(
      makeSuggestion({
        timescale: 'INTRA_SESSION',
        suggestedChange: JSON.stringify({
          targetSessionId: 'sess-1',
          blockNumber: 2,
          adjustedThrowsPrescription: { throws: [{ implement: 'hammer', count: 4 }] },
          volumeReductionPct: 20,
          note: 'Reduced volume due to fatigue',
        }),
      }),
    );

    await approveSuggestion('sug-1', 'coach-1');

    expect(mockSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sess-1' },
        data: expect.objectContaining({ wasModified: true }),
      }),
    );
  });

  it('SESSION_TO_SESSION: updates target session', async () => {
    mockSuggestionFindUnique.mockResolvedValue(
      makeSuggestion({
        timescale: 'SESSION_TO_SESSION',
        suggestedChange: JSON.stringify({
          targetSessionId: 'sess-2',
          volumeMultiplier: 0.8,
          adjustedThrowsPrescription: {},
        }),
      }),
    );

    await approveSuggestion('sug-1', 'coach-1');

    expect(mockSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sess-2' },
      }),
    );
  });

  it('BLOCK_TO_BLOCK: ROTATE_COMPLEX updates program currentComplexNum', async () => {
    mockSuggestionFindUnique.mockResolvedValue(
      makeSuggestion({
        timescale: 'BLOCK_TO_BLOCK',
        suggestedChange: JSON.stringify({ action: 'ROTATE_COMPLEX', newComplexNum: 3 }),
      }),
    );

    await approveSuggestion('sug-1', 'coach-1');

    expect(mockProgramUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prog-1' },
        data: expect.objectContaining({ currentComplexNum: 3 }),
      }),
    );
  });

  it('notification created after approval for all timescales', async () => {
    const timescales = [
      { timescale: 'INTRA_SESSION', change: { targetSessionId: 'sess-1', note: 'x' } },
      { timescale: 'SESSION_TO_SESSION', change: { targetSessionId: 'sess-2' } },
      { timescale: 'BLOCK_TO_BLOCK', change: { action: 'ROTATE_COMPLEX', newComplexNum: 2 } },
      { timescale: 'WEEK_TO_WEEK', change: {} },
      { timescale: 'PROGRAM_TO_PROGRAM', change: {} },
    ];

    for (const { timescale, change } of timescales) {
      vi.clearAllMocks();
      mockProgramFindUnique.mockResolvedValue({ coachId: 'coach-1', athleteId: 'ath-1' });
      mockSuggestionUpdate.mockResolvedValue({});
      mockSessionUpdate.mockResolvedValue({});
      mockProgramUpdate.mockResolvedValue({});
      mockNotificationCreate.mockResolvedValue({});

      mockSuggestionFindUnique.mockResolvedValue(
        makeSuggestion({
          timescale,
          suggestedChange: JSON.stringify(change),
        }),
      );

      await approveSuggestion('sug-1', 'coach-1');

      expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    }
  });
});
