"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface PhaseScore {
  name: string;
  score: number;
  notes: string;
}

interface EnergyLeak {
  description: string;
  percentImpact: number;
  frameIndex: number;
}

interface ReleaseMetrics {
  angle: number | null;
  velocityRating: string;
  height: string;
  theoreticalDistance: number | null;
}

interface IssueCard {
  title: string;
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  frameIndex: number;
  drill: string;
}

interface DrillRecommendation {
  name: string;
  description: string;
  targetIssue: string;
}

export interface AnalysisData {
  id: string;
  event: string;
  drillType: string;
  cameraAngle: string;
  athleteHeight: number | null;
  implementWeight: number | null;
  knownDistance: number | null;
  phaseScores: PhaseScore[];
  energyLeaks: EnergyLeak[];
  releaseMetrics: ReleaseMetrics | null;
  overallScore: number | null;
  issueCards: IssueCard[];
  drillRecs: DrillRecommendation[];
  rawAnalysis: string | null;
  frameCount: number;
  videoDuration: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  athleteName: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const DRILL_LABELS: Record<string, string> = {
  FULL_THROW: "Full Throw",
  STANDING: "Stand Throw",
  POWER_POSITION: "Power Position",
  HALF_TURN: "Half Turn",
  GLIDE: "Glide",
  SPIN: "Spin",
  SOUTH_AFRICAN: "South African Drill",
};

const CAMERA_LABELS: Record<string, string> = {
  SIDE: "Side",
  BEHIND: "Behind",
  FRONT: "Front",
  DIAGONAL: "Diagonal",
};

const SEVERITY_STYLES: Record<string, { bg: string; border: string; badge: string }> = {
  HIGH: {
    bg: "bg-danger-50 dark:bg-danger-900/20",
    border: "border-danger-200 dark:border-danger-800",
    badge: "bg-danger-100 dark:bg-danger-900/40 text-danger-800 dark:text-danger-200",
  },
  MEDIUM: {
    bg: "bg-primary-50 dark:bg-primary-900/20",
    border: "border-primary-200 dark:border-primary-800",
    badge: "bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200",
  },
  LOW: {
    bg: "bg-info-50 dark:bg-info-900/20",
    border: "border-info-200 dark:border-info-800",
    badge: "bg-info-100 dark:bg-info-900/40 text-info-800 dark:text-info-200",
  },
};

function getScoreColor(score: number): string {
  if (score >= 8) return "text-success-600 dark:text-success-400";
  if (score >= 6) return "text-info-600 dark:text-info-400";
  if (score >= 4) return "text-primary-600 dark:text-primary-400";
  return "text-danger-600 dark:text-danger-400";
}

function getScoreBarColor(score: number): string {
  if (score >= 8) return "bg-success-500";
  if (score >= 6) return "bg-info-500";
  if (score >= 4) return "bg-primary-500";
  return "bg-danger-500";
}

function getOverallGrade(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Excellent", color: "text-success-600 dark:text-success-400" };
  if (score >= 70) return { label: "Good", color: "text-info-600 dark:text-info-400" };
  if (score >= 55)
    return {
      label: "Developing",
      color: "text-primary-600 dark:text-primary-400",
    };
  return { label: "Needs Work", color: "text-danger-600 dark:text-danger-400" };
}

const PROCESSING_STATUSES = new Set(["PENDING", "ANALYZING"]);

export function AnalysisView({ initialAnalysis }: { initialAnalysis: AnalysisData }) {
  const router = useRouter();
  const toast = useToast();
  const [analysis, setAnalysis] = useState<AnalysisData>(initialAnalysis);
  const [showRaw, setShowRaw] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cancelledRef = useRef(false);

  // Poll while still processing. Server fetched the initial state, so we
  // only mount this effect for the long-tail case where the AI job hasn't
  // resolved yet.
  useEffect(() => {
    if (!PROCESSING_STATUSES.has(analysis.status)) return;

    cancelledRef.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const res = await fetch(`/api/throwflow/${analysis.id}`);
        const payload = await res.json();
        if (cancelledRef.current) return;
        if (res.ok && payload.success) {
          setAnalysis(payload.data);
          if (PROCESSING_STATUSES.has(payload.data.status)) {
            timer = setTimeout(tick, 3000);
          }
        } else {
          // Transient — back off and retry
          timer = setTimeout(tick, 5000);
        }
      } catch {
        if (cancelledRef.current) return;
        timer = setTimeout(tick, 5000);
      }
    }

    timer = setTimeout(tick, 3000);
    return () => {
      cancelledRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [analysis.id, analysis.status]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/throwflow/${analysis.id}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        toast.error(payload?.error || `Delete failed (${res.status})`);
        setDeleting(false);
        return;
      }
      toast.success("Analysis deleted");
      router.push("/coach/throws/analyze/history");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error — please try again");
      setDeleting(false);
    }
  }

  // Still processing — show status card
  if (PROCESSING_STATUSES.has(analysis.status)) {
    return (
      <div className="animate-spring-up space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold font-heading text-[var(--foreground)]">
          Analyzing...
        </h1>
        <div className="card text-center py-16 space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-info-100 dark:bg-info-900/30">
            <svg
              className="animate-spin w-8 h-8 text-info-600 dark:text-info-400"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            AI is analyzing your throw
          </h2>
          <p className="text-sm text-surface-700 dark:text-surface-300 max-w-md mx-auto">
            The AI is reviewing {analysis.frameCount} frames and scoring each phase of the{" "}
            {EVENT_LABELS[analysis.event] || analysis.event}{" "}
            {DRILL_LABELS[analysis.drillType] || analysis.drillType}. This typically takes 15–30
            seconds.
          </p>
        </div>
      </div>
    );
  }

  // Failed
  if (analysis.status === "FAILED") {
    return (
      <div className="animate-spring-up space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold font-heading text-[var(--foreground)]">
          Analysis Failed
        </h1>
        <div className="card border-danger-200 dark:border-danger-800 space-y-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 text-danger-500 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div>
              <h3 className="font-medium text-danger-800 dark:text-danger-200">
                Analysis could not be completed
              </h3>
              <p className="text-sm text-danger-600 dark:text-danger-300 mt-1">
                {analysis.errorMessage || "An unknown error occurred."}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/coach/throws/analyze" className="btn-primary">
              Try Again
            </Link>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
              className="btn-secondary text-danger-600 dark:text-danger-400"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleDelete}
          title="Delete this analysis?"
          description="This cannot be undone. The analysis will be permanently removed."
          confirmLabel="Delete"
          variant="danger"
          loading={deleting}
        />
      </div>
    );
  }

  // Completed — full results
  const grade = analysis.overallScore != null ? getOverallGrade(analysis.overallScore) : null;

  return (
    <div className="animate-spring-up space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-[var(--foreground)]">
            {EVENT_LABELS[analysis.event]} Analysis
          </h1>
          <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">
            {DRILL_LABELS[analysis.drillType]} · {CAMERA_LABELS[analysis.cameraAngle]} View
            {analysis.athleteName && ` · ${analysis.athleteName}`}
            {" · "}
            {new Date(analysis.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/coach/throws/analyze" className="btn-secondary text-sm">
            New Analysis
          </Link>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
            className="btn-secondary text-sm text-danger-600 dark:text-danger-400"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Overall Score Card */}
      {analysis.overallScore != null && grade && (
        <div className="card !p-6 flex items-center gap-6">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-[var(--card-border)]"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="8"
                stroke="currentColor"
                strokeDasharray={`${(analysis.overallScore / 100) * 283} 283`}
                strokeLinecap="round"
                className={getScoreColor(analysis.overallScore / 10)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-2xl font-bold tabular-nums ${grade.color}`}>
                {analysis.overallScore}
              </span>
            </div>
          </div>
          <div>
            <h2 className={`text-xl font-bold ${grade.color}`}>{grade.label}</h2>
            <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">
              Overall technical score out of 100
            </p>
          </div>
        </div>
      )}

      {/* Phase Scores */}
      {analysis.phaseScores.length > 0 && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Phase Scores</h2>
          <div className="space-y-3">
            {analysis.phaseScores.map((phase, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    {phase.name}
                  </span>
                  <span className={`text-sm font-bold tabular-nums ${getScoreColor(phase.score)}`}>
                    {phase.score}/10
                  </span>
                </div>
                <div className="w-full bg-[var(--muted-bg)] rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-colors ${getScoreBarColor(phase.score)}`}
                    style={{ width: `${phase.score * 10}%` }}
                  />
                </div>
                {phase.notes && (
                  <p className="text-xs text-surface-700 dark:text-surface-300 mt-1">
                    {phase.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Release Metrics & Energy Leaks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analysis.releaseMetrics && (
          <div className="card space-y-3">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Release Metrics</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--muted-bg)]/50 rounded-lg p-3">
                <span className="text-xs text-surface-700 dark:text-surface-300">
                  Release Angle
                </span>
                <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
                  {analysis.releaseMetrics.angle != null
                    ? `${analysis.releaseMetrics.angle}°`
                    : "N/A"}
                </p>
              </div>
              <div className="bg-[var(--muted-bg)]/50 rounded-lg p-3">
                <span className="text-xs text-surface-700 dark:text-surface-300">
                  Velocity Rating
                </span>
                <p className="text-lg font-bold text-[var(--foreground)]">
                  {analysis.releaseMetrics.velocityRating || "N/A"}
                </p>
              </div>
              <div className="bg-[var(--muted-bg)]/50 rounded-lg p-3">
                <span className="text-xs text-surface-700 dark:text-surface-300">
                  Release Height
                </span>
                <p className="text-lg font-bold text-[var(--foreground)]">
                  {analysis.releaseMetrics.height || "N/A"}
                </p>
              </div>
              <div className="bg-[var(--muted-bg)]/50 rounded-lg p-3">
                <span className="text-xs text-surface-700 dark:text-surface-300">
                  Est. Distance
                </span>
                <p className="text-lg font-bold tabular-nums text-[var(--foreground)]">
                  {analysis.releaseMetrics.theoreticalDistance != null
                    ? `${analysis.releaseMetrics.theoreticalDistance}m`
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        )}

        {analysis.energyLeaks.length > 0 && (
          <div className="card space-y-3">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Energy Leaks</h2>
            <div className="space-y-2">
              {analysis.energyLeaks.map((leak, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800 rounded-lg p-3"
                >
                  <div className="bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums flex-shrink-0">
                    -{leak.percentImpact}%
                  </div>
                  <div>
                    <p className="text-sm text-[var(--foreground)]">{leak.description}</p>
                    <p className="text-xs text-surface-700 dark:text-surface-300 mt-0.5">
                      Frame {leak.frameIndex}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Issue Cards */}
      {analysis.issueCards.length > 0 && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Issues Found</h2>
          <div className="space-y-3">
            {analysis.issueCards.map((issue, i) => {
              const styles = SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.LOW;
              return (
                <div key={i} className={`${styles.bg} ${styles.border} border rounded-lg p-4`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-[var(--foreground)]">{issue.title}</h3>
                    <span
                      className={`${styles.badge} text-xs font-medium px-2 py-0.5 rounded-full`}
                    >
                      {issue.severity}
                    </span>
                  </div>
                  <p className="text-sm text-surface-700 dark:text-surface-300">
                    {issue.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-surface-700 dark:text-surface-300">
                    <span>Frame {issue.frameIndex}</span>
                    <span>Drill: {issue.drill}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Drill Recommendations */}
      {analysis.drillRecs.length > 0 && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Recommended Drills</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {analysis.drillRecs.map((drill, i) => (
              <div
                key={i}
                className="bg-success-50 dark:bg-success-900/10 border border-success-200 dark:border-success-800 rounded-lg p-4"
              >
                <h3 className="font-medium text-success-800 dark:text-success-200">{drill.name}</h3>
                <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">
                  {drill.description}
                </p>
                <p className="text-xs text-success-600 dark:text-success-400 mt-2">
                  Targets: {drill.targetIssue}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw Analysis Toggle */}
      {analysis.rawAnalysis && (
        <div className="card">
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 hover:text-[var(--foreground)]"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showRaw ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showRaw ? "Hide" : "Show"} Raw AI Response
          </button>
          {showRaw && (
            <pre className="mt-3 p-4 bg-[var(--muted-bg)] rounded-lg text-xs text-surface-700 dark:text-surface-300 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
              {analysis.rawAnalysis}
            </pre>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete this analysis?"
        description="This cannot be undone. The analysis will be permanently removed."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
