import { logger } from "@/lib/logger";
import type { ActivitySource } from "@/lib/data/athlete-activity";

export type TerminalStatus = "completed" | "partial" | "skipped";

export interface OnSessionCompleteParams {
  athleteId: string;
  /** Who owns the coach notification + team feed routing. Null for orphan athletes. */
  coachId: string | null;
  source: ActivitySource;
  sourceId: string;
  terminalStatus: TerminalStatus;
  completedAt: Date;
  metrics: {
    throwCount: number;
    bestMarkM: number | null;
    rpe: number | null;
    selfFeeling: string | null;
  };
}

/**
 * The single place that runs cross-cutting side effects when any athlete
 * session reaches a terminal state. Called from all three completion paths:
 *
 *   - PUT  /api/throws/assignments/[id]      (assigned-throws)
 *   - PATCH /api/athlete/sessions/[id]/end   (assigned-training, via the escape hatch)
 *   - POST /api/athlete/log-session          (self-logged)
 *
 * Phase 1 is the stub — real side effects wire in Phase 2. See
 * tasks/unified-session-layer.md §Phase 2 for the migration order.
 *
 * Idempotency: callers must guard on completedAt before calling. This handler
 * does not re-check — it trusts the caller to fire once per terminal transition.
 */
export async function onSessionComplete(params: OnSessionCompleteParams): Promise<void> {
  logger.info("session.complete.stub", {
    context: "onSessionComplete",
    userId: params.athleteId,
    metadata: {
      source: params.source,
      sourceId: params.sourceId,
      terminalStatus: params.terminalStatus,
      coachId: params.coachId,
      metrics: params.metrics,
      completedAt: params.completedAt.toISOString(),
    },
  });

  // Phase 2 wiring order (each is its own migration):
  //   1. streak increment (if !skipped) → @/lib/athlete/streak
  //   2. coach notification dispatch    → @/lib/notifications
  //   3. team feed emit                 → @/lib/team-activity
  //   4. self-program sync              → only for "assigned-throws" w/ selfProgram tag
  //   5. cache invalidation             → revalidateTag("athlete-${athleteId}")
}
