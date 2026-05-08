import "server-only";
import prisma from "@/lib/prisma";
import {
  deriveCoachSessionDetail,
  type LoadedSessionForCoach,
  type CoachSessionDetailDTO,
} from "./session-detail";
import { safeMovementRestrictions } from "@/app/(dashboard)/athlete/profile/_types";

/**
 * Loads a session for the coach Session Detail screen and returns the derived
 * DTO. Verifies the coach actually owns this athlete before returning data.
 */
export async function loadCoachSessionDetail(args: {
  sessionId: string;
  athleteProfileId: string;
  coachProfileId: string;
}): Promise<CoachSessionDetailDTO | null> {
  const { sessionId, athleteProfileId, coachProfileId } = args;

  const trainingSession = await prisma.trainingSession.findFirst({
    where: {
      id: sessionId,
      athleteId: athleteProfileId,
      athlete: { coachId: coachProfileId },
    },
    select: {
      id: true,
      scheduledDate: true,
      status: true,
      coachNotes: true,
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          events: true,
          classStanding: true,
          avatarUrl: true,
          movementRestrictions: true,
        },
      },
      plan: {
        select: {
          id: true,
          name: true,
          phase: true,
          blocks: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              order: true,
              name: true,
              blockType: true,
              notes: true,
              restSeconds: true,
              exercises: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  order: true,
                  sets: true,
                  reps: true,
                  weight: true,
                  rpe: true,
                  notes: true,
                  implementKg: true,
                  exercise: {
                    select: {
                      id: true,
                      name: true,
                      category: true,
                      event: true,
                      correlationData: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      throwLogs: {
        select: { implementWeight: true, distance: true, rpe: true },
      },
    },
  });

  if (!trainingSession) return null;

  // Ancillary lookups: latest PR for this athlete (just the max distance),
  // delta vs the previous session (any throw), latest readiness, latest coach
  // note. All best-effort — null when not available.
  const [topPr, prevSessionTopThrow, latestReadiness, latestCoachNote] = await Promise.all([
    // Catalog-keyed top distance across all implements.
    prisma.athleteImplementPR
      .findFirst({
        where: { athleteId: athleteProfileId, bestDistance: { not: null } },
        orderBy: { bestDistance: "desc" },
        select: { bestDistance: true },
      })
      .then((row) => (row ? { distance: row.bestDistance! } : null)),
    prisma.trainingSession.findFirst({
      where: {
        athleteId: athleteProfileId,
        scheduledDate: { lt: trainingSession.scheduledDate },
        throwLogs: { some: { distance: { not: null } } },
      },
      orderBy: { scheduledDate: "desc" },
      select: {
        throwLogs: {
          where: { distance: { not: null } },
          orderBy: { distance: "desc" },
          take: 1,
          select: { distance: true },
        },
      },
    }),
    prisma.readinessCheckIn.findFirst({
      where: { athleteId: athleteProfileId },
      orderBy: { date: "desc" },
      select: { overallScore: true },
    }),
    prisma.coachNote.findFirst({
      where: { athleteProfileId },
      orderBy: { createdAt: "desc" },
      select: {
        content: true,
        createdAt: true,
        coach: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const currentTopDistance = trainingSession.throwLogs.reduce<number | null>(
    (max, t) => (t.distance != null ? Math.max(max ?? 0, t.distance) : max),
    null
  );
  const prevTopDistance = prevSessionTopThrow?.throwLogs[0]?.distance ?? null;
  const vsLastDelta =
    currentTopDistance != null && prevTopDistance != null
      ? currentTopDistance - prevTopDistance
      : null;

  // Map the 1-10 overallScore down to a 1-5 bucket the strip displays.
  const readinessScore = latestReadiness
    ? Math.max(1, Math.min(5, Math.round(latestReadiness.overallScore / 2)))
    : null;

  const loaded: LoadedSessionForCoach = {
    id: trainingSession.id,
    scheduledDate: trainingSession.scheduledDate,
    status: trainingSession.status,
    coachNotes: trainingSession.coachNotes,
    athlete: {
      id: trainingSession.athlete.id,
      firstName: trainingSession.athlete.firstName,
      lastName: trainingSession.athlete.lastName,
      events: trainingSession.athlete.events,
      classYear: trainingSession.athlete.classStanding,
      yearsTraining: null,
      avatarUrl: trainingSession.athlete.avatarUrl,
      movementRestrictions: safeMovementRestrictions(trainingSession.athlete.movementRestrictions),
    },
    plan: trainingSession.plan
      ? {
          id: trainingSession.plan.id,
          name: trainingSession.plan.name,
          phase: trainingSession.plan.phase,
          blocks: trainingSession.plan.blocks.map((b) => ({
            id: b.id,
            order: b.order,
            name: b.name,
            blockType: b.blockType,
            notes: b.notes,
            restSeconds: b.restSeconds,
            exercises: b.exercises.map((e) => ({
              id: e.id,
              order: e.order,
              sets: e.sets,
              reps: e.reps,
              weight: e.weight,
              rpe: e.rpe,
              notes: e.notes,
              implementKg: e.implementKg,
              exercise: e.exercise,
            })),
          })),
        }
      : null,
    throwLogs: trainingSession.throwLogs.map((t) => ({
      implementWeight: t.implementWeight,
      distance: t.distance,
      rpe: t.rpe,
    })),
    prDistance: topPr?.distance ?? null,
    vsLastDelta,
    readinessScore,
    lastCoachNote: latestCoachNote
      ? {
          content: latestCoachNote.content,
          createdAt: latestCoachNote.createdAt,
          coachLabel: `Coach ${latestCoachNote.coach.lastName}`,
        }
      : null,
  };

  return deriveCoachSessionDetail(loaded);
}
