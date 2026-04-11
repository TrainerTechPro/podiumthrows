"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import {
 EVENTS,
 type ThrowEvent,
} from "@/lib/throws/constants";
import { csrfHeaders } from "@/lib/csrf-client";
import {
 SELF_FEELING_SCALE,
 SLEEP_QUALITY_SCALE,
 ENERGY_SCALE,
 SORENESS_LABELS,
 SORENESS_ZONES,
} from "@/lib/throws/profile-constants";
import {
 calcReadiness,
 todayISO,
} from "@/lib/throws/profile-utils";
import {
 DEFICIT_TYPE_LABELS,
 DEFICIT_LEVEL_COLORS,
 DEFICIT_LEVEL_BG,
 DEFICIT_TRAINING_RECS,
 type DeficitType,
 type DeficitLevel,
} from "@/lib/throws/podium-profile";

// ── Constants ──────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
 SP: "Shot Put", DT: "Discus", HT: "Hammer", JT: "Javelin",
};
const EVENT_COLORS: Record<string, string> = {
 SP: "#D4915A", DT: "#6A9FD8", HT: "#5BB88A", JT: "#D46A6A",
};

// ── Score Arc SVG Component ─────────────────────────────────────────

function ScoreArc({
 score,
 label,
 sublabel,
 color,
 size = 110,
}: {
 score: number | null;
 label: string;
 sublabel: string;
 color: string;
 size?: number;
}) {
 const radius = (size - 12) / 2;
 const circumference = 2 * Math.PI * radius;
 const progress = score != null ? (score / 100) * circumference : 0;

 return (
 <div className="flex flex-col items-center gap-2">
 <div className="relative" style={{ width: size, height: size }}>
 <svg width={size} height={size} className="-rotate-90">
 <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" className="text-[var(--card-border)]" strokeWidth={8} />
 <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - progress} className="transition-all duration-700" />
 </svg>
 <div className="absolute inset-0 flex items-center justify-center">
 <span className="text-xl font-bold text-[var(--foreground)] font-mono">
 {score != null ? score : "—"}
 </span>
 </div>
 </div>
 <div className="text-center">
 <p className="text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wider">{label}</p>
 <p className="text-[10px] text-surface-700 dark:text-surface-300">{sublabel}</p>
 </div>
 </div>
 );
}

export default function AthleteProfilePage() {
 const [athleteId, setAthleteId] = useState<string | null>(null);
 const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(false);
 const [showCheckIn, setShowCheckIn] = useState(false);
 const [showAddPR, setShowAddPR] = useState(false);
 const [checkInData, setCheckInData] = useState({
 selfFeeling: 3,
 sleepHours: 7,
 sleepQuality: 3,
 energy: 5,
 soreness: { shoulder: 0, back: 0, hip: 0, knee: 0, elbow: 0, wrist: 0, general: 0 } as Record<string, number>,
 notes: "",
 });
 const [saving, setSaving] = useState(false);
 const [saveError, setSaveError] = useState("");
 const [prForm, setPrForm] = useState({ event: "SHOT_PUT", implement: "", distance: "" });
 const [savingPR, setSavingPR] = useState(false);
 const [prError, setPrError] = useState("");
 const [podiumProfile, setPodiumProfile] = useState<Record<string, unknown> | null>(null);

 const loadProfile = useCallback(async (id: string) => {
 setError(false);
 try {
 const res = await fetch(`/api/throws/profile?athleteId=${id}`);
 const data = await res.json();
 if (data.success) {
 setProfile(data.data);
 } else {
 setError(true);
 }
 } catch {
 setError(true);
 }
 setLoading(false);
 }, []);

 useEffect(() => {
 fetch("/api/athletes")
 .then((r) => r.json())
 .then((data) => {
 if (data.success && data.data) {
 const athletes = Array.isArray(data.data) ? data.data : [data.data];
 if (athletes[0]?.id) {
 const id = athletes[0].id;
 setAthleteId(id);
 loadProfile(id);
 // Fetch Podium Throws enrollment (may 404 if not enrolled — that's fine)
 fetch(`/api/throws/podium-roster/${id}`)
 .then((r) => r.json())
 .then((d) => { if (d.success) setPodiumProfile(d.data); })
 .catch(() => {});
 } else {
 setLoading(false);
 }
 } else {
 setLoading(false);
 }
 })
 .catch(() => setLoading(false));
 }, [loadProfile]);

 async function handleCheckIn() {
 if (!athleteId) return;
 setSaving(true);
 setSaveError("");
 try {
 await fetch("/api/throws/checkins", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({
 athleteId,
 date: todayISO(),
 selfFeeling: checkInData.selfFeeling,
 sleepHours: checkInData.sleepHours,
 sleepQuality: checkInData.sleepQuality,
 energy: checkInData.energy,
 sorenessGeneral: checkInData.soreness.general,
 sorenessShoulder: checkInData.soreness.shoulder,
 sorenessBack: checkInData.soreness.back,
 sorenessHip: checkInData.soreness.hip,
 sorenessKnee: checkInData.soreness.knee,
 sorenessElbow: checkInData.soreness.elbow,
 sorenessWrist: checkInData.soreness.wrist,
 notes: checkInData.notes || null,
 }),
 });
 setShowCheckIn(false);
 if (athleteId) loadProfile(athleteId);
 } catch {
 setSaveError("Failed to save check-in. Please try again.");
 }
 setSaving(false);
 }

 async function handleRecordPR() {
 if (!prForm.implement || !prForm.distance) return;
 setSavingPR(true);
 setPrError("");
 try {
 const res = await fetch("/api/throws/prs", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({
 event: prForm.event,
 implement: prForm.implement,
 distance: parseFloat(prForm.distance),
 source: "MANUAL",
 }),
 });
 const data = await res.json();
 if (data.success) {
 setShowAddPR(false);
 setPrForm({ event: "SHOT_PUT", implement: "", distance: "" });
 if (athleteId) loadProfile(athleteId);
 }
 } catch {
 setPrError("Failed to save PR. Please try again.");
 }
 setSavingPR(false);
 }

 if (loading) {
 return (
 <div className="animate-spring-up space-y-4">
 <div className="skeleton h-8 w-48" />
 {[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
 </div>
 );
 }

 const p = profile as {
 athlete: { firstName: string; lastName: string; gender: string | null };
 typing: { selfFeelingAccuracy: string | null; adaptationGroup: number | null; transferType: string | null; recoveryProfile: string | null; recommendedMethod: string | null; optimalComplexDuration: string | null; estimatedSessionsToForm: number | null; quizCompletedDate: string | null; quizAssignedByCoach: boolean } | null;
 checkins: Array<{ date: string; selfFeeling: number; sleepHours: number | null; sleepQuality: number | null; energy: number | null; sorenessGeneral: number | null; sorenessShoulder: number | null; sorenessBack: number | null; sorenessHip: number | null; sorenessKnee: number | null; sorenessElbow: number | null; sorenessWrist: number | null }>;
 prs: Array<{ event: string; distance: number }>;
 competitionMarks: Array<{ date: string; distance: number; implement: string }>;
 } | null;

 const today = todayISO();
 const todayCheckin = p?.checkins?.find((c) => c.date === today);
 const selfFeelingAccuracy = (p?.typing?.selfFeelingAccuracy as "accurate" | "moderate" | "poor") || "moderate";
 const readiness = todayCheckin
 ? calcReadiness(todayCheckin, selfFeelingAccuracy)
 : { score: null, label: "No check-in today", color: "#6B7280" };
 const feelingMeta = SELF_FEELING_SCALE.find((s) => s.value === checkInData.selfFeeling);

 return (
 <div className="animate-spring-up space-y-6">
 <ScrollProgressBar />
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">My Profile</h1>
 <p className="text-sm text-surface-700 dark:text-surface-300">Readiness, recovery, and athlete typing</p>
 </div>
 <Link href="/athlete/throws" className="text-sm text-primary-600 dark:text-primary-300 hover:text-primary-600 font-medium">
 Sessions
 </Link>
 </div>

 {!p ? (
 <div className="card text-center py-12 space-y-4">
 <div className="w-14 h-14 mx-auto rounded-full bg-[var(--muted-bg)] flex items-center justify-center">
 <svg className="w-7 h-7 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
 </svg>
 </div>
 <div>
 <p className="font-medium text-surface-700 dark:text-surface-300">
 {error ? "Could not load profile" : "No profile data yet"}
 </p>
 <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">
 {error
 ? "There was a problem loading your profile. Try again."
 : "Start by recording a personal record or completing a daily check-in."}
 </p>
 </div>
 {error && athleteId ? (
 <button
 onClick={() => { setLoading(true); loadProfile(athleteId); }}
 className="btn-secondary text-sm px-5 py-2"
 >
 Try Again
 </button>
 ) : (
 <div className="flex justify-center gap-3">
 <Link href="/athlete/throws" className="btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
 </svg>
 View Sessions
 </Link>
 </div>
 )}
 </div>
 ) : (
 <>
 {/* Headline scores */}
 <div className="grid grid-cols-2 gap-4">
 <div className="card !p-4 flex justify-center">
 <ScoreArc score={readiness.score} label="Readiness" sublabel={readiness.label} color={readiness.color} />
 </div>
 <div className="card !p-4 flex justify-center">
 <ScoreArc
 score={p.prs.length > 0 ? 72 : null}
 label="Transfer"
 sublabel={p.prs.length > 0 ? "Exercise transfer" : "No data yet"}
 color="#5BB88A"
 />
 </div>
 </div>

 {/* Quiz prompt — assigned but not yet completed */}
 {p.typing?.quizAssignedByCoach && !p.typing?.quizCompletedDate && (
 <Link
 href="/athlete/throws/quiz"
 className="block card card-interactive !p-4 border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
 >
 <div className="flex items-start gap-3">
 <div className="w-9 h-9 flex-shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
 <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
 </svg>
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Action Required</span>
 </div>
 <p className="text-sm font-bold text-[var(--foreground)] mt-0.5">Complete your Athlete Typing Quiz</p>
 <p className="text-xs text-surface-700 dark:text-surface-300 mt-0.5">Your coach assigned this quiz. Takes ~5 minutes — tap to start.</p>
 </div>
 <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </div>
 </Link>
 )}

 {/* Podium Throws enrollment card */}
 {podiumProfile && (() => {
 const pp = podiumProfile as {
 event: string;
 gender: string;
 competitionPb: number | null;
 currentDistanceBand: string | null;
 deficitPrimary: string | null;
 deficitStatus: string | null;
 };
 const deficitType = pp.deficitPrimary as DeficitType | null;
 const deficitLevel = pp.deficitStatus as DeficitLevel | null;
 const eventLabel = EVENT_LABELS[pp.event] ?? pp.event;
 const eventColor = EVENT_COLORS[pp.event] ?? "#d4a843";
 const hasDeficit = deficitType && deficitType !== "none" && deficitType !== "balanced";

 return (
 <div className="card !p-4 space-y-3">
 {/* Header */}
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">
 Podium Throws
 </h3>
 <span
 className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white flex-shrink-0"
 style={{ backgroundColor: eventColor }}
 >
 {eventLabel}
 <span className="opacity-80">{pp.gender === "M" ? "♂" : "♀"}</span>
 </span>
 {pp.competitionPb && (
 <span className="text-[11px] font-mono text-surface-700 dark:text-surface-300 flex-shrink-0">
 {pp.competitionPb.toFixed(2)}m
 {pp.currentDistanceBand && (
 <span className="font-sans ml-1 text-muted">
 Band {pp.currentDistanceBand}m
 </span>
 )}
 </span>
 )}
 </div>

 {/* Deficit + training focus */}
 {deficitType && deficitType !== "none" ? (
 <div className={`rounded-xl p-3 space-y-1.5 ${deficitLevel ? DEFICIT_LEVEL_BG[deficitLevel] : "bg-[var(--muted-bg)]/50"}`}>
 <div className="flex items-center gap-2">
 <span className={`text-xs font-bold uppercase tracking-wide ${deficitLevel ? DEFICIT_LEVEL_COLORS[deficitLevel] : "text-surface-700 dark:text-surface-300"}`}>
 {hasDeficit ? "Training Focus" : "Status"}
 </span>
 <span className={`text-xs font-medium ${deficitLevel ? DEFICIT_LEVEL_COLORS[deficitLevel] : "text-surface-700 dark:text-surface-300"}`}>
 {DEFICIT_TYPE_LABELS[deficitType]}
 </span>
 </div>
 <p className="text-[11px] text-surface-700 dark:text-surface-300 leading-relaxed">
 {DEFICIT_TRAINING_RECS[deficitType]}
 </p>
 </div>
 ) : (
 <p className="text-xs text-muted italic">
 Your coach hasn&apos;t recorded test data yet. Check back after your next testing session.
 </p>
 )}
 </div>
 );
 })()}

 {/* PRs */}
 <div className="card !p-4 space-y-3">
 <div className="flex items-center justify-between">
 <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">Personal Records</h3>
 <button
 onClick={() => setShowAddPR(!showAddPR)}
 className="text-xs font-medium text-primary-600 dark:text-primary-300 hover:text-primary-600"
 >
 {showAddPR ? "Cancel" : "+ Record PR"}
 </button>
 </div>
 {p.prs.length > 0 ? (
 <div className="flex gap-3 flex-wrap">
 {p.prs.map((pr, i) => (
 <span key={i} className="text-xs px-3 py-1.5 rounded-full font-bold text-white" style={{ backgroundColor: EVENTS[pr.event as ThrowEvent]?.color || "#666" }}>
 {EVENTS[pr.event as ThrowEvent]?.label || pr.event}: {pr.distance.toFixed(2)}m
 </span>
 ))}
 </div>
 ) : (
 <p className="text-xs text-muted italic">No PRs recorded yet. Tap &quot;Record PR&quot; to add one.</p>
 )}
 {showAddPR && (
 <div className="pt-2 border-t border-[var(--card-border)] space-y-3">
 <div className="grid grid-cols-3 gap-2">
 <div className="space-y-1">
 <label className="text-[10px] font-semibold text-surface-700 dark:text-surface-300">Event</label>
 <select
 value={prForm.event}
 onChange={(e) => setPrForm({ ...prForm, event: e.target.value })}
 className="w-full px-2 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-xs text-[var(--foreground)]"
 >
 {(Object.keys(EVENTS) as ThrowEvent[]).map((e) => (
 <option key={e} value={e}>{EVENTS[e].label}</option>
 ))}
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-semibold text-surface-700 dark:text-surface-300">Implement</label>
 <input
 type="text"
 value={prForm.implement}
 onChange={(e) => setPrForm({ ...prForm, implement: e.target.value })}
 placeholder="e.g. 7.26kg"
 className="w-full px-2 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-xs text-[var(--foreground)]"
 />
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-semibold text-surface-700 dark:text-surface-300">Distance (m)</label>
 <input
 type="number"
 step="0.01"
 min="0"
 value={prForm.distance}
 onChange={(e) => setPrForm({ ...prForm, distance: e.target.value })}
 placeholder="0.00"
 className="w-full px-2 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-xs text-[var(--foreground)]"
 />
 </div>
 </div>
 {prError && (
 <p className="text-xs text-red-600 dark:text-red-400">{prError}</p>
 )}
 <button
 onClick={handleRecordPR}
 disabled={savingPR || !prForm.implement || !prForm.distance}
 className="btn-primary text-xs px-4 py-1.5"
 >
 {savingPR ? "Saving..." : "Save PR"}
 </button>
 </div>
 )}
 </div>

 {/* Check-in */}
 {!todayCheckin && !showCheckIn && (
 <div className="card !p-4 text-center space-y-2 border-2 border-dashed border-[rgba(212,168,67,0.3)]">
 <p className="text-sm text-surface-700 dark:text-surface-300">How are you feeling today?</p>
 <button onClick={() => setShowCheckIn(true)} className="btn-primary text-sm px-6 py-2">
 Daily Check-In
 </button>
 </div>
 )}

 {showCheckIn && (
 <div className="card !p-5 space-y-5">
 <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">Daily Check-In</h3>

 <div className="space-y-2">
 <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">Self-Feeling (Bondarchuk Scale)</label>
 <div className="flex gap-2">
 {SELF_FEELING_SCALE.map((s) => (
 <button
 key={s.value}
 onClick={() => setCheckInData({ ...checkInData, selfFeeling: s.value })}
 className={`flex-1 py-2 px-1 rounded-lg text-center transition-all border ${checkInData.selfFeeling === s.value ? "bg-primary-500 text-white border-primary-500" : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 border-[var(--card-border)]"}`}
 >
 <span className="block text-sm font-bold">{s.value}</span>
 <span className={`block text-[9px] leading-tight mt-0.5 ${checkInData.selfFeeling === s.value ? "text-white/80" : "text-muted"}`}>{s.label}</span>
 </button>
 ))}
 </div>
 {feelingMeta && (
 <p className="text-[10px] text-surface-700 dark:text-surface-300">{feelingMeta.desc} — Expected: {feelingMeta.perfExpect}</p>
 )}
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-1">
 <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">Sleep Hours</label>
 <input type="number" min={0} max={14} step={0.5} value={checkInData.sleepHours}
 onChange={(e) => setCheckInData({ ...checkInData, sleepHours: parseFloat(e.target.value) || 0 })}
 className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)]" />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">Sleep Quality</label>
 <div className="flex gap-1">
 {SLEEP_QUALITY_SCALE.map((sq) => (
 <button key={sq.value} onClick={() => setCheckInData({ ...checkInData, sleepQuality: sq.value })}
 className={`flex-1 py-2 px-1 rounded-lg text-center transition-all border ${checkInData.sleepQuality === sq.value ? "bg-primary-500 text-white border-primary-500" : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 border-[var(--card-border)]"}`}>
 <span className="block text-sm font-bold">{sq.value}</span>
 <span className={`block text-[9px] leading-tight mt-0.5 ${checkInData.sleepQuality === sq.value ? "text-white/80" : "text-muted"}`}>{sq.label}</span>
 </button>
 ))}
 </div>
 </div>
 </div>

 <div className="space-y-1">
 <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">Energy Level</label>
 <input type="range" min={1} max={10} value={checkInData.energy}
 onChange={(e) => setCheckInData({ ...checkInData, energy: parseInt(e.target.value) })}
 className="w-full accent-primary-500" />
 <div className="flex justify-between text-[10px] text-muted">
 <span>Exhausted</span><span className="font-bold text-surface-700 dark:text-surface-300">{checkInData.energy} — {ENERGY_SCALE.find((e) => e.value === checkInData.energy)?.label}</span><span>Peak</span>
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">Soreness</label>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 {SORENESS_ZONES.map((zone) => {
 const val = checkInData.soreness[zone.key] || 0;
 return (
 <div key={zone.key} className="space-y-1">
 <label className="text-[10px] text-surface-700 dark:text-surface-300">{zone.label}</label>
 <input type="range" min={0} max={10} value={val}
 onChange={(e) => setCheckInData({ ...checkInData, soreness: { ...checkInData.soreness, [zone.key]: parseInt(e.target.value) } })}
 className="w-full accent-primary-500" />
 <span className="text-[10px] font-mono text-surface-700 dark:text-surface-300">
 {val} — <span className="font-sans text-surface-700 dark:text-surface-300">{SORENESS_LABELS[val] || ""}</span>
 </span>
 </div>
 );
 })}
 </div>
 </div>

 {saveError && (
 <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>
 )}
 <button onClick={handleCheckIn} disabled={saving} className="btn-primary w-full">
 {saving ? "Saving..." : "Submit Check-In"}
 </button>
 </div>
 )}

 {/* Typing card */}
 {p.typing?.quizCompletedDate && (
 <div className="card !p-4 space-y-2">
 <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">My Athlete Type</h3>
 <div className="grid grid-cols-2 gap-2 text-xs">
 <div><span className="text-surface-700 dark:text-surface-300">Adaptation:</span> <span className="font-semibold text-[var(--foreground)]">Group {p.typing.adaptationGroup}</span></div>
 <div><span className="text-surface-700 dark:text-surface-300">Transfer:</span> <span className="font-semibold text-[var(--foreground)] capitalize">{p.typing.transferType?.replace(/-/g, " ")}</span></div>
 <div><span className="text-surface-700 dark:text-surface-300">Recovery:</span> <span className="font-semibold text-[var(--foreground)] capitalize">{p.typing.recoveryProfile}</span></div>
 <div><span className="text-surface-700 dark:text-surface-300">Method:</span> <span className="font-semibold text-[var(--foreground)] capitalize">{p.typing.recommendedMethod?.replace(/-/g, " ")}</span></div>
 </div>
 </div>
 )}

 {/* Recent check-in trend */}
 {p.checkins.length > 1 && (
 <div className="card !p-4 space-y-2">
 <h3 className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">Self-Feeling Trend</h3>
 <div className="flex items-end gap-1 h-16">
 {p.checkins.slice(0, 14).reverse().map((c, i) => (
 <div
 key={i}
 className="flex-1 rounded-t-sm"
 style={{ height: `${(c.selfFeeling / 5) * 100}%`, backgroundColor: c.selfFeeling >= 4 ? "#5BB88A" : c.selfFeeling >= 3 ? "#D4915A" : "#D46A6A", opacity: 0.7 }}
 title={`${c.date}: ${c.selfFeeling}/5`}
 />
 ))}
 </div>
 </div>
 )}
 </>
 )}
 </div>
 );
}
