import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma ─────────────────────────────────────────────────────────────

const mockFindUnique = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    autoregulationSettings: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

// Import AFTER mock is registered
import { getAutoregDecision } from '../resolve-settings';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSettings(overrides: Partial<{ weekToWeek: string; blockToBlock: string; programToProgram: string }> = {}) {
  return {
    weekToWeek: 'SUGGEST',
    blockToBlock: 'SUGGEST',
    programToProgram: 'SUGGEST',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('resolve-settings', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it('returns system default when no settings exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getAutoregDecision('coach-1', 'athlete-1', 'blockToBlock');

    expect(result.mode).toBe('SUGGEST');
    expect(result.shouldExecute).toBe(true);
  });

  it('athlete setting overrides coach setting', async () => {
    // First call (athlete-specific) returns OFF
    mockFindUnique.mockResolvedValueOnce(makeSettings({ blockToBlock: 'OFF' }));

    const result = await getAutoregDecision('coach-1', 'athlete-1', 'blockToBlock');

    expect(result.mode).toBe('OFF');
    expect(result.shouldExecute).toBe(false);
  });

  it('coach setting used when no athlete setting exists', async () => {
    // First call (athlete-specific) returns null
    mockFindUnique.mockResolvedValueOnce(null);
    // Second call (coach-global) returns AUTO
    mockFindUnique.mockResolvedValueOnce(makeSettings({ weekToWeek: 'AUTO' }));

    const result = await getAutoregDecision('coach-1', 'athlete-1', 'weekToWeek');

    expect(result.mode).toBe('AUTO');
    expect(result.shouldExecute).toBe(true);
  });

  it('getAutoregDecision returns shouldExecute=false when mode is OFF', async () => {
    mockFindUnique.mockResolvedValueOnce(makeSettings({ programToProgram: 'OFF' }));

    const result = await getAutoregDecision('coach-1', 'athlete-1', 'programToProgram');

    expect(result.shouldExecute).toBe(false);
    expect(result.mode).toBe('OFF');
  });

  it('getAutoregDecision returns shouldExecute=false when coachId is empty', async () => {
    const result = await getAutoregDecision('', 'athlete-1', 'blockToBlock');

    expect(result.shouldExecute).toBe(false);
    expect(result.mode).toBe('OFF');
    // prisma should not be called at all
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('getAutoregDecision returns shouldExecute=true when mode is AUTO and timescale enabled', async () => {
    mockFindUnique.mockResolvedValueOnce(makeSettings({ blockToBlock: 'AUTO' }));

    const result = await getAutoregDecision('coach-1', 'athlete-1', 'blockToBlock');

    expect(result.shouldExecute).toBe(true);
    expect(result.mode).toBe('AUTO');
  });
});
