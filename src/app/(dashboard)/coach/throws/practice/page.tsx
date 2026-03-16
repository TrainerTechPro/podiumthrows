"use client";

import { useState, useEffect, useCallback } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PracticeSessionSummary {
 id: string;
 name: string;
 date: string;
 status: string;
 notes: string | null;
 createdAt: string;
 _count: { attempts: number };
}

function formatDate(dateStr: string): string {
 return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
 weekday: "short",
 month: "short",
 day: "numeric",
 year: "numeric",
 });
}

export default function PracticeSessionsPage() {
 const router = useRouter();
 const [sessions, setSessions] = useState<PracticeSessionSummary[]>([]);
 const [loading, setLoading] = useState(true);

 // New session form
 const [showForm, setShowForm] = useState(false);
 const [formName, setFormName] = useState("");
 const [formNotes, setFormNotes] = useState("");
 const [creating, setCreating] = useState(false);
 const [createError, setCreateError] = useState("");

 const today = new Date().toISOString().slice(0, 10);

 const fetchSessions = useCallback(() => {
 setLoading(true);
 fetch("/api/throws/practice")
 .then((r) => r.json())
 .then((data) => {
 if (data.success) setSessions(data.data);
 setLoading(false);
 })
 .catch(() => setLoading(false));
 }, []);

 useEffect(() => {
 fetchSessions();
 }, [fetchSessions]);

 async function handleCreate(e: React.FormEvent) {
 e.preventDefault();
 if (!formName.trim()) return;
 setCreating(true);
 setCreateError("");
 try {
 const res = await fetch("/api/throws/practice", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({ name: formName.trim(), date: today, notes: formNotes || undefined }),
 });
 const data = await res.json();
 if (data.success) {
 router.push(`/coach/throws/practice/${data.data.id}`);
 } else {
 setCreateError(data.error || "Failed to create session");
 setCreating(false);
 }
 } catch {
 setCreateError("Failed to create session");
 setCreating(false);
 }
 }

 if (loading) {
 return (
 <div className="animate-spring-up space-y-4">
 <div className="skeleton h-8 w-56" />
 <div className="skeleton h-12 rounded-xl" />
 {[1, 2, 3].map((i) => (
 <div key={i} className="skeleton h-20 rounded-xl" />
 ))}
 </div>
 );
 }

 const activeSessions = sessions.filter((s) => s.status === "ACTIVE");
 const closedSessions = sessions.filter((s) => s.status === "CLOSED");

 return (
 <div className="animate-spring-up space-y-6">
 {/* Header */}
 <div className="flex items-start justify-between gap-3 flex-wrap">
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">
 Practice Sessions
 </h1>
 <p className="text-sm text-[var(--color-text-2)] mt-0.5">
 Live attempt logging for Podium Throws athletes
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Link
 href="/coach/throws"
 className="text-sm text-[var(--color-text-2)] hover:text-[var(--color-text)] font-medium"
 >
 Dashboard
 </Link>
 <button
 onClick={() => { setShowForm(true); setFormName(`Practice ${formatDate(today)}`); }}
 className="btn-primary flex items-center gap-1.5 text-sm px-4 py-2"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Start Practice
 </button>
 </div>
 </div>

 {/* Start Practice form */}
 {showForm && (
 <div className="card !p-5 border-2 border-[rgba(212,168,67,0.2)] space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="font-semibold text-[var(--color-text)] text-sm">
 New Practice Session
 </h3>
 <button
 onClick={() => setShowForm(false)}
 className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-text-2)] rounded-lg"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 <form onSubmit={handleCreate} className="space-y-3">
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">
 Session name
 </label>
 <input
 type="text"
 value={formName}
 onChange={(e) => setFormName(e.target.value)}
 required
 className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
 placeholder="e.g. Monday Morning Practice"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">
 Notes <span className="font-normal text-[var(--color-text-3)]">(optional)</span>
 </label>
 <textarea
 value={formNotes}
 onChange={(e) => setFormNotes(e.target.value)}
 rows={2}
 className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)] resize-none"
 placeholder="Focus areas, weather, venue…"
 />
 </div>
 {createError && (
 <p className="text-xs text-red-600 dark:text-red-400">{createError}</p>
 )}
 <div className="flex gap-2 pt-1">
 <button
 type="button"
 onClick={() => setShowForm(false)}
 className="btn-secondary text-sm px-4 py-2"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={creating || !formName.trim()}
 className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5 disabled:opacity-60"
 >
 {creating ? (
 <>
 <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
 Starting…
 </>
 ) : (
 <>
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
 </svg>
 Start Session
 </>
 )}
 </button>
 </div>
 </form>
 </div>
 )}

 {/* Empty state */}
 {sessions.length === 0 && !showForm && (
 <div className="card text-center py-16 space-y-4">
 <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto">
 <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 </div>
 <div>
 <p className="font-semibold text-[var(--color-text)] text-sm">
 No practice sessions yet
 </p>
 <p className="text-xs text-[var(--color-text-3)] mt-1 max-w-xs mx-auto">
 Start a live session to log attempts, distances, drill types, and coaching notes in real time.
 </p>
 </div>
 <button
 onClick={() => { setShowForm(true); setFormName(`Practice ${formatDate(today)}`); }}
 className="btn-primary text-sm px-5 py-2 mx-auto"
 >
 Start Your First Session
 </button>
 </div>
 )}

 {/* Active sessions */}
 {activeSessions.length > 0 && (
 <div className="space-y-3">
 <h2 className="text-sm font-semibold text-[var(--color-text-2)] flex items-center gap-2">
 <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
 Active
 </h2>
 {activeSessions.map((session) => (
 <SessionCard key={session.id} session={session} />
 ))}
 </div>
 )}

 {/* Closed sessions */}
 {closedSessions.length > 0 && (
 <div className="space-y-3">
 <h2 className="text-sm font-semibold text-[var(--color-text-2)]">
 Past Sessions
 </h2>
 {closedSessions.map((session) => (
 <SessionCard key={session.id} session={session} />
 ))}
 </div>
 )}
 </div>
 );
}

function SessionCard({ session }: { session: PracticeSessionSummary }) {
 const isActive = session.status === "ACTIVE";
 return (
 <Link
 href={`/coach/throws/practice/${session.id}`}
 className="card !p-4 flex items-center gap-4 hover:shadow-md transition-shadow group"
 >
 {/* Status indicator */}
 <div
 className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
 isActive
 ? "bg-emerald-100 dark:bg-emerald-900/30"
 : "bg-[var(--color-bg-subtle)]"
 }`}
 >
 {isActive ? (
 <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
 </svg>
 ) : (
 <svg className="w-5 h-5 text-[var(--color-text-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 )}
 </div>

 {/* Info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <p className="font-semibold text-[var(--color-text)] text-sm truncate">
 {session.name}
 </p>
 {isActive && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex-shrink-0">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
 Active
 </span>
 )}
 </div>
 <div className="flex items-center gap-3 mt-0.5">
 <p className="text-xs text-[var(--color-text-2)]">
 {formatDate(session.date)}
 </p>
 <p className="text-xs text-[var(--color-text-3)]">
 {session._count.attempts} attempt{session._count.attempts !== 1 ? "s" : ""}
 </p>
 </div>
 </div>

 <svg className="w-4 h-4 text-[var(--color-border-strong)] group-hover:text-[var(--color-gold)] flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </Link>
 );
}
