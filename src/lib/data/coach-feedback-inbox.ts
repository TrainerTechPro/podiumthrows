/**
 * Coach Feedback Inbox — server-side data helper.
 *
 * For each athlete on a coach's roster, compute engagement stats about
 * the feedback THIS COACH has left them:
 *   - total coach-authored comments targeting the athlete
 *   - how many the athlete has READ (readAt IS NOT NULL)
 *   - how many the athlete has reacted to (thumbs up or down)
 *   - thumbs-down count (attention signal)
 *   - timestamp of the most recent coach feedback to the athlete
 *   - timestamp of the most recent athlete acknowledgment
 *
 * One raw SQL query per athlete would be O(N) round trips — instead we
 * gather all roster athlete IDs up front, collect their target IDs once
 * per target table, then do a single GROUP BY query through Prisma. A
 * bit more logic in JS, but one round-trip to Postgres.
 */

import prisma from "@/lib/prisma";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type CoachFeedbackInboxRow = {
  athleteId: string;
  athleteName: string;
  athleteAvatar: string | null;
  totalFeedback: number;
  unread: number;
  reacted: number;
  thumbsDown: number;
  lastFeedbackAt: string | null;
  lastAckAt: string | null;
};

export async function fetchCoachFeedbackInbox(
  coachId: string
): Promise<CoachFeedbackInboxRow[]> {
  // 1. Roster
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  });
  if (athletes.length === 0) return [];

  const athleteIds = athletes.map((a) => a.id);

  // 2. Gather target IDs per athlete across all four target tables
  const [throwLogs, sessions, attempts, assignments] = await Promise.all([
    prisma.throwLog.findMany({
      where: { athleteId: { in: athleteIds } },
      select: { id: true, athleteId: true },
    }),
    prisma.trainingSession.findMany({
      where: { athleteId: { in: athleteIds } },
      select: { id: true, athleteId: true },
    }),
    prisma.practiceAttempt.findMany({
      where: { athleteId: { in: athleteIds } },
      select: { id: true, athleteId: true },
    }),
    prisma.throwsAssignment.findMany({
      where: { athleteId: { in: athleteIds } },
      select: { id: true, athleteId: true },
    }),
  ]);

  // 3. Build target → athlete maps so we can bucket comments later
  const throwLogToAthlete = new Map(throwLogs.map((t) => [t.id, t.athleteId]));
  const sessionToAthlete = new Map(sessions.map((s) => [s.id, s.athleteId]));
  const attemptToAthlete = new Map(attempts.map((a) => [a.id, a.athleteId]));
  const assignmentToAthlete = new Map(
    assignments.map((a) => [a.id, a.athleteId])
  );

  // 4. Pull all coach-authored comments targeting any of these IDs
  const comments = await prisma.throwComment.findMany({
    where: {
      authorRole: "COACH",
      OR: [
        { throwLogId: { in: Array.from(throwLogToAthlete.keys()) } },
        { trainingSessionId: { in: Array.from(sessionToAthlete.keys()) } },
        { practiceAttemptId: { in: Array.from(attemptToAthlete.keys()) } },
        { throwsAssignmentId: { in: Array.from(assignmentToAthlete.keys()) } },
      ],
    },
    select: {
      throwLogId: true,
      trainingSessionId: true,
      practiceAttemptId: true,
      throwsAssignmentId: true,
      createdAt: true,
      readAt: true,
      reaction: true,
      replyText: true,
      updatedAt: true,
    },
  });

  // 5. Bucket by athlete
  type Bucket = {
    total: number;
    unread: number;
    reacted: number;
    thumbsDown: number;
    lastFeedbackAt: Date | null;
    lastAckAt: Date | null;
  };
  const buckets = new Map<string, Bucket>();
  for (const a of athletes) {
    buckets.set(a.id, {
      total: 0,
      unread: 0,
      reacted: 0,
      thumbsDown: 0,
      lastFeedbackAt: null,
      lastAckAt: null,
    });
  }

  for (const c of comments) {
    const athleteId =
      (c.throwLogId && throwLogToAthlete.get(c.throwLogId)) ||
      (c.trainingSessionId && sessionToAthlete.get(c.trainingSessionId)) ||
      (c.practiceAttemptId && attemptToAthlete.get(c.practiceAttemptId)) ||
      (c.throwsAssignmentId && assignmentToAthlete.get(c.throwsAssignmentId));
    if (!athleteId) continue;

    const b = buckets.get(athleteId);
    if (!b) continue;

    b.total += 1;
    if (c.readAt == null) b.unread += 1;
    if (c.reaction != null || c.replyText != null) b.reacted += 1;
    if (c.reaction === "THUMBS_DOWN") b.thumbsDown += 1;

    if (!b.lastFeedbackAt || c.createdAt > b.lastFeedbackAt) {
      b.lastFeedbackAt = c.createdAt;
    }
    // Ack timestamp = most recent updatedAt on an acknowledged row
    const isAcked =
      c.readAt != null || c.reaction != null || c.replyText != null;
    if (isAcked && (!b.lastAckAt || c.updatedAt > b.lastAckAt)) {
      b.lastAckAt = c.updatedAt;
    }
  }

  // 6. Build output rows, skipping athletes with zero feedback
  const rows: CoachFeedbackInboxRow[] = [];
  for (const a of athletes) {
    const b = buckets.get(a.id);
    if (!b || b.total === 0) continue;
    rows.push({
      athleteId: a.id,
      athleteName: `${a.firstName} ${a.lastName}`.trim(),
      athleteAvatar: a.avatarUrl,
      totalFeedback: b.total,
      unread: b.unread,
      reacted: b.reacted,
      thumbsDown: b.thumbsDown,
      lastFeedbackAt: b.lastFeedbackAt?.toISOString() ?? null,
      lastAckAt: b.lastAckAt?.toISOString() ?? null,
    });
  }

  // Sort: athletes with unread first (attention), then by most recent feedback
  rows.sort((a, b) => {
    if (a.unread !== b.unread) return b.unread - a.unread;
    const aTs = a.lastFeedbackAt ? new Date(a.lastFeedbackAt).getTime() : 0;
    const bTs = b.lastFeedbackAt ? new Date(b.lastFeedbackAt).getTime() : 0;
    return bTs - aTs;
  });

  return rows;
}
