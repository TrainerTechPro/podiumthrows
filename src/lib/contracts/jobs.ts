import { z } from "zod";

/**
 * analysis_jobs state machine (PRD F3 / build-plan §2).
 * Values mirror the Prisma AnalysisJobStatus enum exactly.
 */

export const JOB_STATUSES = [
  "QUEUED",
  "PROCESSING",
  "POSE_COMPLETE",
  "METRICS_COMPLETE",
  "COMPLETE",
  "FAILED",
  "LOW_CONFIDENCE",
] as const;

export const JobStatusSchema = z.enum(JOB_STATUSES);
export type JobStatus = z.infer<typeof JobStatusSchema>;

/**
 * PROCESSING → QUEUED is the stale-job requeue path (cron, D4).
 * FAILED → QUEUED is manual retry. COMPLETE / LOW_CONFIDENCE are terminal.
 */
export const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  QUEUED: ["PROCESSING", "FAILED"],
  PROCESSING: ["POSE_COMPLETE", "FAILED", "QUEUED"],
  POSE_COMPLETE: ["METRICS_COMPLETE", "LOW_CONFIDENCE", "FAILED"],
  METRICS_COMPLETE: ["COMPLETE", "FAILED"],
  COMPLETE: [],
  FAILED: ["QUEUED"],
  LOW_CONFIDENCE: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

export const TERMINAL_STATUSES: readonly JobStatus[] = JOB_STATUSES.filter(
  (s) => JOB_TRANSITIONS[s].length === 0
);
