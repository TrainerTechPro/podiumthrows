"use client";

import { useState, useEffect } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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

interface AnalysisData {
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
 SHOT_PUT: "Shot Put", DISCUS: "Discus", HAMMER: "Hammer", JAVELIN: "Javelin",
};
const DRILL_LABELS: Record<string, string> = {
 FULL_THROW: "Full Throw", STANDING: "Stand Throw", POWER_POSITION: "Power Position",
 HALF_TURN: "Half Turn", GLIDE: "Glide", SPIN: "Spin", SOUTH_AFRICAN: "South African Drill",
};
const CAMERA_LABELS: Record<string, string> = {
 SIDE: "Side", BEHIND: "Behind", FRONT: "Front", DIAGONAL: "Diagonal",
};

const SEVERITY_STYLES: Record<string, { bg: string; border: string; badge: string }> = {
 HIGH: { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200 dark:border-red-800", badge: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200" },
 MEDIUM: { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200" },
 LOW: { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200" },
};

export default function ThrowFlowResultPage() {
 const params = useParams();
 const router = useRouter();
 const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
 const [loading, setLoading] = useState(true);
 const [showRaw, setShowRaw] = useState(false);
 const [deleting, setDeleting] = useState(false);

 useEffect(() => {
 let interval: NodeJS.Timeout | null = null;

 async function load() {
 try {
 const res = await fetch(`/api/throwflow/${params.id}`);
 const data = await res.json();
 if (data.success) {
 setAnalysis(data.data);
 // Keep polling if still analyzing
 if (data.data.status === "ANALYZING" || data.data.status === "PENDING") {
 interval = setTimeout(load, 3000);
 }
 }
 } catch {
 // retry
 interval = setTimeout(load, 5000);
 } finally {
 setLoading(false);
 }
 }

 load();
 return () => {
 if (interval) clearTimeout(interval);
 };
 }, [params.id]);

 async function handleDelete() {
 if (!confirm("Delete this analysis? This cannot be undone.")) return;
 setDeleting(true);
 try {
 await fetch(`/api/throwflow/${params.id}`, { method: "DELETE", headers: csrfHeaders() });
 router.push("/coach/throws/analyze/history");
 } catch {
 setDeleting(false);
 }
 }

 function getScoreColor(score: number): string {
 if (score >= 8) return "text-green-600 dark:text-green-400";
 if (score >= 6) return "text-blue-600 dark:text-blue-400";
 if (score >= 4) return "text-amber-600 dark:text-amber-400";
 return "text-red-600 dark:text-red-400";
 }

 function getScoreBarColor(score: number): string {
 if (score >= 8) return "bg-green-500";
 if (score >= 6) return "bg-blue-500";
 if (score >= 4) return "bg-amber-500";
 return "bg-red-500";
 }

 function getOverallGrade(score: number): { label: string; color: string } {
 if (score >= 85) return { label: "Excellent", color: "text-green-600 dark:text-green-400" };
 if (score >= 70) return { label: "Good", color: "text-blue-600 dark:text-blue-400" };
 if (score >= 55) return { label: "Developing", color: "text-amber-600 dark:text-amber-400" };
 return { label: "Needs Work", color: "text-red-600 dark:text-red-400" };
 }

 if (loading) {
 return (
 <div className="animate-spring-up space-y-6 stagger-spring">
 <div className="skeleton h-8 w-64 rounded" />
 <div className="skeleton h-4 w-48 rounded" />
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="skeleton h-40 rounded-lg" />
 <div className="skeleton h-40 rounded-lg md:col-span-2" />
 </div>
 <div className="skeleton h-60 rounded-lg" />
 </div>
 );
 }

 if (!analysis) {
 return (
 <div className="card text-center py-12">
 <p className="text-[var(--color-text-2)]">Analysis not found.</p>
 <Link href="/coach/throws/analyze" className="btn-primary mt-4 inline-block">
 New Analysis
 </Link>
 </div>
 );
 }

 // Still processing
 if (analysis.status === "ANALYZING" || analysis.status === "PENDING") {
 return (
 <div className="animate-spring-up space-y-6">
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">Analyzing...</h1>
 <div className="card text-center py-16 space-y-4">
 <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30">
 <svg className="animate-spin w-8 h-8 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 </div>
 <h2 className="text-lg font-semibold text-[var(--color-text)]">
 AI is analyzing your throw
 </h2>
 <p className="text-sm text-[var(--color-text-2)] max-w-md mx-auto">
 The AI is reviewing {analysis.frameCount} frames and scoring each phase of the {EVENT_LABELS[analysis.event] || analysis.event} {DRILL_LABELS[analysis.drillType] || analysis.drillType}.
 This typically takes 15-30 seconds.
 </p>
 </div>
 </div>
 );
 }

 // Failed
 if (analysis.status === "FAILED") {
 return (
 <div className="animate-spring-up space-y-6">
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">Analysis Failed</h1>
 <div className="card border-red-200 dark:border-red-800 space-y-4">
 <div className="flex items-start gap-3">
 <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
 </svg>
 <div>
 <h3 className="font-medium text-red-800 dark:text-red-200">Analysis could not be completed</h3>
 <p className="text-sm text-red-600 dark:text-red-300 mt-1">
 {analysis.errorMessage || "An unknown error occurred."}
 </p>
 </div>
 </div>
 <div className="flex gap-3">
 <Link href="/coach/throws/analyze" className="btn-primary">
 Try Again
 </Link>
 <button onClick={handleDelete} disabled={deleting} className="btn-secondary text-red-600 dark:text-red-400">
 {deleting ? "Deleting..." : "Delete"}
 </button>
 </div>
 </div>
 </div>
 );
 }

 // Completed — full results
 const grade = analysis.overallScore != null ? getOverallGrade(analysis.overallScore) : null;

 return (
 <div className="animate-spring-up space-y-6">
 {/* Header */}
 <div className="flex items-start justify-between">
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">
 {EVENT_LABELS[analysis.event]} Analysis
 </h1>
 <p className="text-sm text-[var(--color-text-2)] mt-1">
 {DRILL_LABELS[analysis.drillType]} &middot; {CAMERA_LABELS[analysis.cameraAngle]} View
 {analysis.athleteName && ` \u00b7 ${analysis.athleteName}`}
 {" \u00b7 "}
 {new Date(analysis.createdAt).toLocaleDateString()}
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Link href="/coach/throws/analyze" className="btn-secondary text-sm">
 New Analysis
 </Link>
 <button onClick={handleDelete} disabled={deleting} className="btn-secondary text-sm text-red-600 dark:text-red-400">
 Delete
 </button>
 </div>
 </div>

 {/* Overall Score Card */}
 {analysis.overallScore != null && grade && (
 <div className="card !p-6 flex items-center gap-6">
 <div className="relative w-24 h-24 flex-shrink-0">
 <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
 <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-[var(--color-border)]" />
 <circle
 cx="50" cy="50" r="45" fill="none" strokeWidth="8"
 stroke="currentColor"
 strokeDasharray={`${(analysis.overallScore / 100) * 283} 283`}
 strokeLinecap="round"
 className={getScoreColor(analysis.overallScore / 10)}
 />
 </svg>
 <div className="absolute inset-0 flex items-center justify-center">
 <span className={`text-2xl font-bold ${grade.color}`}>{analysis.overallScore}</span>
 </div>
 </div>
 <div>
 <h2 className={`text-xl font-bold ${grade.color}`}>{grade.label}</h2>
 <p className="text-sm text-[var(--color-text-2)] mt-1">
 Overall technical score out of 100
 </p>
 </div>
 </div>
 )}

 {/* Phase Scores */}
 {analysis.phaseScores.length > 0 && (
 <div className="card space-y-4">
 <h2 className="text-lg font-semibold text-[var(--color-text)]">Phase Scores</h2>
 <div className="space-y-3">
 {analysis.phaseScores.map((phase, i) => (
 <div key={i}>
 <div className="flex items-center justify-between mb-1">
 <span className="text-sm font-medium text-[var(--color-text-2)]">{phase.name}</span>
 <span className={`text-sm font-bold ${getScoreColor(phase.score)}`}>
 {phase.score}/10
 </span>
 </div>
 <div className="w-full bg-[var(--color-bg-subtle)] rounded-full h-2">
 <div
 className={`h-2 rounded-full transition-all ${getScoreBarColor(phase.score)}`}
 style={{ width: `${phase.score * 10}%` }}
 />
 </div>
 {phase.notes && (
 <p className="text-xs text-[var(--color-text-2)] mt-1">{phase.notes}</p>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Release Metrics & Energy Leaks */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Release Metrics */}
 {analysis.releaseMetrics && (
 <div className="card space-y-3">
 <h2 className="text-lg font-semibold text-[var(--color-text)]">Release Metrics</h2>
 <div className="grid grid-cols-2 gap-3">
 <div className="bg-[var(--color-surface-2)]/50 rounded-lg p-3">
 <span className="text-xs text-[var(--color-text-2)]">Release Angle</span>
 <p className="text-lg font-bold text-[var(--color-text)]">
 {analysis.releaseMetrics.angle != null ? `${analysis.releaseMetrics.angle}\u00b0` : "N/A"}
 </p>
 </div>
 <div className="bg-[var(--color-surface-2)]/50 rounded-lg p-3">
 <span className="text-xs text-[var(--color-text-2)]">Velocity Rating</span>
 <p className="text-lg font-bold text-[var(--color-text)]">
 {analysis.releaseMetrics.velocityRating || "N/A"}
 </p>
 </div>
 <div className="bg-[var(--color-surface-2)]/50 rounded-lg p-3">
 <span className="text-xs text-[var(--color-text-2)]">Release Height</span>
 <p className="text-lg font-bold text-[var(--color-text)]">
 {analysis.releaseMetrics.height || "N/A"}
 </p>
 </div>
 <div className="bg-[var(--color-surface-2)]/50 rounded-lg p-3">
 <span className="text-xs text-[var(--color-text-2)]">Est. Distance</span>
 <p className="text-lg font-bold text-[var(--color-text)]">
 {analysis.releaseMetrics.theoreticalDistance != null
 ? `${analysis.releaseMetrics.theoreticalDistance}m`
 : "N/A"}
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Energy Leaks */}
 {analysis.energyLeaks.length > 0 && (
 <div className="card space-y-3">
 <h2 className="text-lg font-semibold text-[var(--color-text)]">Energy Leaks</h2>
 <div className="space-y-2">
 {analysis.energyLeaks.map((leak, i) => (
 <div
 key={i}
 className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3"
 >
 <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-full px-2 py-0.5 text-xs font-bold flex-shrink-0">
 -{leak.percentImpact}%
 </div>
 <div>
 <p className="text-sm text-[var(--color-text)]">{leak.description}</p>
 <p className="text-xs text-[var(--color-text-2)] mt-0.5">
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
 <h2 className="text-lg font-semibold text-[var(--color-text)]">Issues Found</h2>
 <div className="space-y-3">
 {analysis.issueCards.map((issue, i) => {
 const styles = SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.LOW;
 return (
 <div key={i} className={`${styles.bg} ${styles.border} border rounded-lg p-4`}>
 <div className="flex items-start justify-between mb-2">
 <h3 className="font-medium text-[var(--color-text)]">{issue.title}</h3>
 <span className={`${styles.badge} text-xs font-medium px-2 py-0.5 rounded-full`}>
 {issue.severity}
 </span>
 </div>
 <p className="text-sm text-[var(--color-text-2)]">{issue.description}</p>
 <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-2)]">
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
 <h2 className="text-lg font-semibold text-[var(--color-text)]">
 Recommended Drills
 </h2>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {analysis.drillRecs.map((drill, i) => (
 <div
 key={i}
 className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4"
 >
 <h3 className="font-medium text-green-800 dark:text-green-200">{drill.name}</h3>
 <p className="text-sm text-[var(--color-text-2)] mt-1">{drill.description}</p>
 <p className="text-xs text-green-600 dark:text-green-400 mt-2">
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
 onClick={() => setShowRaw(!showRaw)}
 className="flex items-center gap-2 text-sm text-[var(--color-text-2)] hover:text-[var(--color-text)] "
 >
 <svg
 className={`w-4 h-4 transition-transform ${showRaw ? "rotate-90" : ""}`}
 fill="none" viewBox="0 0 24 24" stroke="currentColor"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 {showRaw ? "Hide" : "Show"} Raw AI Response
 </button>
 {showRaw && (
 <pre className="mt-3 p-4 bg-[var(--color-surface-2)] rounded-lg text-xs text-[var(--color-text-2)] overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
 {analysis.rawAnalysis}
 </pre>
 )}
 </div>
 )}
 </div>
 );
}
