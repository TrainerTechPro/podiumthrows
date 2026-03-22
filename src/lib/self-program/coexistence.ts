// ── Coach/Self Program Coexistence ────────────────────────────────────
// When an athlete has both a coach-prescribed program and a self-generated
// program, sessions from both can appear on the same day. This module
// handles merging and priority rules.

// ── Types ─────────────────────────────────────────────────────────────

export interface SessionInput {
  id: string;
  scheduledDate: string | null; // YYYY-MM-DD
  sessionType: string; // THROWS_ONLY | THROWS_LIFT | LIFT_ONLY | COMPETITION_SIM | RECOVERY
  dayOfWeek: number;
  totalThrowsTarget: number;
  status: string;
}

export interface MergedSession {
  session: SessionInput;
  source: "COACH_PRESCRIBED" | "ATHLETE_SELF_GENERATED";
  isPrimary: boolean;
  hidden: boolean; // true when coach's throwing blocks override self-program throws
}

export interface WeeklyVolume {
  coachThrows: number;
  selfThrows: number;
  totalThrows: number;
  warning: string | null; // e.g., "Combined volume (120) exceeds weekly target (100)"
}

export interface MergeResult {
  sessions: MergedSession[];
  volume: WeeklyVolume;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Session types that involve throwing. */
const THROWING_SESSION_TYPES = new Set([
  "THROWS_ONLY",
  "THROWS_LIFT",
  "COMPETITION_SIM",
]);

function hasThrows(sessionType: string): boolean {
  return THROWING_SESSION_TYPES.has(sessionType);
}

/**
 * Group sessions by their scheduledDate.
 * Sessions with null dates are grouped under the key "__unscheduled__".
 */
function groupByDate<T extends { scheduledDate: string | null }>(
  sessions: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const session of sessions) {
    const key = session.scheduledDate ?? "__unscheduled__";
    const group = map.get(key);
    if (group) {
      group.push(session);
    } else {
      map.set(key, [session]);
    }
  }
  return map;
}

// ── Main ──────────────────────────────────────────────────────────────

/**
 * Merge coach-prescribed and self-generated sessions for display.
 *
 * Priority rules:
 * - Coach sessions are always primary
 * - If both have throwing sessions on the same day, coach's throwing wins,
 *   self's throwing blocks are hidden
 * - If both have lifting on the same day, both shown (volume flagged)
 * - Self-program sessions that don't conflict are shown normally
 * - RECOVERY sessions are never hidden
 */
export function mergeSessions(
  coachSessions: SessionInput[],
  selfSessions: SessionInput[],
  weeklyThrowsTarget: number,
): MergeResult {
  const merged: MergedSession[] = [];

  // Build a set of dates where the coach has throwing sessions
  const coachByDate = groupByDate(coachSessions);
  const coachThrowsDates = new Set<string>();

  for (const [date, sessions] of coachByDate) {
    if (date === "__unscheduled__") continue;
    if (sessions.some((s) => hasThrows(s.sessionType))) {
      coachThrowsDates.add(date);
    }
  }

  // Add all coach sessions as primary, never hidden
  for (const session of coachSessions) {
    merged.push({
      session,
      source: "COACH_PRESCRIBED",
      isPrimary: true,
      hidden: false,
    });
  }

  // Add self sessions with conflict detection
  for (const session of selfSessions) {
    const date = session.scheduledDate;
    const selfHasThrows = hasThrows(session.sessionType);

    // A self-program throwing session is hidden when:
    // 1. It has a scheduled date
    // 2. The coach also has a throwing session on that date
    // 3. The self session involves throws (not LIFT_ONLY or RECOVERY)
    const shouldHide =
      date !== null &&
      selfHasThrows &&
      coachThrowsDates.has(date);

    merged.push({
      session,
      source: "ATHLETE_SELF_GENERATED",
      isPrimary: !shouldHide,
      hidden: shouldHide,
    });
  }

  // Calculate volume from non-hidden sessions only
  const coachThrows = merged
    .filter((m) => m.source === "COACH_PRESCRIBED" && !m.hidden)
    .reduce((sum, m) => sum + m.session.totalThrowsTarget, 0);

  const selfThrows = merged
    .filter((m) => m.source === "ATHLETE_SELF_GENERATED" && !m.hidden)
    .reduce((sum, m) => sum + m.session.totalThrowsTarget, 0);

  const totalThrows = coachThrows + selfThrows;

  const warning =
    totalThrows > weeklyThrowsTarget
      ? `Combined volume (${totalThrows}) exceeds weekly target (${weeklyThrowsTarget})`
      : null;

  return {
    sessions: merged,
    volume: {
      coachThrows,
      selfThrows,
      totalThrows,
      warning,
    },
  };
}
