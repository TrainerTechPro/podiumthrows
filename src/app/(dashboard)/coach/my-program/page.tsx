"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface ProgramData {
 id: string;
 event: string;
 gender: string;
 status: string;
 startDate: string;
 targetDate: string | null;
 goalDistance: number | null;
 startingPr: number | null;
 daysPerWeek: number;
 sessionsPerDay: number;
 includeLift: boolean;
 currentWeekNumber: number;
 currentPhaseId: string | null;
 phases: PhaseData[];
}

interface PhaseData {
 id: string;
 phase: string;
 phaseOrder: number;
 startWeek: number;
 endWeek: number;
 durationWeeks: number;
 throwsPerWeekTarget: number;
 strengthDaysTarget: number;
 status: string;
 _count: { sessions: number };
}

interface SessionData {
 id: string;
 weekNumber: number;
 dayOfWeek: number;
 dayType: string;
 sessionType: string;
 focusLabel: string;
 totalThrowsTarget: number;
 estimatedDuration: number;
 status: string;
}

const EVENT_LABELS: Record<string, string> = {
 SHOT_PUT: "Shot Put",
 DISCUS: "Discus",
 HAMMER: "Hammer Throw",
 JAVELIN: "Javelin",
};

const PHASE_LABELS: Record<string, string> = {
 ACCUMULATION: "Accumulation",
 TRANSMUTATION: "Transmutation",
 REALIZATION: "Realization",
 COMPETITION: "Competition",
};

const PHASE_COLORS: Record<string, string> = {
 ACCUMULATION: "bg-blue-500",
 TRANSMUTATION: "bg-amber-500",
 REALIZATION: "bg-emerald-500",
 COMPETITION: "bg-red-500",
};

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_STYLES: Record<string, string> = {
 PLANNED: "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)]",
 SCHEDULED: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
 IN_PROGRESS: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
 COMPLETED: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
 SKIPPED: "bg-[var(--color-bg-subtle)] text-[var(--color-text-3)]",
};

export default function MyProgramPage() {
  const _router = useRouter();
 const searchParams = useSearchParams();
 const justGenerated = searchParams.get("generated");

 const [program, setProgram] = useState<ProgramData | null>(null);
 const [todaySessions, setTodaySessions] = useState<SessionData[]>([]);
 const [weekSessions, setWeekSessions] = useState<SessionData[]>([]);
 const [loading, setLoading] = useState(true);
 const [fetchError, setFetchError] = useState("");
 const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null);
 const [phaseSessions, setPhaseSessions] = useState<Record<string, SessionData[]>>({});
 const [loadingPhase, setLoadingPhase] = useState<string | null>(null);

 useEffect(() => {
 async function load() {
 try {
 const res = await fetch("/api/throws/program");
 if (res.ok) {
 const { data } = await res.json();
 if (data) {
 setProgram(data);
 // Fetch today and week sessions
 const [todayRes, weekRes] = await Promise.all([
 fetch(`/api/throws/program/${data.id}/today`),
 fetch(`/api/throws/program/${data.id}/week`),
 ]);
 if (todayRes.ok) {
 const td = await todayRes.json();
 setTodaySessions(td.data?.sessions ?? []);
 }
 if (weekRes.ok) {
 const wk = await weekRes.json();
 setWeekSessions(wk.data?.sessions ?? []);
 }
 }
 }
 } catch {
 setFetchError("Failed to load program. Please try again.");
 } finally {
 setLoading(false);
 }
 }
 load();
 }, []);

 async function togglePhase(phaseId: string, programId: string) {
 if (expandedPhaseId === phaseId) {
 setExpandedPhaseId(null);
 return;
 }
 setExpandedPhaseId(phaseId);
 if (!phaseSessions[phaseId]) {
 setLoadingPhase(phaseId);
 try {
 const res = await fetch(`/api/throws/program/${programId}/phase/${phaseId}/sessions`);
 if (res.ok) {
 const { data } = await res.json();
 setPhaseSessions((prev) => ({ ...prev, [phaseId]: data?.sessions ?? [] }));
 }
 } catch {
 // Phase sessions will just stay empty
 } finally {
 setLoadingPhase(null);
 }
 }
 }

 if (loading) {
 return (
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="animate-pulse text-[var(--color-text-3)]">Loading program...</div>
 </div>
 );
 }

 // Error loading program
 if (fetchError) {
 return (
 <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
 <p className="text-sm text-red-600 dark:text-red-400">{fetchError}</p>
 <button
 onClick={() => window.location.reload()}
 className="btn-secondary text-sm px-5 py-2"
 >
 Reload
 </button>
 </div>
 );
 }

 // No program — show onboarding CTA
 if (!program) {
 return (
 <div className="max-w-lg mx-auto px-4 py-16 text-center">
 <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[rgba(212,168,67,0.12)] flex items-center justify-center">
 <svg className="w-8 h-8 text-[var(--color-gold-dark)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
 </svg>
 </div>
 <h1 className="text-title font-heading text-[var(--color-text)] mb-2">
 No Program Yet
 </h1>
 <p className="text-body text-[var(--color-text-2)] mb-8">
 Create a Bondarchuk-based training program tailored to your event,
 equipment, and adaptation profile.
 </p>
 <Link href="/coach/my-program/onboard" className="btn-primary px-8 py-3 inline-block">
 Create Program
 </Link>
 </div>
 );
 }

 // ── Active Program Dashboard ──────────────────────────────────────
 const activePhase = program.phases.find((p) => p.id === program.currentPhaseId);
 const phaseProgress = activePhase
 ? ((program.currentWeekNumber - activePhase.startWeek) /
 activePhase.durationWeeks) *
 100
 : 0;
 const totalWeeks = program.phases.reduce(
 (sum, p) => Math.max(sum, p.endWeek),
 0,
 );
 const overallProgress = totalWeeks > 0
 ? (program.currentWeekNumber / totalWeeks) * 100
 : 0;
 const completedToday = todaySessions.filter(
 (s) => s.status === "COMPLETED",
 ).length;

 return (
 <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 space-y-6">
 {/* Success banner */}
 {justGenerated && (
 <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-xl animate-fade-in">
 <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
 Program generated successfully! Your training plan is ready.
 </p>
 </div>
 )}

 {/* Header */}
 <div className="flex items-start justify-between">
 <div>
 <h1 className="text-title font-heading text-[var(--color-text)]">
 My Program
 </h1>
 <p className="text-body text-[var(--color-text-2)]">
 {EVENT_LABELS[program.event] ?? program.event} &middot; Week{" "}
 {program.currentWeekNumber} of {totalWeeks}
 </p>
 </div>
 <span
 className={`px-3 py-1 rounded-full text-xs font-semibold ${
 program.status === "ACTIVE"
 ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)]"
 }`}
 >
 {program.status}
 </span>
 </div>

 {/* Phase Timeline */}
 <div className="card">
 <h2 className="text-section font-heading text-[var(--color-text)] mb-4">
 Phase Progress
 </h2>
 <div className="space-y-3">
 {program.phases.map((phase) => {
 const isCurrent = phase.id === program.currentPhaseId;
 const isExpanded = expandedPhaseId === phase.id;
 const sessions = phaseSessions[phase.id];
 const isLoadingThis = loadingPhase === phase.id;
 return (
 <div key={phase.id}>
 <button
 type="button"
 onClick={() => togglePhase(phase.id, program.id)}
 className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer hover:bg-[var(--color-surface-2)]/50 ${
 isCurrent
 ? "bg-[rgba(212,168,67,0.08)] ring-1 ring-[rgba(212,168,67,0.3)]"
 : ""
 }`}
 >
 <div
 className={`w-3 h-3 rounded-full flex-shrink-0 ${PHASE_COLORS[phase.phase] ?? "bg-[var(--color-text-3)]"}`}
 />
 <div className="flex-1 min-w-0 text-left">
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium text-[var(--color-text)]">
 {PHASE_LABELS[phase.phase] ?? phase.phase}
 </span>
 <span className="text-xs text-[var(--color-text-2)]">
 Weeks {phase.startWeek}-{phase.endWeek}
 </span>
 {isCurrent && (
 <span className="text-xs bg-[rgba(212,168,67,0.2)] dark:bg-[rgba(212,168,67,0.15)] text-[var(--color-gold-dark)] px-1.5 py-0.5 rounded">
 Current
 </span>
 )}
 </div>
 {isCurrent && (
 <div className="mt-1.5 h-1.5 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
 <div
 className="h-full bg-[rgba(212,168,67,0.08)] rounded-full transition-all"
 style={{ width: `${Math.min(100, phaseProgress)}%` }}
 />
 </div>
 )}
 </div>
 <span
 className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
 phase.status === "ACTIVE"
 ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
 : phase.status === "COMPLETED"
 ? "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)]"
 : "bg-[var(--color-surface-2)]/50 text-[var(--color-text-3)]"
 }`}
 >
 {phase.status === "ACTIVE"
 ? `${phase.throwsPerWeekTarget} throws/wk`
 : phase.status}
 </span>
 <svg
 className={`w-4 h-4 text-[var(--color-text-3)] transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 {isExpanded && (
 <div className="ml-6 pl-3 border-l-2 border-[var(--color-border)] mt-1 space-y-1">
 {isLoadingThis ? (
 <p className="text-xs text-[var(--color-text-3)] py-2">Loading sessions...</p>
 ) : sessions && sessions.length > 0 ? (
 sessions.map((s) => (
 <Link
 key={s.id}
 href={`/coach/my-program/session/${s.id}`}
 className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs hover:bg-[var(--color-surface-2)]/50 transition-colors group"
 >
 <span className="text-[var(--color-text-2)] w-7">
 {DAY_NAMES[s.dayOfWeek] ?? `D${s.dayOfWeek}`}
 </span>
 <span className="text-[var(--color-text)] flex-1">{s.focusLabel}</span>
 <span className="text-[var(--color-text-3)]">{s.totalThrowsTarget}t</span>
 <span className={`px-1.5 py-0.5 rounded ${STATUS_STYLES[s.status] ?? ""}`}>
 {s.status === "COMPLETED" ? "\u2713" : s.status.replace("_", " ")}
 </span>
 </Link>
 ))
 ) : (
 <p className="text-xs text-[var(--color-text-3)] py-2">
 {phase._count.sessions} session{phase._count.sessions !== 1 ? "s" : ""} planned
 </p>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>

 {/* Overall progress */}
 <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
 <div className="flex justify-between text-xs text-[var(--color-text-2)] mb-1">
 <span>Overall Progress</span>
 <span>{Math.round(overallProgress)}%</span>
 </div>
 <div className="h-2 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
 <div
 className="h-full bg-[rgba(212,168,67,0.08)] rounded-full transition-all"
 style={{ width: `${Math.min(100, overallProgress)}%` }}
 />
 </div>
 </div>
 </div>

 {/* Today's Sessions */}
 <div className="card">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-section font-heading text-[var(--color-text)]">
 Today
 </h2>
 {todaySessions.length > 0 && (
 <span className="text-xs text-[var(--color-text-2)]">
 {completedToday}/{todaySessions.length} done
 </span>
 )}
 </div>

 {todaySessions.length === 0 ? (
 <p className="text-sm text-[var(--color-text-2)] py-4 text-center">
 No sessions scheduled for today. Rest day!
 </p>
 ) : (
 <div className="space-y-3">
 {todaySessions.map((session) => (
 <Link
 key={session.id}
 href={`/coach/my-program/session/${session.id}`}
 className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] hover:border-[rgba(212,168,67,0.2)] transition-all group"
 >
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium text-[var(--color-text)]">
 {session.focusLabel}
 </span>
 <span
 className={`text-xs px-1.5 py-0.5 rounded ${STATUS_STYLES[session.status] ?? ""}`}
 >
 {session.status.replace("_", " ")}
 </span>
 </div>
 <p className="text-xs text-[var(--color-text-2)] mt-0.5">
 Day {session.dayType} &middot; {session.totalThrowsTarget} throws &middot;{" "}
 ~{session.estimatedDuration}min
 </p>
 </div>
 <svg
 className="w-4 h-4 text-[var(--color-text-3)] group-hover:text-[var(--color-gold)] transition-colors"
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M9 5l7 7-7 7"
 />
 </svg>
 </Link>
 ))}
 </div>
 )}
 </div>

 {/* This Week */}
 <div className="card">
 <h2 className="text-section font-heading text-[var(--color-text)] mb-4">
 Week {program.currentWeekNumber}
 </h2>
 {weekSessions.length === 0 ? (
 <p className="text-sm text-[var(--color-text-2)] text-center py-4">
 No sessions this week.
 </p>
 ) : (
 <div className="space-y-2">
 {weekSessions.map((session) => (
 <Link
 key={session.id}
 href={`/coach/my-program/session/${session.id}`}
 className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--color-surface-2)]/50 transition-all"
 >
 <span className="text-xs font-medium text-[var(--color-text-2)] w-8">
 {DAY_NAMES[session.dayOfWeek] ?? `D${session.dayOfWeek}`}
 </span>
 <span className="text-sm text-[var(--color-text)] flex-1">
 {session.focusLabel}
 </span>
 <span className="text-xs text-[var(--color-text-2)]">
 {session.totalThrowsTarget}t
 </span>
 <span
 className={`text-xs px-1.5 py-0.5 rounded ${STATUS_STYLES[session.status] ?? ""}`}
 >
 {session.status === "COMPLETED" ? (
 <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
 </svg>
 ) : (
 session.status.replace("_", " ")
 )}
 </span>
 </Link>
 ))}
 </div>
 )}
 </div>

 {/* Quick Stats */}
 {activePhase && (
 <div className="grid grid-cols-3 gap-3">
 <div className="card text-center">
 <p className="text-display font-heading text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)]">
 {activePhase.throwsPerWeekTarget}
 </p>
 <p className="text-micro text-[var(--color-text-2)] uppercase tracking-wide">
 Throws/Week
 </p>
 </div>
 <div className="card text-center">
 <p className="text-display font-heading text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)]">
 {program.daysPerWeek}
 </p>
 <p className="text-micro text-[var(--color-text-2)] uppercase tracking-wide">
 Days/Week
 </p>
 </div>
 <div className="card text-center">
 <p className="text-display font-heading text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)]">
 {activePhase.strengthDaysTarget}
 </p>
 <p className="text-micro text-[var(--color-text-2)] uppercase tracking-wide">
 Lift Days
 </p>
 </div>
 </div>
 )}
 </div>
 );
}
