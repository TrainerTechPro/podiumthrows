import prisma from "@/lib/prisma";

export const TARGET_FIELDS = [
  "throwLogId",
  "practiceAttemptId",
  "trainingSessionId",
  "throwsAssignmentId",
  "athleteDrillLogId",
  "videoAnalysisId",
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number];

export function isTargetField(value: unknown): value is TargetField {
  return typeof value === "string" && (TARGET_FIELDS as readonly string[]).includes(value);
}

/**
 * Ownership check for a given user + role against a polymorphic comment target.
 * Coaches have access when they own the athlete whose data the target belongs to.
 * Athletes have access only to their own targets.
 */
export async function verifyCommentAccess(
  userId: string,
  role: string,
  targetField: TargetField,
  targetId: string
): Promise<boolean> {
  if (role === "COACH") {
    const coach = await prisma.coachProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!coach) return false;

    switch (targetField) {
      case "throwLogId": {
        const tl = await prisma.throwLog.findUnique({
          where: { id: targetId },
          select: { athlete: { select: { coachId: true } } },
        });
        return tl?.athlete.coachId === coach.id;
      }
      case "practiceAttemptId": {
        const pa = await prisma.practiceAttempt.findUnique({
          where: { id: targetId },
          select: { session: { select: { coachId: true } } },
        });
        return pa?.session.coachId === coach.id;
      }
      case "trainingSessionId": {
        const ts = await prisma.trainingSession.findUnique({
          where: { id: targetId },
          select: { athlete: { select: { coachId: true } } },
        });
        return ts?.athlete.coachId === coach.id;
      }
      case "throwsAssignmentId": {
        const ta = await prisma.throwsAssignment.findUnique({
          where: { id: targetId },
          select: { session: { select: { coachId: true } } },
        });
        return ta?.session.coachId === coach.id;
      }
      case "athleteDrillLogId": {
        const dl = await prisma.athleteDrillLog.findUnique({
          where: { id: targetId },
          select: { session: { select: { athlete: { select: { coachId: true } } } } },
        });
        return dl?.session.athlete.coachId === coach.id;
      }
      case "videoAnalysisId": {
        const va = await prisma.videoAnalysis.findUnique({
          where: { id: targetId },
          select: { coachId: true },
        });
        return va?.coachId === coach.id;
      }
    }
  }

  if (role === "ATHLETE") {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!athlete) return false;

    switch (targetField) {
      case "throwLogId": {
        const tl = await prisma.throwLog.findUnique({
          where: { id: targetId },
          select: { athleteId: true },
        });
        return tl?.athleteId === athlete.id;
      }
      case "practiceAttemptId": {
        const pa = await prisma.practiceAttempt.findUnique({
          where: { id: targetId },
          select: { athleteId: true },
        });
        return pa?.athleteId === athlete.id;
      }
      case "trainingSessionId": {
        const ts = await prisma.trainingSession.findUnique({
          where: { id: targetId },
          select: { athleteId: true },
        });
        return ts?.athleteId === athlete.id;
      }
      case "throwsAssignmentId": {
        const ta = await prisma.throwsAssignment.findUnique({
          where: { id: targetId },
          select: { athleteId: true },
        });
        return ta?.athleteId === athlete.id;
      }
      case "athleteDrillLogId": {
        const dl = await prisma.athleteDrillLog.findUnique({
          where: { id: targetId },
          select: { session: { select: { athleteId: true } } },
        });
        return dl?.session.athleteId === athlete.id;
      }
      case "videoAnalysisId": {
        const va = await prisma.videoAnalysis.findUnique({
          where: { id: targetId },
          select: { athleteId: true },
        });
        return va?.athleteId === athlete.id;
      }
    }
  }

  return false;
}

type CommentTargetFields = {
  throwLogId: string | null;
  practiceAttemptId: string | null;
  trainingSessionId: string | null;
  throwsAssignmentId: string | null;
  athleteDrillLogId: string | null;
  videoAnalysisId: string | null;
};

/** Returns the single (field, id) pair that is non-null on a comment row. */
export function commentTargetPair(
  c: CommentTargetFields
): { field: TargetField; id: string } | null {
  for (const f of TARGET_FIELDS) {
    const v = c[f];
    if (v) return { field: f, id: v };
  }
  return null;
}
