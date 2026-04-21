import { revalidateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { emitSessionComplete } from "@/lib/team-activity";
import { updateStreakForCompletion } from "@/lib/athlete/streak";
import type { ActivitySource } from "@/lib/data/athlete-activity";

export type TerminalStatus = "completed" | "partial" | "skipped";

export interface OnSessionCompleteParams {
  athleteId: string;
  /** Null for orphan athletes (no coach assigned) — notifications + coach cache are skipped. */
  coachId: string | null;
  source: ActivitySource;
  sourceId: string;
  terminalStatus: TerminalStatus;
  completedAt: Date;
  sessionTitle: string;
  athleteName: string;
  /** ThrowsSession.tags JSON; only used when source === "assigned-throws" to detect selfProgram linkage. */
  sessionTags?: string | null;
  metrics: {
    throwCount: number;
    bestMarkM: number | null;
    rpe: number | null;
    selfFeeling: string | null;
  };
  skipReason?: string | null;
}

/**
 * Single place that runs cross-cutting side effects when any athlete session
 * reaches a terminal state. Called from all three completion paths:
 *
 *   - PUT   /api/throws/assignments/[id]     (assigned-throws)
 *   - PATCH /api/athlete/sessions/[id]/end   (assigned-training)
 *   - POST  /api/athlete/log-session         (self-logged)
 *
 * Owns: streak increment, coach notification, team feed emit, self-program
 * sync, cache invalidation. Each side effect is isolated so one failure
 * doesn't block the others.
 *
 * Idempotency: callers must guard on the source-table status before calling.
 * This handler trusts the caller to fire once per terminal transition.
 */
export async function onSessionComplete(params: OnSessionCompleteParams): Promise<void> {
  const {
    athleteId,
    coachId,
    source,
    sourceId,
    terminalStatus,
    completedAt,
    sessionTitle,
    athleteName,
    sessionTags,
    metrics,
    skipReason,
  } = params;

  if (terminalStatus !== "skipped") {
    await updateStreakForCompletion(athleteId, completedAt);
  }

  if (coachId) {
    const notifPromise =
      terminalStatus === "skipped"
        ? createNotification({
            type: "WORKOUT_SKIPPED",
            coachId,
            athleteProfileId: athleteId,
            title: `${athleteName} skipped ${sessionTitle}`,
            body: skipReason ? `Reason: ${skipReason}` : "No reason provided",
            metadata: { source, sourceId, skipReason },
          })
        : createNotification({
            type: "WORKOUT_COMPLETED",
            coachId,
            athleteProfileId: athleteId,
            title: `${athleteName} completed ${sessionTitle}`,
            body: buildCompletionBody(metrics, terminalStatus),
            metadata: {
              source,
              sourceId,
              terminalStatus,
              bestMark: metrics.bestMarkM,
              rpe: metrics.rpe,
              selfFeeling: metrics.selfFeeling,
              totalThrows: metrics.throwCount,
              url: `/coach/athletes`,
            },
          });

    void notifPromise.catch((err) =>
      logger.error("Coach notification failed", {
        context: "onSessionComplete",
        userId: athleteId,
        metadata: { source, sourceId, terminalStatus },
        error: err,
      })
    );
  }

  if (terminalStatus !== "skipped") {
    void emitSessionComplete(athleteId, {
      throwCount: metrics.throwCount,
      bestDistance: metrics.bestMarkM,
      sessionId: sourceId,
    }).catch((err) =>
      logger.error("Team feed emit failed", {
        context: "onSessionComplete",
        userId: athleteId,
        metadata: { source, sourceId },
        error: err,
      })
    );
  }

  if (source === "assigned-throws" && terminalStatus !== "skipped" && sessionTags) {
    await syncSelfProgram(sessionTags, {
      completedAt,
      actualThrows: metrics.throwCount,
      bestMark: metrics.bestMarkM,
      rpe: metrics.rpe,
      selfFeeling: metrics.selfFeeling,
    }).catch((err) =>
      logger.error("Self-program sync failed", {
        context: "onSessionComplete",
        userId: athleteId,
        metadata: { source, sourceId },
        error: err,
      })
    );
  }

  revalidateTag(`athlete-${athleteId}`);
  if (coachId) revalidateTag(`coach-${coachId}`);
}

function buildCompletionBody(
  metrics: OnSessionCompleteParams["metrics"],
  terminalStatus: TerminalStatus
): string {
  const partialPrefix = terminalStatus === "partial" ? "[Partial] " : "";
  const rpeStr = metrics.rpe != null ? `${metrics.rpe}/10` : "—";
  const bestStr =
    metrics.bestMarkM != null && metrics.bestMarkM > 0 ? `${metrics.bestMarkM.toFixed(2)}m` : "—";
  return `${partialPrefix}RPE: ${rpeStr} | Best: ${bestStr} | ${metrics.throwCount} throws`;
}

async function syncSelfProgram(
  tagsJson: string,
  update: {
    completedAt: Date;
    actualThrows: number;
    bestMark: number | null;
    rpe: number | null;
    selfFeeling: string | null;
  }
): Promise<void> {
  let tags: unknown;
  try {
    tags = JSON.parse(tagsJson);
  } catch {
    return;
  }
  if (!Array.isArray(tags)) return;

  const tag = tags.find((t): t is string => typeof t === "string" && t.startsWith("selfProgram:"));
  if (!tag) return;

  const programSessionId = tag.replace("selfProgram:", "");

  await prisma.programSession.update({
    where: { id: programSessionId },
    data: {
      status: "COMPLETED",
      completedAt: update.completedAt,
      actualThrows: update.actualThrows,
      ...(update.bestMark != null && update.bestMark > 0 && { bestMark: update.bestMark }),
      ...(update.rpe != null && { rpe: update.rpe }),
      ...(update.selfFeeling && { selfFeeling: update.selfFeeling }),
    },
  });
}
