"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AnalysisSummary {
 id: string;
 event: string;
 drillType: string;
 cameraAngle: string;
 overallScore: number | null;
 status: string;
 createdAt: string;
 athleteName: string | null;
}

const EVENT_LABELS: Record<string, string> = {
 SHOT_PUT: "Shot Put", DISCUS: "Discus", HAMMER: "Hammer", JAVELIN: "Javelin",
};
const DRILL_LABELS: Record<string, string> = {
 FULL_THROW: "Full Throw", STANDING: "Stand Throw", POWER_POSITION: "Power Position",
 HALF_TURN: "Half Turn", GLIDE: "Glide", SPIN: "Spin", SOUTH_AFRICAN: "South African",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
 COMPLETED: { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-800 dark:text-green-200", label: "Completed" },
 ANALYZING: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-800 dark:text-blue-200", label: "Analyzing" },
 PENDING: { bg: "bg-[var(--color-bg-subtle)]", text: "text-[var(--color-text-2)]", label: "Pending" },
 FAILED: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-800 dark:text-red-200", label: "Failed" },
};

function getScoreColor(score: number): string {
 if (score >= 85) return "text-green-600 dark:text-green-400";
 if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
 if (score >= 55) return "text-amber-600 dark:text-amber-400";
 return "text-red-600 dark:text-red-400";
}

export default function ThrowFlowHistoryPage() {
 const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
 const [loading, setLoading] = useState(true);
 const [filterEvent, setFilterEvent] = useState("");

 useEffect(() => {
 fetch("/api/throwflow")
 .then((r) => r.json())
 .then((data) => {
 if (data.success) setAnalyses(data.data || []);
 })
 .catch(() => {})
 .finally(() => setLoading(false));
 }, []);

 const filtered = filterEvent
 ? analyses.filter((a) => a.event === filterEvent)
 : analyses;

 return (
 <div className="animate-spring-up space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">Analysis History</h1>
 <p className="text-sm text-[var(--color-text-2)] mt-1">
 {analyses.length} total analyses
 </p>
 </div>
 <Link href="/coach/throws/analyze" className="btn-primary text-sm">
 New Analysis
 </Link>
 </div>

 {/* Filter */}
 <div className="flex gap-2">
 <button
 onClick={() => setFilterEvent("")}
 className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
 !filterEvent
 ? "bg-amber-500 text-white"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)] "
 }`}
 >
 All
 </button>
 {Object.entries(EVENT_LABELS).map(([value, label]) => (
 <button
 key={value}
 onClick={() => setFilterEvent(value)}
 className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
 filterEvent === value
 ? "bg-amber-500 text-white"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)] "
 }`}
 >
 {label}
 </button>
 ))}
 </div>

 {/* Loading */}
 {loading && (
 <div className="space-y-3 stagger-spring">
 {[1, 2, 3].map((i) => (
 <div key={i} className="skeleton h-20 rounded-lg" />
 ))}
 </div>
 )}

 {/* Empty state */}
 {!loading && filtered.length === 0 && (
 <div className="card text-center py-12">
 <svg className="w-12 h-12 mx-auto text-[var(--color-border-strong)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
 </svg>
 <p className="text-[var(--color-text-2)] mb-3">
 {filterEvent ? "No analyses for this event yet." : "No analyses yet."}
 </p>
 <Link href="/coach/throws/analyze" className="btn-primary inline-block">
 Upload a Video
 </Link>
 </div>
 )}

 {/* Analysis List */}
 {!loading && filtered.length > 0 && (
 <div className="space-y-3 stagger-spring">
 {filtered.map((a) => {
 const status = STATUS_STYLES[a.status] || STATUS_STYLES.PENDING;
 return (
 <Link
 key={a.id}
 href={`/coach/throws/analyze/${a.id}`}
 className="card !p-4 flex items-center gap-4 hover:shadow-md transition-shadow group"
 >
 {/* Score circle */}
 <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center">
 {a.overallScore != null ? (
 <div className="relative w-14 h-14">
 <svg className="w-14 h-14 -rotate-90" viewBox="0 0 100 100">
 <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-[var(--color-border)]" />
 <circle
 cx="50" cy="50" r="42" fill="none" strokeWidth="6" stroke="currentColor"
 strokeDasharray={`${(a.overallScore / 100) * 264} 264`}
 strokeLinecap="round"
 className={getScoreColor(a.overallScore)}
 />
 </svg>
 <div className="absolute inset-0 flex items-center justify-center">
 <span className={`text-sm font-bold ${getScoreColor(a.overallScore)}`}>
 {a.overallScore}
 </span>
 </div>
 </div>
 ) : (
 <div className="w-14 h-14 rounded-full bg-[var(--color-bg-subtle)] flex items-center justify-center">
 <span className={`${status.text} text-xs font-medium`}>--</span>
 </div>
 )}
 </div>

 {/* Info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-medium text-[var(--color-text)]">
 {EVENT_LABELS[a.event] || a.event}
 </span>
 <span className="text-sm text-[var(--color-text-2)]">
 {DRILL_LABELS[a.drillType] || a.drillType}
 </span>
 </div>
 <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-2)]">
 {a.athleteName && <span>{a.athleteName}</span>}
 <span>{new Date(a.createdAt).toLocaleDateString()}</span>
 </div>
 </div>

 {/* Status badge */}
 <span className={`${status.bg} ${status.text} text-xs font-medium px-2.5 py-1 rounded-full`}>
 {status.label}
 </span>

 {/* Arrow */}
 <svg className="w-5 h-5 text-[var(--color-border-strong)] group-hover:text-[var(--color-text-2)] dark:group-hover:text-[var(--color-text-3)] transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </Link>
 );
 })}
 </div>
 )}
 </div>
 );
}
