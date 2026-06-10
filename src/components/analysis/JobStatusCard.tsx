"use client";

import { CheckCircle2, CircleAlert, Loader2, RefreshCcw } from "lucide-react";

/**
 * F2/F3 job status — coach register: quiet, factual, no celebration.
 * LOW_CONFIDENCE is the honest-refusal state: refilm beats fake numbers.
 */

const STATUS_META: Record<
  string,
  { label: string; tone: "progress" | "success" | "danger" | "warning"; detail: string }
> = {
  QUEUED: { label: "Queued", tone: "progress", detail: "Waiting for the pose service" },
  PROCESSING: { label: "Processing", tone: "progress", detail: "Tracking keypoints on the GPU" },
  POSE_COMPLETE: { label: "Measuring", tone: "progress", detail: "Computing angles, phases, faults" },
  METRICS_COMPLETE: { label: "Writing report", tone: "progress", detail: "Assembling the report and PDF" },
  COMPLETE: { label: "Complete", tone: "success", detail: "Results and PDF are ready" },
  FAILED: { label: "Failed", tone: "danger", detail: "Processing failed — retry or refilm" },
  LOW_CONFIDENCE: {
    label: "Refilm needed",
    tone: "warning",
    detail: "Keypoint quality too low to analyze honestly — refilm with the athlete fully in frame",
  },
};

export function JobStatusCard({ status, error }: { status: string; error?: string | null }) {
  const meta = STATUS_META[status] ?? STATUS_META.QUEUED;
  return (
    <div className="card flex items-start gap-3 p-4" data-testid="job-status-card" data-status={status}>
      {meta.tone === "progress" && (
        <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-primary-500" strokeWidth={1.75} aria-hidden="true" />
      )}
      {meta.tone === "success" && (
        <CheckCircle2 className="mt-0.5 h-5 w-5 text-status-success-fg" strokeWidth={1.75} aria-hidden="true" />
      )}
      {meta.tone === "danger" && (
        <RefreshCcw className="mt-0.5 h-5 w-5 text-status-danger-fg" strokeWidth={1.75} aria-hidden="true" />
      )}
      {meta.tone === "warning" && (
        <CircleAlert className="mt-0.5 h-5 w-5 text-status-warning-fg" strokeWidth={1.75} aria-hidden="true" />
      )}
      <div>
        <p className="font-semibold">{meta.label}</p>
        <p className="text-caption text-muted">{error || meta.detail}</p>
      </div>
    </div>
  );
}
