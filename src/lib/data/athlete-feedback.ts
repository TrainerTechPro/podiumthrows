/**
 * Athlete Feedback — server-side data helper.
 *
 * Fetches the chronological list of COACH-authored ThrowComments
 * targeting a given athlete's work across all four polymorphic
 * target types. Returns a flat, UI-ready list with author info,
 * target previews, ack state, and audio URLs.
 */

import prisma from "@/lib/prisma";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type FeedbackTargetKind = "throw" | "session" | "practice_attempt" | "assignment";

export type FeedbackTargetPreview = {
  kind: FeedbackTargetKind;
  id: string;
  label: string;
  href: string;
};

export type AthleteFeedbackItem = {
  id: string;
  coachName: string;
  coachAvatar: string | null;
  body: string;
  audioUrl: string | null;
  audioDurationSec: number | null;
  createdAt: string;
  readAt: string | null;
  reaction: "THUMBS_UP" | "THUMBS_DOWN" | null;
  replyText: string | null;
  target: FeedbackTargetPreview;
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSessionLabel(scheduledDate: Date): string {
  return `Session · ${scheduledDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

/* ─── Main fetcher ───────────────────────────────────────────────────────── */

export async function fetchAthleteFeedback(
  athleteId: string,
  limit = 100
): Promise<AthleteFeedbackItem[]> {
  // 1. Gather the IDs of all targets this athlete owns so we can filter
  //    ThrowComment in a single query. Parallel fetches to keep latency low.
  const [throwLogs, sessions, attempts, assignments] = await Promise.all([
    prisma.throwLog.findMany({
      where: { athleteId },
      select: { id: true, event: true, distance: true, date: true },
    }),
    prisma.trainingSession.findMany({
      where: { athleteId },
      select: { id: true, scheduledDate: true },
    }),
    prisma.practiceAttempt.findMany({
      where: { athleteId },
      select: { id: true, sessionId: true },
    }),
    prisma.throwsAssignment.findMany({
      where: { athleteId },
      select: { id: true },
    }),
  ]);

  const throwLogMap = new Map(throwLogs.map((t) => [t.id, t]));
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const attemptMap = new Map(attempts.map((a) => [a.id, a]));
  const assignmentSet = new Set(assignments.map((a) => a.id));

  if (
    throwLogMap.size === 0 &&
    sessionMap.size === 0 &&
    attemptMap.size === 0 &&
    assignmentSet.size === 0
  ) {
    return [];
  }

  // 2. Fetch coach-authored comments targeting any of these IDs
  const comments = await prisma.throwComment.findMany({
    where: {
      authorRole: "COACH",
      OR: [
        { throwLogId: { in: Array.from(throwLogMap.keys()) } },
        { trainingSessionId: { in: Array.from(sessionMap.keys()) } },
        { practiceAttemptId: { in: Array.from(attemptMap.keys()) } },
        { throwsAssignmentId: { in: Array.from(assignmentSet) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      authorId: true,
      body: true,
      audioUrl: true,
      audioDurationSec: true,
      createdAt: true,
      readAt: true,
      reaction: true,
      replyText: true,
      throwLogId: true,
      trainingSessionId: true,
      practiceAttemptId: true,
      throwsAssignmentId: true,
    },
  });

  // 3. Enrich with coach name/avatar
  const coachUserIds = [...new Set(comments.map((c) => c.authorId))];
  const coachUsers = await prisma.user.findMany({
    where: { id: { in: coachUserIds } },
    select: {
      id: true,
      email: true,
      coachProfile: {
        select: { firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });
  const coachMap = new Map(
    coachUsers.map((u) => [
      u.id,
      {
        name: u.coachProfile ? `${u.coachProfile.firstName} ${u.coachProfile.lastName}` : u.email,
        avatar: u.coachProfile?.avatarUrl ?? null,
      },
    ])
  );

  // 4. Build target previews
  function buildTarget(c: (typeof comments)[number]): FeedbackTargetPreview {
    if (c.throwLogId) {
      const tl = throwLogMap.get(c.throwLogId);
      const dist = tl?.distance != null ? ` ${tl.distance.toFixed(2)}m` : "";
      return {
        kind: "throw",
        id: c.throwLogId,
        label: `${formatEventName(tl?.event ?? "THROW")}${dist}`,
        href: `/athlete/throws#${c.throwLogId}`,
      };
    }
    if (c.trainingSessionId) {
      const s = sessionMap.get(c.trainingSessionId);
      return {
        kind: "session",
        id: c.trainingSessionId,
        label: s ? formatSessionLabel(s.scheduledDate) : "Session",
        href: `/athlete/session/${c.trainingSessionId}`,
      };
    }
    if (c.practiceAttemptId) {
      const a = attemptMap.get(c.practiceAttemptId);
      return {
        kind: "practice_attempt",
        id: c.practiceAttemptId,
        label: "Practice attempt",
        href: a?.sessionId ? `/athlete/session/${a.sessionId}` : "/athlete/sessions",
      };
    }
    if (c.throwsAssignmentId) {
      return {
        kind: "assignment",
        id: c.throwsAssignmentId,
        label: "Throws assignment",
        href: `/athlete/throws/${c.throwsAssignmentId}`,
      };
    }
    return {
      kind: "throw",
      id: c.id,
      label: "Feedback",
      href: "/athlete/feedback",
    };
  }

  return comments.map((c) => {
    const coach = coachMap.get(c.authorId);
    return {
      id: c.id,
      coachName: coach?.name ?? "Your coach",
      coachAvatar: coach?.avatar ?? null,
      body: c.body,
      audioUrl: c.audioUrl,
      audioDurationSec: c.audioDurationSec,
      createdAt: c.createdAt.toISOString(),
      readAt: c.readAt?.toISOString() ?? null,
      reaction: (c.reaction as "THUMBS_UP" | "THUMBS_DOWN" | null) ?? null,
      replyText: c.replyText,
      target: buildTarget(c),
    };
  });
}
