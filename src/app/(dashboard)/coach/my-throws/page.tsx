"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { localToday } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";

// ── Types ─────────────────────────────────────────────────────────────

interface AthleteProfile {
 id: string;
 sport: string | null;
}

interface ThrowsPR {
 id: string;
 event: string;
 implement: string;
 distance: number;
 achievedAt: string;
 source: string | null;
}

interface ThrowsDrillLog {
 id: string;
 drillType: string;
 implementWeight: number | null;
 throwCount: number | null;
 bestMark: number | null;
 notes: string | null;
}

interface AthleteThrowsSession {
 id: string;
 event: string;
 date: string;
 notes: string | null;
 drillLogs: ThrowsDrillLog[];
}

// ── Constants ─────────────────────────────────────────────────────────

const THROW_EVENTS: { key: string; label: string; emoji: string; implements: string[] }[] = [
 {
 key: "SHOT_PUT",
 label: "Shot Put",
 emoji: "⚫",
 implements: ["4kg", "5kg", "6kg", "7.26kg", "Custom"],
 },
 {
 key: "DISCUS",
 label: "Discus",
 emoji: "🟡",
 implements: ["1kg", "1.5kg", "1.75kg", "2kg", "Custom"],
 },
 {
 key: "HAMMER",
 label: "Hammer",
 emoji: "🔵",
 implements: ["4kg", "5kg", "6kg", "7.26kg", "Custom"],
 },
 {
 key: "JAVELIN",
 label: "Javelin",
 emoji: "🟢",
 implements: ["400g", "500g", "600g", "700g", "800g", "Custom"],
 },
];

const EVENT_DISPLAY: Record<string, { label: string; emoji: string }> = {
 SHOT_PUT: { label: "Shot Put", emoji: "⚫" },
 DISCUS: { label: "Discus", emoji: "🟡" },
 HAMMER: { label: "Hammer", emoji: "🔵" },
 JAVELIN: { label: "Javelin", emoji: "🟢" },
};

// ── Helpers ──────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
 const today = localToday();
 const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
 if (dateStr === today) return "Today";
 if (dateStr === yesterday) return "Yesterday";
 return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", {
 month: "short",
 day: "numeric",
 year: "numeric",
 timeZone: "UTC",
 });
}

// ── PR Board ─────────────────────────────────────────────────────────

function PRBoard({ prs, athleteId: _athleteId }: { prs: ThrowsPR[]; athleteId: string }) {
 // Group PRs by event; pick the best per event
 const bestByEvent = THROW_EVENTS.map((ev) => {
 const evPRs = prs.filter((p) => p.event === ev.key);
 const best = evPRs.reduce<ThrowsPR | null>(
 (acc, cur) => (!acc || cur.distance > acc.distance ? cur : acc),
 null
 );
 return { event: ev, best };
 });

 return (
 <div className="card p-0 overflow-hidden">
 <div className="px-5 pt-5 pb-3">
 <h2 className="font-semibold text-[var(--color-text)]">
 Personal Records
 </h2>
 </div>
 <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-border)]">
 {bestByEvent.map(({ event, best }) => (
 <div key={event.key} className="px-5 py-4">
 <div className="flex items-center gap-2 mb-1">
 <span className="text-base">{event.emoji}</span>
 <span className="text-xs font-semibold text-[var(--color-text-2)] uppercase tracking-wider">
 {event.label}
 </span>
 </div>
 {best ? (
 <>
 <p className="text-2xl font-bold tabular-nums text-[var(--color-text)]">
 {best.distance.toFixed(2)}
 <span className="text-sm font-medium text-[var(--color-text-2)] ml-1">
 m
 </span>
 </p>
 <p className="text-xs text-[var(--color-text-3)] dark:text-[var(--color-text-2)] mt-0.5">
 {best.implement} · {formatDate(best.achievedAt)}
 </p>
 {/* Sub-PRs per implement */}
 {prs.filter((p) => p.event === event.key).length > 1 && (
 <div className="mt-2 space-y-0.5">
 {prs
 .filter((p) => p.event === event.key)
 .sort((a, b) => b.distance - a.distance)
 .slice(1, 4)
 .map((pr) => (
 <p
 key={pr.id}
 className="text-xs text-[var(--color-text-3)] dark:text-[var(--color-text-2)] tabular-nums"
 >
 {pr.implement}: {pr.distance.toFixed(2)} m
 </p>
 ))}
 </div>
 )}
 </>
 ) : (
 <p className="text-sm text-[var(--color-text-3)] dark:text-[var(--color-text-2)] mt-1">
 No PR yet
 </p>
 )}
 </div>
 ))}
 </div>
 {prs.length > 0 && (
 <div className="px-5 py-3 border-t border-[var(--color-border)]">
 <Link
 href={`/coach/athletes`}
 className="text-xs text-[var(--color-text-3)] dark:text-[var(--color-text-2)]"
 >
 {prs.length} PR{prs.length !== 1 ? "s" : ""} recorded
 </Link>
 </div>
 )}
 </div>
 );
}

// ── Log Session Form ──────────────────────────────────────────────────

interface LogSessionFormProps {
 athleteId: string;
 onLogged: () => void;
 onCancel: () => void;
}

function LogSessionForm({ athleteId, onLogged, onCancel }: LogSessionFormProps) {
 const [event, setEvent] = useState("SHOT_PUT");
 const [date, setDate] = useState(localToday());
 const [implement, setImplement] = useState("");
 const [customImplement, setCustomImplement] = useState("");
 const [throws, setThrows] = useState<string[]>(["", "", "", "", "", ""]);
 const [notes, setNotes] = useState("");
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");
 const [prResult, setPrResult] = useState<{ isNewPR: boolean; improvement: number | null } | null>(null);

 const selectedEvent = THROW_EVENTS.find((e) => e.key === event)!;
 const effectiveImplement = implement === "Custom" ? customImplement : implement;

 const filledThrows = throws.filter((t) => t.trim() !== "" && !isNaN(parseFloat(t)));
 const bestMark = filledThrows.length > 0
 ? Math.max(...filledThrows.map(parseFloat))
 : null;

 async function handleSubmit(e: React.FormEvent) {
 e.preventDefault();
 if (!event || !date) return;

 setSaving(true);
 setError("");
 setPrResult(null);

 try {
 // Build drill log entry
 const drillLogs = [];
 if (filledThrows.length > 0) {
 drillLogs.push({
 drillType: "COMPETITION_THROW",
 implementWeight: effectiveImplement
 ? parseFloat(effectiveImplement.replace(/[^0-9.]/g, "")) || null
 : null,
 throwCount: filledThrows.length,
 bestMark,
 notes: throws.filter(Boolean).join(", ") + " m",
 });
 }

 const sessionRes = await fetch("/api/throws/athlete-sessions", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({
 athleteId,
 event,
 date,
 notes: notes || null,
 drillLogs,
 }),
 });
 const sessionData = await sessionRes.json();
 if (!sessionData.success) {
 setError(sessionData.error ?? "Failed to log session");
 return;
 }

 // Check / update PR if a mark was thrown
 if (bestMark && effectiveImplement) {
 const prRes = await fetch("/api/throws/prs", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({
 event,
 implement: effectiveImplement,
 distance: bestMark,
 source: "TRAINING",
 athleteId,
 }),
 });
 const prData = await prRes.json();
 if (prData.success) {
 setPrResult({
 isNewPR: prData.data.isNewPR,
 improvement: prData.data.improvement ?? null,
 });
 }
 }

 onLogged();
 } catch {
 setError("Network error — please try again");
 } finally {
 setSaving(false);
 }
 }

 return (
 <form
 onSubmit={handleSubmit}
 className="card p-5 space-y-4 animate-spring-up"
 >
 <div className="flex items-center justify-between">
 <h3 className="font-semibold text-[var(--color-text)]">
 Log Throw Session
 </h3>
 <button
 type="button"
 onClick={onCancel}
 className="text-[var(--color-text-3)] hover:text-[var(--color-text-2)] dark:hover:text-[var(--color-text-3)]"
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {/* Event + Date */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="label block mb-1.5">Event</label>
 <select
 value={event}
 onChange={(e) => { setEvent(e.target.value); setImplement(""); }}
 className="input w-full"
 >
 {THROW_EVENTS.map((ev) => (
 <option key={ev.key} value={ev.key}>
 {ev.emoji} {ev.label}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="label block mb-1.5">Date</label>
 <input
 type="date"
 value={date}
 onChange={(e) => setDate(e.target.value)}
 className="input w-full"
 />
 </div>
 </div>

 {/* Implement */}
 <div>
 <label className="label block mb-1.5">Implement</label>
 <div className="flex gap-2 flex-wrap">
 {selectedEvent.implements.map((imp) => (
 <button
 key={imp}
 type="button"
 onClick={() => setImplement(imp)}
 className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
 implement === imp
 ? "bg-[var(--color-gold)] text-white"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] hover:bg-[var(--color-bg-subtle)] "
 }`}
 >
 {imp}
 </button>
 ))}
 </div>
 {implement === "Custom" && (
 <input
 type="text"
 placeholder="e.g. 6.5kg"
 value={customImplement}
 onChange={(e) => setCustomImplement(e.target.value)}
 className="input w-full mt-2"
 />
 )}
 </div>

 {/* Individual throw distances */}
 <div>
 <label className="label block mb-1.5">Throws (metres)</label>
 <div className="grid grid-cols-3 gap-2">
 {throws.map((t, i) => (
 <div key={i} className="relative">
 <input
 type="number"
 step="0.01"
 min="0"
 placeholder={`#${i + 1}`}
 value={t}
 onChange={(ev) => {
 const next = [...throws];
 next[i] = ev.target.value;
 setThrows(next);
 }}
 className="input w-full text-center"
 />
 </div>
 ))}
 </div>
 {bestMark !== null && (
 <p className="text-xs text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] font-medium mt-2">
 Best: {bestMark.toFixed(2)} m
 </p>
 )}
 </div>

 {/* Notes */}
 <div>
 <label className="label block mb-1.5">Session Notes</label>
 <textarea
 rows={2}
 placeholder="Conditions, technique cues, how it felt…"
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 className="input w-full resize-none"
 />
 </div>

 {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
 {prResult?.isNewPR && (
 <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-300">
 🏆 New PR!
 {prResult.improvement
 ? ` +${prResult.improvement.toFixed(2)} m improvement`
 : ""}
 </div>
 )}

 <div className="flex gap-2">
 <button
 type="submit"
 disabled={saving}
 className="btn-primary flex-1 py-2.5"
 >
 {saving ? "Saving…" : "Save Session"}
 </button>
 <button
 type="button"
 onClick={onCancel}
 className="px-4 py-2.5 rounded-xl text-sm font-medium bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] hover:bg-[var(--color-bg-subtle)] transition-colors"
 >
 Cancel
 </button>
 </div>
 </form>
 );
}

// ── Recent Sessions ───────────────────────────────────────────────────

function RecentSessions({ sessions }: { sessions: AthleteThrowsSession[] }) {
 if (sessions.length === 0) {
 return (
 <div className="card p-5 text-center">
 <p className="text-sm text-[var(--color-text-3)] dark:text-[var(--color-text-2)] py-4">
 No throw sessions logged yet
 </p>
 </div>
 );
 }

 return (
 <div className="card p-0 overflow-hidden">
 <div className="px-5 pt-5 pb-3">
 <h2 className="font-semibold text-[var(--color-text)]">
 Recent Sessions
 </h2>
 </div>
 <div className="divide-y divide-[var(--color-border)]">
 {sessions.slice(0, 8).map((session) => {
 const ev = EVENT_DISPLAY[session.event];
 const bestLog = session.drillLogs.reduce<ThrowsDrillLog | null>(
 (acc, cur) => {
 if (cur.bestMark === null) return acc;
 if (!acc || !acc.bestMark || cur.bestMark > acc.bestMark) return cur;
 return acc;
 },
 null
 );

 return (
 <div key={session.id} className="px-5 py-3 flex items-start gap-3">
 <div className="w-9 h-9 rounded-xl bg-[var(--color-bg-subtle)] flex items-center justify-center flex-shrink-0 text-base">
 {ev?.emoji ?? "🎯"}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-[var(--color-text)]">
 {ev?.label ?? session.event}
 </p>
 <p className="text-xs text-[var(--color-text-2)] mt-0.5">
 {formatDate(session.date)}
 {session.drillLogs.length > 0 &&
 ` · ${session.drillLogs.reduce((acc, l) => acc + (l.throwCount ?? 0), 0)} throws`}
 </p>
 {session.notes && (
 <p className="text-xs text-[var(--color-text-3)] dark:text-[var(--color-text-2)] mt-0.5 truncate">
 {session.notes}
 </p>
 )}
 </div>
 {bestLog?.bestMark && (
 <div className="text-right flex-shrink-0">
 <p className="text-sm font-bold tabular-nums text-[var(--color-text)]">
 {bestLog.bestMark.toFixed(2)}
 <span className="text-xs font-medium text-[var(--color-text-3)] ml-0.5">m</span>
 </p>
 {bestLog.implementWeight && (
 <p className="text-xs text-[var(--color-text-3)] dark:text-[var(--color-text-2)]">
 {bestLog.implementWeight}kg
 </p>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 );
}

// ── Setup Redirect ────────────────────────────────────────────────────

function NoProfileScreen() {
 return (
 <div className="max-w-md mx-auto px-4 py-16 animate-spring-up">
 <div className="card p-8 text-center space-y-5">
 <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto text-2xl">
 🎯
 </div>
 <div>
 <h1
 className="text-xl font-bold text-[var(--color-text)]"
 style={{ fontFamily: "var(--font-outfit)" }}
 >
 Set Up My Training First
 </h1>
 <p className="text-sm text-[var(--color-text-2)] mt-2 leading-relaxed">
 To track your own throws, first set up your personal training
 profile. It only takes a moment.
 </p>
 </div>
 <Link href="/coach/my-training" className="btn-primary block w-full py-3 text-center">
 Set Up My Training
 </Link>
 </div>
 </div>
 );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function CoachMyThrowsPage() {
 const [profile, setProfile] = useState<AthleteProfile | null | undefined>(undefined);
 const [prs, setPrs] = useState<ThrowsPR[]>([]);
 const [sessions, setSessions] = useState<AthleteThrowsSession[]>([]);
 const [loading, setLoading] = useState(false);
 const [showLogForm, setShowLogForm] = useState(false);

 // Load profile
 useEffect(() => {
 fetch("/api/coach/my-athlete-profile")
 .then((r) => r.json())
 .then((d) => setProfile(d.success ? (d.data ?? null) : null))
 .catch(() => setProfile(null));
 }, []);

 // Load PRs and sessions when profile is ready
 const loadData = useCallback(async (athleteId: string) => {
 setLoading(true);
 try {
 const [prRes, sessRes] = await Promise.all([
 fetch(`/api/throws/prs?athleteId=${athleteId}`),
 fetch(`/api/throws/athlete-sessions?athleteId=${athleteId}`),
 ]);
 const [prData, sessData] = await Promise.all([prRes.json(), sessRes.json()]);
 if (prData.success) setPrs(prData.data ?? []);
 if (sessData.success) setSessions(sessData.data ?? []);
 } catch (err) {
 console.error(err);
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 if (profile?.id) {
 loadData(profile.id);
 }
 }, [profile, loadData]);

 // Loading
 if (profile === undefined) {
 return (
 <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-pulse">
 <div className="h-8 w-44 bg-[var(--color-bg-subtle)] rounded" />
 <div className="card p-5">
 <div className="grid grid-cols-2 gap-4">
 {[0, 1, 2, 3].map((i) => (
 <div key={i} className="h-20 bg-[var(--color-bg-subtle)] rounded-xl" />
 ))}
 </div>
 </div>
 </div>
 );
 }

 // No profile
 if (profile === null) return <NoProfileScreen />;

 return (
 <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
 {/* ── Header ── */}
 <div className="flex items-start justify-between gap-4">
 <div>
 <h1
 className="text-2xl font-bold text-[var(--color-text)]"
 style={{ fontFamily: "var(--font-outfit)" }}
 >
 My Throws
 </h1>
 <p className="text-sm text-[var(--color-text-2)] mt-0.5">
 {sessions.length} session{sessions.length !== 1 ? "s" : ""} logged ·{" "}
 {prs.length} PR{prs.length !== 1 ? "s" : ""}
 </p>
 </div>

 <button
 onClick={() => setShowLogForm(true)}
 className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Log Session
 </button>
 </div>

 {/* ── Log form ── */}
 {showLogForm && (
 <LogSessionForm
 athleteId={profile.id}
 onLogged={() => {
 setShowLogForm(false);
 loadData(profile.id);
 }}
 onCancel={() => setShowLogForm(false)}
 />
 )}

 {loading ? (
 <div className="space-y-4 animate-pulse">
 {[0, 1].map((i) => (
 <div key={i} className="card p-5">
 <div className="h-4 w-32 bg-[var(--color-bg-subtle)] rounded mb-4" />
 <div className="grid grid-cols-2 gap-4">
 {[0, 1, 2, 3].map((j) => (
 <div key={j} className="h-16 bg-[var(--color-bg-subtle)] rounded-xl" />
 ))}
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="space-y-4 animate-spring-up">
 {/* PR Board */}
 <PRBoard prs={prs} athleteId={profile.id} />

 {/* Recent sessions */}
 <RecentSessions sessions={sessions} />

 {/* Link to full athlete throws dashboard */}
 <div className="card p-4 flex items-center justify-between">
 <div>
 <p className="text-sm font-medium text-[var(--color-text)]">
 Assigned Throw Sessions
 </p>
 <p className="text-xs text-[var(--color-text-2)] mt-0.5">
 View sessions assigned to you by another coach
 </p>
 </div>
 <Link
 href="/athlete/throws"
 className="text-sm font-medium text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] hover:text-[var(--color-gold-dark)] dark:hover:text-[var(--color-gold-light)] flex items-center gap-1 flex-shrink-0"
 >
 View
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </Link>
 </div>
 </div>
 )}
 </div>
 );
}
