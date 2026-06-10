"use client";

import { useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import {
  MetricsOutputSchema,
  SmoothedPoseSchema,
  normalizeStoredFaults,
  type ConfidenceGrade,
  type MetricsOutput,
  type SmoothedPose,
  type StoredNarrative,
} from "@/lib/contracts";
import { OverlayPlayer } from "./OverlayPlayer";
import { JobStatusCard } from "./JobStatusCard";

/**
 * Results surface for one analysis job (coach desktop register). Polls while
 * the job is in flight; renders overlay + phase scores + fault cards + the
 * coach's summary once COMPLETE. Every number on screen comes from
 * analysis_results — this component formats, it never computes.
 */

interface JobPayload {
  id: string;
  status: string;
  event: string;
  error?: { message?: string } | null;
  result?: {
    metrics: unknown;
    phaseScores: unknown;
    faults: unknown;
    narrative: unknown;
  } | null;
}

const POLL_MS = 4000;
const IN_FLIGHT = new Set(["QUEUED", "PROCESSING", "POSE_COMPLETE", "METRICS_COMPLETE"]);

const GRADE_CLASSES: Record<ConfidenceGrade, string> = {
  HIGH: "bg-status-success-bg text-status-success-fg",
  MEDIUM: "bg-status-warning-bg text-status-warning-fg",
  LOW: "bg-status-danger-bg text-status-danger-fg",
};

function ConfidenceChip({ grade }: { grade: ConfidenceGrade }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-mono text-nano uppercase tracking-wider ${GRADE_CLASSES[grade]}`}
      data-testid="confidence-chip"
    >
      {grade}
    </span>
  );
}

const CALIBRATED_ONLY_METRICS: Array<{ key: string; label: string }> = [
  { key: "release_velocity", label: "Release velocity" },
  { key: "release_height", label: "Release height" },
  { key: "com_displacement", label: "COM displacement" },
];

export function AnalysisResultView({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobPayload | null>(null);
  const [pose, setPose] = useState<SmoothedPose | null>(null);
  const [urls, setUrls] = useState<{ clipUrl: string | null; reportPdfUrl: string | null }>({
    clipUrl: null,
    reportPdfUrl: null,
  });
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/analysis/jobs/${jobId}`);
        const payload = await res.json();
        if (!res.ok || !payload.success) {
          setLoadError(payload.error || `Request failed (${res.status})`);
          return;
        }
        if (cancelled) return;
        setJob(payload.data);
        if (IN_FLIGHT.has(payload.data.status)) {
          timer = window.setTimeout(load, POLL_MS);
        } else if (payload.data.status === "COMPLETE") {
          const artRes = await fetch(`/api/analysis/jobs/${jobId}/artifacts`);
          const art = await artRes.json();
          if (artRes.ok && art.success && !cancelled) {
            setUrls({ clipUrl: art.data.clipUrl, reportPdfUrl: art.data.reportPdfUrl });
            if (art.data.smoothedPoseUrl) {
              const poseRes = await fetch(art.data.smoothedPoseUrl);
              if (poseRes.ok) {
                const parsed = SmoothedPoseSchema.safeParse(await poseRes.json());
                if (parsed.success && !cancelled) setPose(parsed.data);
              }
            }
          }
        }
      } catch {
        setLoadError("Network error — refresh to retry");
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [jobId]);

  if (loadError) {
    return <p className="text-body text-status-danger-fg">{loadError}</p>;
  }
  if (!job) {
    return <div className="card h-32 shimmer" aria-hidden="true" />;
  }

  if (job.status !== "COMPLETE") {
    return <JobStatusCard status={job.status} error={job.error?.message} />;
  }

  const metricsParse = MetricsOutputSchema.safeParse(job.result?.metrics);
  const metrics: MetricsOutput | null = metricsParse.success ? metricsParse.data : null;
  const { fired: faults, notAssessed } = normalizeStoredFaults(job.result?.faults);
  const narrative = job.result?.narrative as StoredNarrative | undefined;
  const phaseScores = (job.result?.phaseScores ?? []) as Array<{
    phase: string;
    score: number | null;
    items: Array<{
      label: string;
      value: { value: number | null; unit: string; frameRefs: number[]; confidenceGrade?: ConfidenceGrade };
    }>;
  }>;
  const clipGrade = metrics?.clipConfidence?.grade;

  return (
    <div className="space-y-4" data-testid="analysis-result">
      {pose && metrics && (
        <OverlayPlayer pose={pose} phaseBoundaries={metrics.phaseBoundaries} videoUrl={urls.clipUrl} />
      )}

      {metrics && (clipGrade || !metrics.calibrated) && (
        <div className="flex flex-wrap items-center gap-2" data-testid="clip-confidence">
          {clipGrade && (
            <>
              <span className="text-sm font-semibold uppercase tracking-wider text-muted">
                Clip confidence
              </span>
              <ConfidenceChip grade={clipGrade} />
            </>
          )}
          {!metrics.calibrated && (
            <p className="text-caption text-muted">
              Quick analysis — angles and timing are measured; view-sensitive
              angles cap at MEDIUM confidence. Velocity and distances require a
              calibrated session (Elite).
            </p>
          )}
        </div>
      )}

      <section className="card p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Phase scores</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {phaseScores.map((p) => (
            <div key={p.phase}>
              <p className="font-heading text-section tabular-nums">
                {p.score === null ? "—" : `${p.score}/10`}
              </p>
              <p className="text-caption text-muted">{p.phase.replace(/_/g, " ")}</p>
              <ul className="mt-1 space-y-0.5">
                {p.items.map((item) => (
                  <li key={item.label} className="text-caption text-muted">
                    {item.label}:{" "}
                    {item.value.value === null ? (
                      <span>
                        {metrics?.calibrated ? "not measurable" : "requires calibrated session"}
                      </span>
                    ) : (
                      <>
                        <span className="font-mono tabular-nums">
                          {item.value.value}
                          {item.value.unit === "deg" ? "°" : ` ${item.value.unit}`}
                        </span>{" "}
                        {item.value.confidenceGrade && (
                          <ConfidenceChip grade={item.value.confidenceGrade} />
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {metrics && (
        <section className="card p-4" data-testid="calibrated-metrics">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Release &amp; distance
          </h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {CALIBRATED_ONLY_METRICS.map(({ key, label }) => {
              const m = metrics.metrics[key];
              return (
                <div key={key}>
                  {m?.value != null ? (
                    <p className="font-heading text-section tabular-nums">
                      {m.value}
                      {m.unit === "deg" ? "°" : ` ${m.unit}`}{" "}
                      {m.confidenceGrade && <ConfidenceChip grade={m.confidenceGrade} />}
                    </p>
                  ) : (
                    <p className="text-body text-muted">
                      {metrics.calibrated ? "Not measurable" : "Requires calibrated session"}
                    </p>
                  )}
                  <p className="text-caption text-muted">{label}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Faults — measured, with evidence
        </h3>
        {faults.length === 0 && (
          <p className="text-body text-muted">
            No rule thresholds were crossed on this throw&apos;s
            {notAssessed.length > 0 ? " assessable" : ""} measured values.
          </p>
        )}
        {faults.map((f) => (
          <div key={f.ruleId} className="card p-4" data-testid="fault-card">
            <div className="flex items-baseline justify-between">
              <p className="font-semibold">{f.faultName}</p>
              <span className="font-mono text-micro uppercase text-muted">{f.severity}</span>
            </div>
            <p className="font-mono text-body tabular-nums">
              {f.measuredValue}
              {f.unit === "deg" ? "°" : ` ${f.unit}`} (target {f.targetRange[0]}–{f.targetRange[1]}
              {f.unit === "deg" ? "°" : ` ${f.unit}`})
            </p>
            <p className="text-caption text-muted">
              Evidence frame{f.evidenceFrames.length === 1 ? "" : "s"}: {f.evidenceFrames.join(", ")}
            </p>
          </div>
        ))}
        {notAssessed.map((f) => (
          <div key={f.ruleId} className="card p-4 opacity-80" data-testid="not-assessed-card">
            <div className="flex items-baseline justify-between">
              <p className="font-semibold text-muted">{f.faultName}</p>
              <span className="font-mono text-micro uppercase text-muted">not assessed</span>
            </div>
            <p className="text-caption text-muted">
              Keypoint confidence on this metric was too low to judge honestly —
              worth checking on better footage.
            </p>
          </div>
        ))}
      </section>

      {narrative && (
        <section className="card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Coach&apos;s summary
          </h3>
          <p className="mt-1 text-body">{narrative.output.coachSummary}</p>
          {narrative.source === "template_fallback" && (
            <p className="mt-2 text-micro text-muted">
              Generated from measured values (template).
            </p>
          )}
        </section>
      )}

      {urls.reportPdfUrl && (
        <a
          href={urls.reportPdfUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary inline-flex items-center gap-1"
        >
          <FileDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Download PDF report
        </a>
      )}
    </div>
  );
}
