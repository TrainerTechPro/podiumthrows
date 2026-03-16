"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { localToday } from "@/lib/utils";
import { EVENTS, SELF_FEELING_OPTIONS, parseEvents, type SelfFeeling } from "@/lib/throws/constants";
import { csrfHeaders } from "@/lib/csrf-client";
import type { ThrowingBlockConfig, StrengthBlockConfig, WarmupCooldownConfig } from "@/lib/throws/validation";

// ── Types ────────────────────────────────────────────────────────────

interface Block {
 id: string;
 blockType: string;
 position: number;
 config: string;
}

interface ThrowLogEntry {
 id: string;
 blockId: string;
 throwNumber: number;
 distance: number | null;
 implement: string;
}

interface Assignment {
 id: string;
 assignedDate: string;
 status: string;
 rpe: number | null;
 selfFeeling: string | null;
 feedbackNotes: string | null;
 session: {
 id: string;
 name: string;
 event: string;
 sessionType: string;
 notes: string | null;
 blocks: Block[];
 };
 throwLogs: ThrowLogEntry[];
}

interface PRResult {
 isNewPR: boolean;
 previousDistance: number | null;
 improvement: number | null;
}

interface ThrowInput {
 throwNumber: number;
 distance: string;
 implement: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function getStorageKey(assignmentId: string) {
 return `throws_blocks_${assignmentId}`;
}

function getSavedBlocks(assignmentId: string): string[] {
 try {
 const saved = localStorage.getItem(getStorageKey(assignmentId));
 return saved ? JSON.parse(saved) : [];
 } catch {
 return [];
 }
}

function saveBlocks(assignmentId: string, blockIds: string[]) {
 try {
 localStorage.setItem(getStorageKey(assignmentId), JSON.stringify(blockIds));
 } catch { /* noop */ }
}

function clearSavedBlocks(assignmentId: string) {
 try {
 localStorage.removeItem(getStorageKey(assignmentId));
 } catch { /* noop */ }
}

// ── Main Page ────────────────────────────────────────────────────────

export default function AthleteThrowsPage() {
 const [assignments, setAssignments] = useState<Assignment[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeAssignment, setActiveAssignment] = useState<string | null>(null);

 const fetchAssignments = useCallback(() => {
 fetch("/api/throws/assignments")
 .then((r) => r.json())
 .then((data) => {
 if (data.success) {
 setAssignments(data.data);
 // Auto-resume any IN_PROGRESS session
 const inProgress = data.data.find((a: Assignment) => a.status === "IN_PROGRESS");
 if (inProgress) setActiveAssignment(inProgress.id);
 }
 setLoading(false);
 })
 .catch(() => setLoading(false));
 }, []);

 useEffect(() => {
 fetchAssignments();
 }, [fetchAssignments]);

 const handleStartSession = async (assignmentId: string) => {
 const res = await fetch(`/api/throws/assignments/${assignmentId}`, {
 method: "PUT",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({ action: "start" }),
 });
 const data = await res.json();
 if (data.success) {
 setActiveAssignment(assignmentId);
 setAssignments((prev) =>
 prev.map((a) => (a.id === assignmentId ? { ...a, status: "IN_PROGRESS" } : a))
 );
 }
 };

 const handleSkipSession = async (assignmentId: string, reason: string) => {
 const res = await fetch(`/api/throws/assignments/${assignmentId}`, {
 method: "PUT",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({ action: "skip", skipReason: reason }),
 });
 const data = await res.json();
 if (data.success) {
 clearSavedBlocks(assignmentId);
 if (activeAssignment === assignmentId) setActiveAssignment(null);
 fetchAssignments();
 }
 };

 const handleCompleteSession = async (
 assignmentId: string,
 rpe: number,
 selfFeeling: string,
 feedbackNotes: string
 ) => {
 const res = await fetch(`/api/throws/assignments/${assignmentId}`, {
 method: "PUT",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({ action: "complete", rpe, selfFeeling, feedbackNotes }),
 });
 const data = await res.json();
 if (data.success) {
 clearSavedBlocks(assignmentId);
 setActiveAssignment(null);
 fetchAssignments();
 }
 };

 const today = localToday();
 const todaySessions = assignments.filter(
 (a) => a.assignedDate === today && a.status !== "COMPLETED" && a.status !== "SKIPPED"
 );
 const activeSessions = assignments.filter(
 (a) => a.status === "IN_PROGRESS" && a.assignedDate !== today
 );
 const upcomingSessions = assignments.filter(
 (a) => a.assignedDate > today && a.status !== "IN_PROGRESS"
 );
 const pastSessions = assignments.filter(
 (a) =>
 (a.assignedDate < today || a.status === "COMPLETED" || a.status === "SKIPPED") &&
 a.status !== "IN_PROGRESS" &&
 !(a.assignedDate === today && a.status !== "COMPLETED" && a.status !== "SKIPPED")
 );

 if (loading) {
 return (
 <div className="animate-spring-up space-y-4">
 <div className="shimmer-contextual h-8 w-48" />
 <div className="shimmer-contextual h-32 rounded-xl" />
 <div className="shimmer-contextual h-24 rounded-xl" />
 </div>
 );
 }

 return (
 <div className="animate-spring-up space-y-6">
 <div>
 <h1 className="text-display font-heading text-[var(--color-text)]">Throws Practice</h1>
 <p className="text-sm text-[var(--color-text-2)]">Your assigned throws sessions</p>
 </div>

 <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
 <Link href="/athlete/throws/profile" className="action-chip animate-chip-in">
 <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
 </svg>
 <span>View PRs</span>
 </Link>
 <Link href="/athlete/throws/log" className="action-chip animate-chip-in animate-delay-75">
 <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <span>Throw history</span>
 </Link>
 <Link href="/athlete/throws/analysis" className="action-chip animate-chip-in animate-delay-150">
 <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
 </svg>
 <span>Analysis</span>
 </Link>
 </div>

 {/* Active / in-progress sessions from other days */}
 {activeSessions.map((assignment) => (
 <SessionCard
 key={assignment.id}
 assignment={assignment}
 isActive={activeAssignment === assignment.id}
 onStart={() => setActiveAssignment(assignment.id)}
 onSkip={handleSkipSession}
 onComplete={handleCompleteSession}
 onRefresh={fetchAssignments}
 />
 ))}

 {/* Today's sessions */}
 {todaySessions.length > 0 ? (
 <div>
 <h2 className="text-section font-heading text-[var(--color-text)] mb-3">Today</h2>
 <div className="space-y-4">
 {todaySessions.map((assignment) => (
 <SessionCard
 key={assignment.id}
 assignment={assignment}
 isActive={activeAssignment === assignment.id}
 onStart={() => handleStartSession(assignment.id)}
 onSkip={handleSkipSession}
 onComplete={handleCompleteSession}
 onRefresh={fetchAssignments}
 />
 ))}
 </div>
 </div>
 ) : (
 activeSessions.length === 0 && (
 <div className="card card-hover-lift text-center py-10">
 <div className="text-4xl mb-3">☀️</div>
 <h3 className="font-semibold text-[var(--color-text)]">Rest Day</h3>
 <p className="text-sm text-[var(--color-text-2)] mt-1">
 {upcomingSessions.length > 0
 ? `Next session: ${upcomingSessions[0].assignedDate}`
 : "No upcoming sessions assigned"}
 </p>
 </div>
 )
 )}

 {/* Upcoming */}
 {upcomingSessions.length > 0 && (
 <div>
 <h2 className="text-section font-heading text-[var(--color-text)] mb-3">Upcoming</h2>
 <div className="space-y-2 stagger-spring">
 {upcomingSessions.slice(0, 5).map((a) => {
 const sessionEvents = parseEvents(a.session.event);
 const primaryMeta = EVENTS[sessionEvents[0]];
 return (
 <div key={a.id} className="card !p-3 flex items-center gap-3">
 <span
 className="w-2 h-8 rounded-full flex-shrink-0"
 style={{ backgroundColor: primaryMeta?.color || "#666" }}
 />
 <div className="flex-1 min-w-0">
 <p className="font-medium text-[var(--color-text)] text-sm truncate">
 {a.session.name}
 </p>
 <div className="flex items-center gap-1 mt-0.5">
 {sessionEvents.map((ev) => (
 <span key={ev} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: EVENTS[ev]?.color || "#666" }}>
 {EVENTS[ev]?.label || ev}
 </span>
 ))}
 <span className="text-xs text-[var(--color-text-2)] ml-1">{a.assignedDate}</span>
 </div>
 </div>
 <span className="text-xs text-[var(--color-text-3)]">
 {a.session.blocks.length} blocks
 </span>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Past sessions */}
 {pastSessions.length > 0 && (
 <div>
 <h2 className="text-section font-heading text-[var(--color-text)] mb-3">Recent</h2>
 <div className="space-y-2 stagger-spring">
 {pastSessions.slice(0, 5).map((a) => {
 const pastEvents = parseEvents(a.session.event);
 const pastPrimaryMeta = EVENTS[pastEvents[0]];
 return (
 <Link key={a.id} href={`/athlete/throws/log?sessionId=${a.id}`} className="card !p-3 flex items-center gap-3 hover:bg-[var(--color-surface-2)] transition-colors block">
 <span
 className="w-2 h-8 rounded-full flex-shrink-0 opacity-50"
 style={{ backgroundColor: pastPrimaryMeta?.color || "#666" }}
 />
 <div className="flex-1 min-w-0">
 <p className="font-medium text-[var(--color-text)] text-sm truncate">
 {a.session.name}
 </p>
 <p className="text-xs text-[var(--color-text-2)]">{a.assignedDate}</p>
 </div>
 <span
 className={`text-xs font-medium px-2 py-0.5 rounded-full ${
 a.status === "COMPLETED"
 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
 : a.status === "SKIPPED"
 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)]"
 }`}
 >
 {a.status.toLowerCase()}
 </span>
 </Link>
 );
 })}
 </div>
 </div>
 )}
 </div>
 );
}

// ── Session Card ─────────────────────────────────────────────────────

function SessionCard({
 assignment,
 isActive,
 onStart,
 onSkip,
 onComplete,
  onRefresh: _onRefresh,
}: {
 assignment: Assignment;
 isActive: boolean;
 onStart: () => void;
 onSkip: (id: string, reason: string) => void;
 onComplete: (id: string, rpe: number, selfFeeling: string, feedbackNotes: string) => void;
 onRefresh: () => void;
}) {
 const sessionEvents = parseEvents(assignment.session.event);
 const eventMeta = EVENTS[sessionEvents[0]];
 const blocks = [...assignment.session.blocks].sort((a, b) => a.position - b.position);

 // Initialize completed blocks from existing throw logs + localStorage
 const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(() => {
 const fromLogs = new Set(assignment.throwLogs.map((l) => l.blockId));
 const fromStorage = getSavedBlocks(assignment.id);
 return new Set([...fromLogs, ...fromStorage]);
 });

 // Throw distance inputs per block
 const [throwInputs, setThrowInputs] = useState<Record<string, ThrowInput[]>>(() => {
 const inputs: Record<string, ThrowInput[]> = {};
 for (const block of blocks) {
 if (block.blockType !== "THROWING") continue;
 let config: ThrowingBlockConfig;
 try { config = JSON.parse(block.config); } catch { continue; }
 const existingLogs = assignment.throwLogs.filter((l) => l.blockId === block.id);
 const throwCount = config.throwCount || 6;
 inputs[block.id] = Array.from({ length: throwCount }, (_, i) => {
 const existing = existingLogs.find((l) => l.throwNumber === i + 1);
 return {
 throwNumber: i + 1,
 distance: existing?.distance?.toString() || "",
 implement: config.implementWeight || "",
 };
 });
 }
 return inputs;
 });

 // Expanded block (for throw input)
 const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

 // Saving state per block
 const [savingBlock, setSavingBlock] = useState<string | null>(null);

 // PR celebration
 const [prCelebration, setPrCelebration] = useState<PRResult | null>(null);

 // Skip modal
 const [showSkipModal, setShowSkipModal] = useState(false);
 const [skipReason, setSkipReason] = useState("");

 // Completion form
 const [showCompletionForm, setShowCompletionForm] = useState(false);
 const [completionRpe, setCompletionRpe] = useState(5);
 const [completionFeeling, setCompletionFeeling] = useState<SelfFeeling>("GOOD");
 const [completionNotes, setCompletionNotes] = useState("");
 const [submitting, setSubmitting] = useState(false);

 const allBlocksDone = blocks.every((b) => completedBlocks.has(b.id));
 const isStarted = assignment.status === "IN_PROGRESS" || isActive;
 const isCompleted = assignment.status === "COMPLETED";
 const isSkipped = assignment.status === "SKIPPED";

 // Save throw logs for a THROWING block
 const saveThrowLogs = async (blockId: string) => {
 const inputs = throwInputs[blockId];
 if (!inputs) return;

 let config: ThrowingBlockConfig;
 const block = blocks.find((b) => b.id === blockId);
 if (!block) return;
 try { config = JSON.parse(block.config); } catch { return; }

 setSavingBlock(blockId);

 // Save throw logs
 const throwsWithDistance = inputs.filter((t) => t.distance.trim() !== "");
 if (throwsWithDistance.length > 0) {
 await fetch("/api/throws/logs", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({
 assignmentId: assignment.id,
 blockId,
 throws: throwsWithDistance.map((t) => ({
 throwNumber: t.throwNumber,
 distance: parseFloat(t.distance) || null,
 implement: t.implement || config.implementWeight,
 })),
 }),
 });

 // Check for PR — find the best throw
 const bestThrow = throwsWithDistance.reduce(
 (best, t) => {
 const d = parseFloat(t.distance);
 return d > best ? d : best;
 },
 0
 );

 if (bestThrow > 0) {
 const prRes = await fetch("/api/throws/prs", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({
 event: assignment.session.event,
 implement: config.implementWeight,
 distance: bestThrow,
 source: "TRAINING",
 }),
 });
 const prData = await prRes.json();
 if (prData.success && prData.data.isNewPR) {
 setPrCelebration(prData.data);
 setTimeout(() => setPrCelebration(null), 5000);
 }
 }
 }

 // Mark block complete
 const newCompleted = new Set([...completedBlocks, blockId]);
 setCompletedBlocks(newCompleted);
 saveBlocks(assignment.id, Array.from(newCompleted));
 setExpandedBlock(null);
 setSavingBlock(null);
 };

 // Complete a non-throwing block
 const completeBlock = (blockId: string) => {
 const newCompleted = new Set([...completedBlocks, blockId]);
 setCompletedBlocks(newCompleted);
 saveBlocks(assignment.id, Array.from(newCompleted));
 };

 // Update a throw input
 const updateThrow = (blockId: string, throwNumber: number, distance: string) => {
 setThrowInputs((prev) => ({
 ...prev,
 [blockId]: prev[blockId].map((t) =>
 t.throwNumber === throwNumber ? { ...t, distance } : t
 ),
 }));
 };

 // Submit session completion
 const handleSubmitCompletion = async () => {
 setSubmitting(true);
 await onComplete(assignment.id, completionRpe, completionFeeling, completionNotes);
 setSubmitting(false);
 setShowCompletionForm(false);
 };

 if (isCompleted || isSkipped) {
 return (
 <div className="card space-y-3 opacity-80">
 <div className="flex items-start justify-between">
 <div>
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 {sessionEvents.map((ev) => (
 <span
 key={ev}
 className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
 style={{ backgroundColor: EVENTS[ev]?.color || "#666" }}
 >
 {EVENTS[ev]?.label || ev}
 </span>
 ))}
 </div>
 <h3 className="text-lg font-bold text-[var(--color-text)]">
 {assignment.session.name}
 </h3>
 </div>
 <span
 className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
 isCompleted
 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
 : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
 }`}
 >
 {isCompleted && (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 )}
 {isCompleted ? "Completed" : "Skipped"}
 </span>
 </div>
 {isCompleted && assignment.rpe && (
 <div className="flex items-center gap-4 text-sm text-[var(--color-text-2)]">
 <span>RPE: {assignment.rpe}/10</span>
 {assignment.selfFeeling && (
 <span>Feeling: {assignment.selfFeeling.toLowerCase().replace("_", " ")}</span>
 )}
 </div>
 )}
 </div>
 );
 }

 return (
 <div className="card space-y-4">
 {/* PR Celebration Banner */}
 {prCelebration && (
 <div className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 rounded-xl p-4 text-white animate-spring-up">
 <div className="flex items-center gap-3">
 <span className="text-3xl">🏆</span>
 <div>
 <p className="font-bold text-lg">NEW PERSONAL RECORD!</p>
 <p className="text-sm opacity-90">
 {prCelebration.previousDistance
 ? `+${prCelebration.improvement}m improvement over your previous best of ${prCelebration.previousDistance}m`
 : "First recorded PR — this is your benchmark!"}
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Session header */}
 <div className="flex items-start justify-between">
 <div>
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 {sessionEvents.map((ev) => (
 <span
 key={ev}
 className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
 style={{ backgroundColor: EVENTS[ev]?.color || "#666" }}
 >
 {EVENTS[ev]?.label || ev}
 </span>
 ))}
 <span className="text-xs text-[var(--color-text-3)]">
 {assignment.session.sessionType.replace(/_/g, " ")}
 </span>
 {isStarted && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
 In Progress
 </span>
 )}
 </div>
 <h3 className="text-lg font-bold text-[var(--color-text)]">
 {assignment.session.name}
 </h3>
 {assignment.session.notes && (
 <p className="text-sm text-[var(--color-text-2)] mt-1">
 {assignment.session.notes}
 </p>
 )}
 </div>
 <div className="flex items-center gap-2">
 {!isStarted && (
 <>
 <button
 onClick={() => setShowSkipModal(true)}
 className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-2)] hover:bg-[var(--color-bg-subtle)] transition-colors"
 >
 Skip
 </button>
 <button onClick={onStart} className="btn-primary">
 Start Session
 </button>
 </>
 )}
 {isStarted && !allBlocksDone && (
 <button
 onClick={() => setShowSkipModal(true)}
 className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-2)] hover:bg-[var(--color-bg-subtle)] transition-colors"
 >
 Skip
 </button>
 )}
 </div>
 </div>

 {/* Progress bar */}
 {isStarted && (
 <div>
 <div className="flex items-center justify-between text-xs text-[var(--color-text-2)] mb-1">
 <span>{completedBlocks.size} / {blocks.length} blocks</span>
 <span>{Math.round((completedBlocks.size / blocks.length) * 100)}%</span>
 </div>
 <div className="w-full h-2 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
 <div
 className="h-full bg-[var(--color-gold)] rounded-full transition-all duration-500"
 style={{ width: `${(completedBlocks.size / blocks.length) * 100}%` }}
 />
 </div>
 </div>
 )}

 {/* Block stepper */}
 <div className="space-y-2">
 {blocks.map((block) => {
 const isComplete = completedBlocks.has(block.id);
 const isExpanded = expandedBlock === block.id;
 const isSaving = savingBlock === block.id;
 let config: Record<string, unknown> = {};
 try {
 config = JSON.parse(block.config);
 } catch { /* noop */ }

 const isThrowingBlock = block.blockType === "THROWING";

 return (
 <div key={block.id}>
 <div
 className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
 isComplete
 ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
 : isExpanded
 ? "border-[rgba(212,168,67,0.3)] bg-[rgba(212,168,67,0.06)]"
 : "border-[var(--color-border)]"
 }`}
 >
 {isComplete ? (
 <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
 <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
 </svg>
 </div>
 ) : (
 <div className="w-6 h-6 rounded-full border-2 border-[var(--color-border-strong)] flex-shrink-0" />
 )}
 <div className="flex-1 min-w-0">
 <p
 className={`text-sm font-medium ${
 isComplete
 ? "text-green-700 dark:text-green-400 line-through"
 : "text-[var(--color-text)]"
 }`}
 >
 <BlockLabel block={block} config={config} eventMeta={eventMeta} />
 </p>
 </div>
 {isStarted && !isComplete && (
 isThrowingBlock ? (
 <button
 onClick={() => setExpandedBlock(isExpanded ? null : block.id)}
 className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium bg-[rgba(212,168,67,0.08)] text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] hover:bg-[rgba(212,168,67,0.15)] transition-colors"
 >
 {isExpanded ? "Collapse" : "Log Throws"}
 </button>
 ) : (
 <button
 onClick={() => completeBlock(block.id)}
 className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium bg-[rgba(212,168,67,0.08)] text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] hover:bg-[rgba(212,168,67,0.15)] transition-colors"
 >
 Done
 </button>
 )
 )}
 </div>

 {/* Expanded throw logging UI */}
 {isExpanded && isThrowingBlock && throwInputs[block.id] && (
 <div className="mt-2 ml-9 p-4 rounded-lg border border-[rgba(212,168,67,0.2)] bg-[var(--color-surface)]-900 space-y-3">
 <div className="flex items-center justify-between">
 <p className="text-xs font-semibold text-[var(--color-text-2)] uppercase tracking-wider">
 Log each throw (meters)
 </p>
 <span className="text-xs text-[var(--color-text-3)]">
 {(config as unknown as ThrowingBlockConfig).implementWeight}
 </span>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
 {throwInputs[block.id].map((t) => {
 const distances = throwInputs[block.id]
 .map((x) => parseFloat(x.distance))
 .filter((d) => !isNaN(d) && d > 0);
 const bestDistance = distances.length > 0 ? Math.max(...distances) : 0;
 const thisDistance = parseFloat(t.distance);
 const isBest = !isNaN(thisDistance) && thisDistance > 0 && thisDistance === bestDistance;

 return (
 <div key={t.throwNumber} className="relative">
 <label className="text-[10px] font-medium text-[var(--color-text-3)] mb-0.5 block">
 Throw {t.throwNumber}
 </label>
 <input
 type="number"
 step="0.01"
 min="0"
 placeholder="0.00"
 value={t.distance}
 onChange={(e) => updateThrow(block.id, t.throwNumber, e.target.value)}
 className={`input text-sm !py-1.5 ${
 isBest
 ? "!border-amber-400 !ring-amber-400/20 dark:!border-amber-500"
 : ""
 }`}
 />
 {isBest && (
 <span className="absolute -top-0.5 right-1 text-[10px] text-amber-500 font-bold">
 BEST
 </span>
 )}
 </div>
 );
 })}
 </div>

 {/* Block summary */}
 {(() => {
 const distances = throwInputs[block.id]
 .map((x) => parseFloat(x.distance))
 .filter((d) => !isNaN(d) && d > 0);
 if (distances.length === 0) return null;
 const avg = distances.reduce((s, d) => s + d, 0) / distances.length;
 const best = Math.max(...distances);
 return (
 <div className="flex items-center gap-4 text-xs text-[var(--color-text-2)] pt-2 border-t border-[var(--color-border)]">
 <span>
 Logged: <strong className="text-[var(--color-text-2)]">{distances.length}</strong>
 </span>
 <span>
 Avg: <strong className="text-[var(--color-text-2)]">{avg.toFixed(2)}m</strong>
 </span>
 <span>
 Best: <strong className="text-amber-600 dark:text-amber-400">{best.toFixed(2)}m</strong>
 </span>
 </div>
 );
 })()}

 <button
 onClick={() => saveThrowLogs(block.id)}
 disabled={isSaving}
 className="btn-primary w-full !py-2 text-sm"
 >
 {isSaving ? (
 <span className="flex items-center justify-center gap-2">
 <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
 </svg>
 Saving...
 </span>
 ) : (
 "Save & Complete Block"
 )}
 </button>
 </div>
 )}
 </div>
 );
 })}
 </div>

 {/* Completion form — appears when all blocks are done */}
 {isStarted && allBlocksDone && !showCompletionForm && (
 <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
 <div className="flex items-center gap-3">
 <div className="text-2xl">💪</div>
 <div className="flex-1">
 <p className="font-semibold text-green-800 dark:text-green-300">All blocks complete!</p>
 <p className="text-sm text-green-600 dark:text-green-400">
 Rate your session to finish up.
 </p>
 </div>
 <button
 onClick={() => setShowCompletionForm(true)}
 className="btn-primary !bg-green-600 hover:!bg-green-700"
 >
 Finish Session
 </button>
 </div>
 </div>
 )}

 {showCompletionForm && (
 <div className="border border-green-200 dark:border-green-800 rounded-xl p-5 space-y-5 bg-[var(--color-surface)]-900">
 <h4 className="font-semibold text-[var(--color-text)]">Session Feedback</h4>

 {/* RPE Slider */}
 <div>
 <label className="block text-sm font-medium text-[var(--color-text-2)] mb-2">
 Rate of Perceived Exertion (RPE): <strong className="text-[var(--color-gold-dark)]">{completionRpe}</strong>/10
 </label>
 <input
 type="range"
 min="1"
 max="10"
 step="1"
 value={completionRpe}
 onChange={(e) => setCompletionRpe(parseInt(e.target.value))}
 className="w-full accent-[var(--color-gold)]"
 />
 <div className="flex justify-between text-[10px] text-[var(--color-text-3)] mt-1">
 <span>Easy</span>
 <span>Moderate</span>
 <span>Max Effort</span>
 </div>
 </div>

 {/* Self-Feeling */}
 <div>
 <label className="block text-sm font-medium text-[var(--color-text-2)] mb-2">
 How did you feel?
 </label>
 <div className="flex flex-wrap gap-2">
 {SELF_FEELING_OPTIONS.map((opt) => (
 <button
 key={opt.value}
 onClick={() => setCompletionFeeling(opt.value)}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
 completionFeeling === opt.value
 ? "bg-[rgba(212,168,67,0.15)] text-[var(--color-gold-dark)] ring-2 ring-[rgba(212,168,67,0.4)] dark:text-[var(--color-gold-light)]"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)]"
 }`}
 >
 {opt.label}
 </button>
 ))}
 </div>
 </div>

 {/* Notes */}
 <div>
 <label className="block text-sm font-medium text-[var(--color-text-2)] mb-2">
 Notes (optional)
 </label>
 <textarea
 value={completionNotes}
 onChange={(e) => setCompletionNotes(e.target.value)}
 placeholder="Any notes about the session — technique cues, how throws felt, etc."
 rows={3}
 className="input resize-none"
 />
 </div>

 {/* Submit */}
 <div className="flex items-center gap-3">
 <button
 onClick={handleSubmitCompletion}
 disabled={submitting}
 className="btn-primary flex-1 !py-2.5"
 >
 {submitting ? (
 <span className="flex items-center justify-center gap-2">
 <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
 </svg>
 Submitting...
 </span>
 ) : (
 "Complete Session"
 )}
 </button>
 <button
 onClick={() => setShowCompletionForm(false)}
 className="px-4 py-2.5 rounded-lg text-sm text-[var(--color-text-2)] hover:bg-[var(--color-bg-subtle)] transition-colors"
 >
 Back
 </button>
 </div>
 </div>
 )}

 {/* Skip Modal */}
 {showSkipModal && (
 <div className="border border-red-200 dark:border-red-800 rounded-xl p-5 space-y-4 bg-[var(--color-surface)]-900">
 <h4 className="font-semibold text-[var(--color-text)]">Skip Session</h4>
 <div>
 <label className="block text-sm font-medium text-[var(--color-text-2)] mb-2">
 Reason (optional)
 </label>
 <textarea
 value={skipReason}
 onChange={(e) => setSkipReason(e.target.value)}
 placeholder="Injury, weather, schedule conflict..."
 rows={2}
 className="input resize-none"
 />
 </div>
 <div className="flex items-center gap-3">
 <button
 onClick={() => {
 onSkip(assignment.id, skipReason);
 setShowSkipModal(false);
 }}
 className="px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
 >
 Confirm Skip
 </button>
 <button
 onClick={() => {
 setShowSkipModal(false);
 setSkipReason("");
 }}
 className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-2)] hover:bg-[var(--color-bg-subtle)] transition-colors"
 >
 Cancel
 </button>
 </div>
 </div>
 )}
 </div>
 );
}

// ── Block Label ──────────────────────────────────────────────────────

function BlockLabel({
 block,
 config,
 eventMeta,
}: {
 block: Block;
 config: Record<string, unknown>;
 eventMeta: { label: string; color: string } | undefined;
}) {
 if (block.blockType === "THROWING" && config.implementWeight) {
 const tc = config as unknown as ThrowingBlockConfig;
 return (
 <>
 {tc.implementWeight} {eventMeta?.label || ""} — {tc.throwCount} throws at{" "}
 {tc.intensityMin}–{tc.intensityMax}%
 </>
 );
 }
 if (block.blockType === "STRENGTH" && config.exercises) {
 const sc = config as unknown as StrengthBlockConfig;
 const names = sc.exercises.map((e) => e.name).filter(Boolean).join(", ");
 return <>{names || "Strength"}</>;
 }
 if (block.blockType === "WARMUP") {
 const wc = config as unknown as WarmupCooldownConfig;
 return <>Warm-Up — {wc.duration || 15} min</>;
 }
 if (block.blockType === "COOLDOWN") {
 const cc = config as unknown as WarmupCooldownConfig;
 return <>Cool-Down — {cc.duration || 10} min</>;
 }
 if (block.blockType === "NOTES") {
 return <>Coach Notes</>;
 }
 if (block.blockType === "PLYOMETRIC" && config.exercises) {
 const sc = config as unknown as StrengthBlockConfig;
 const names = sc.exercises.map((e) => e.name).filter(Boolean).join(", ");
 return <>{names || "Plyometrics"}</>;
 }
 return <>{block.blockType}</>;
}
