import "server-only";
import prisma from "@/lib/prisma";
import { deriveSessionDetail, type LoadedSession, type SessionDetailDTO } from "./session-detail";

/**
 * Loads a session for the athlete-side Session Detail screen and returns the
 * derived DTO. Returns null when the session doesn't exist or doesn't belong
 * to this athlete — the caller decides whether that's a 404 or a redirect.
 */
export async function loadAthleteSessionDetail(
  sessionId: string,
  athleteProfileId: string
): Promise<SessionDetailDTO | null> {
  const trainingSession = await prisma.trainingSession.findFirst({
    where: { id: sessionId, athleteId: athleteProfileId },
    select: {
      id: true,
      athleteId: true,
      scheduledDate: true,
      status: true,
      notes: true,
      plan: {
        select: {
          id: true,
          name: true,
          description: true,
          event: true,
          phase: true,
          blocks: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              order: true,
              name: true,
              blockType: true,
              notes: true,
              exercises: {
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  order: true,
                  sets: true,
                  reps: true,
                  weight: true,
                  distance: true,
                  notes: true,
                  implementKg: true,
                  exercise: {
                    select: {
                      id: true,
                      name: true,
                      category: true,
                      event: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      throwLogs: {
        orderBy: { date: "asc" },
        select: {
          id: true,
          event: true,
          implementWeight: true,
          distance: true,
          rpe: true,
          isPersonalBest: true,
          date: true,
          attemptNumber: true,
        },
      },
      logs: {
        select: {
          id: true,
          exerciseName: true,
          sets: true,
          completedAt: true,
        },
      },
    },
  });

  if (!trainingSession) return null;

  const loaded: LoadedSession = {
    id: trainingSession.id,
    athleteId: trainingSession.athleteId,
    scheduledDate: trainingSession.scheduledDate,
    status: trainingSession.status,
    notes: trainingSession.notes,
    plan: trainingSession.plan
      ? {
          id: trainingSession.plan.id,
          name: trainingSession.plan.name,
          description: trainingSession.plan.description,
          event: trainingSession.plan.event,
          phase: trainingSession.plan.phase,
          blocks: trainingSession.plan.blocks.map((b) => ({
            id: b.id,
            order: b.order,
            name: b.name,
            blockType: b.blockType,
            notes: b.notes,
            exercises: b.exercises.map((e) => ({
              id: e.id,
              order: e.order,
              sets: e.sets,
              reps: e.reps,
              weight: e.weight,
              distance: e.distance,
              notes: e.notes,
              implementKg: e.implementKg,
              exercise: {
                id: e.exercise.id,
                name: e.exercise.name,
                category: e.exercise.category,
                event: e.exercise.event,
              },
            })),
          })),
        }
      : null,
    throwLogs: trainingSession.throwLogs.map((t) => ({
      id: t.id,
      event: t.event,
      implementWeight: t.implementWeight,
      distance: t.distance,
      rpe: t.rpe,
      isPersonalBest: t.isPersonalBest,
      date: t.date,
      attemptNumber: t.attemptNumber,
    })),
    logs: trainingSession.logs.map((l) => ({
      id: l.id,
      exerciseName: l.exerciseName,
      sets: l.sets,
      completedAt: l.completedAt,
    })),
  };

  return deriveSessionDetail(loaded);
}
