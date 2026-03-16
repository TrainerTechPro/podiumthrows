"use client";

import { useState, useEffect, useCallback } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import { useSearchParams } from "next/navigation";
import { localToday } from "@/lib/utils";
import {
 LineChart,
 Line,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 Legend,
 ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import UserAvatar from "@/components/user-avatar";
import PodiumThrowsPanel from "@/components/podium-throws-panel";
import {
 EVENT_CODE_MAP,
 EVENTS,
 STRENGTH_DB,
 type ThrowEvent,
 type GenderCode,
} from "@/lib/throws/constants";
import {
 SELF_FEELING_SCALE,
 SLEEP_QUALITY_SCALE,
 ENERGY_SCALE,
 SORENESS_LABELS,
 SORENESS_ZONES,
 ANNUAL_VOLUME_TARGETS,
 getQualification,
} from "@/lib/throws/profile-constants";
import {
 calcReadiness,
 calcAdaptationProgress,
 calcTransferIndex,
 daysBetween,
 generateTaperPlan,
 todayISO,
} from "@/lib/throws/profile-utils";

// ── Score Arc SVG Component ─────────────────────────────────────────

function ScoreArc({
 score,
 label,
 sublabel,
 color,
 size = 120,
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
 <circle
 cx={size / 2}
 cy={size / 2}
 r={radius}
 fill="none"
 stroke="currentColor"
 className="text-[var(--color-text-3)]"
 strokeWidth={8}
 />
 <circle
 cx={size / 2}
 cy={size / 2}
 r={radius}
 fill="none"
 stroke={color}
 strokeWidth={8}
 strokeLinecap="round"
 strokeDasharray={circumference}
 strokeDashoffset={circumference - progress}
 className="transition-all duration-700"
 />
 </svg>
 <div className="absolute inset-0 flex items-center justify-center">
 <span className="text-2xl font-bold text-[var(--color-text)] font-mono">
 {score != null ? score : "—"}
 </span>
 </div>
 </div>
 <div className="text-center">
 <p className="text-xs font-bold text-[var(--color-text-2)] uppercase tracking-wider">
 {label}
 </p>
 <p className="text-[10px] text-[var(--color-text-2)]">{sublabel}</p>
 </div>
 </div>
 );
}

// ── Source Badge ─────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
 if (source === "COACH") {
 return (
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
 Coach
 </span>
 );
 }
 if (source === "QUIZ") {
 return (
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
 Quiz
 </span>
 );
 }
 return (
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[var(--color-bg-subtle)] text-[var(--color-text-2)]">
 Athlete
 </span>
 );
}

// ── Body Map SVG ────────────────────────────────────────────────────

function BodyMap({ soreness }: { soreness: Record<string, number> }) {
 const getColor = (val: number) => {
 if (val <= 2) return "rgba(107, 114, 128, 0.3)";
 if (val <= 5) return "rgba(234, 179, 8, 0.6)";
 return "rgba(239, 68, 68, 0.7)";
 };

 return (
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 {SORENESS_ZONES.map((zone) => {
 const val = soreness[zone.key] ?? 0;
 return (
 <div
 key={zone.key}
 className="rounded-lg p-2 text-center border border-[var(--color-border)]"
 style={{ backgroundColor: getColor(val) }}
 >
 <p className="text-[10px] font-bold text-[var(--color-text)] uppercase">
 {zone.label}
 </p>
 <p className="text-lg font-bold text-[var(--color-text)] font-mono">
 {val}<span className="text-[10px] text-[var(--color-text-2)] font-sans">/10</span>
 </p>
 <p className="text-[9px] text-[var(--color-text-2)] leading-tight mt-0.5">
 {SORENESS_LABELS[val] ?? "None"}
 </p>
 </div>
 );
 })}
 </div>
 );
}

// ── Check-In Form ───────────────────────────────────────────────────

function CheckInForm({
 athleteId,
 onSaved,
}: {
 athleteId: string;
 onSaved: () => void;
}) {
 const [selfFeeling, setSelfFeeling] = useState(3);
 const [sleepHours, setSleepHours] = useState(7);
 const [sleepQuality, setSleepQuality] = useState(3);
 const [energy, setEnergy] = useState(5);
 const [soreness, setSoreness] = useState<Record<string, number>>({
 shoulder: 0, back: 0, hip: 0, knee: 0, elbow: 0, wrist: 0, general: 0,
 });
 const [notes, setNotes] = useState("");
 const [saving, setSaving] = useState(false);

 async function handleSubmit() {
 setSaving(true);
 try {
 const res = await fetch("/api/throws/checkins", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({
 athleteId,
 date: todayISO(),
 selfFeeling,
 sleepHours,
 sleepQuality,
 energy,
 sorenessGeneral: soreness.general,
 sorenessShoulder: soreness.shoulder,
 sorenessBack: soreness.back,
 sorenessHip: soreness.hip,
 sorenessKnee: soreness.knee,
 sorenessElbow: soreness.elbow,
 sorenessWrist: soreness.wrist,
 notes: notes || null,
 source: "COACH",
 }),
 });
 const data = await res.json();
 if (data.success) onSaved();
 } catch { /* ignore */ }
 setSaving(false);
 }

 const feelingMeta = SELF_FEELING_SCALE.find((s) => s.value === selfFeeling);

 return (
 <div className="card !p-5 space-y-5">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
 Daily Check-In
 </h3>

 {/* Self-Feeling */}
 <div className="space-y-2">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">
 Self-Feeling (Bondarchuk Scale)
 </label>
 <div className="flex gap-2">
 {SELF_FEELING_SCALE.map((s) => (
 <button
 key={s.value}
 onClick={() => setSelfFeeling(s.value)}
 className={`flex-1 py-2 px-1 rounded-lg text-center transition-all border ${
 selfFeeling === s.value
 ? "bg-[var(--color-gold)] text-[var(--color-bg)] border-[var(--color-gold)]"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] border-[var(--color-border)]"
 }`}
 >
 <span className="block text-sm font-bold">{s.value}</span>
 <span className={`block text-[9px] leading-tight mt-0.5 ${selfFeeling === s.value ? "text-white/80" : "text-[var(--color-text-3)]"}`}>{s.label}</span>
 </button>
 ))}
 </div>
 {feelingMeta && (
 <p className="text-[10px] text-[var(--color-text-2)]">
 {feelingMeta.desc} — Expected performance: {feelingMeta.perfExpect}
 </p>
 )}
 </div>

 {/* Sleep */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Sleep Hours</label>
 <input
 type="number"
 min={0}
 max={14}
 step={0.5}
 value={sleepHours}
 onChange={(e) => setSleepHours(parseFloat(e.target.value) || 0)}
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Sleep Quality</label>
 <div className="flex gap-1">
 {SLEEP_QUALITY_SCALE.map((sq) => (
 <button
 key={sq.value}
 onClick={() => setSleepQuality(sq.value)}
 className={`flex-1 py-2 px-1 rounded-lg text-center transition-all border ${
 sleepQuality === sq.value
 ? "bg-[var(--color-gold)] text-[var(--color-bg)] border-[var(--color-gold)]"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] border-[var(--color-border)]"
 }`}
 >
 <span className="block text-sm font-bold">{sq.value}</span>
 <span className={`block text-[9px] leading-tight mt-0.5 ${sleepQuality === sq.value ? "text-white/80" : "text-[var(--color-text-3)]"}`}>{sq.label}</span>
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* Energy */}
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Energy Level</label>
 <input
 type="range"
 min={1}
 max={10}
 value={energy}
 onChange={(e) => setEnergy(parseInt(e.target.value))}
 className="w-full accent-[var(--color-gold)]"
 />
 <div className="flex justify-between text-[10px] text-[var(--color-text-3)]">
 <span>Exhausted</span>
 <span className="font-bold text-[var(--color-text-2)]">{energy} — {ENERGY_SCALE.find((e) => e.value === energy)?.label}</span>
 <span>Peak</span>
 </div>
 </div>

 {/* Soreness Map */}
 <div className="space-y-2">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Soreness</label>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 {SORENESS_ZONES.map((zone) => {
 const val = soreness[zone.key] || 0;
 return (
 <div key={zone.key} className="space-y-1">
 <label className="text-[10px] text-[var(--color-text-2)]">{zone.label}</label>
 <input
 type="range"
 min={0}
 max={10}
 value={val}
 onChange={(e) =>
 setSoreness({ ...soreness, [zone.key]: parseInt(e.target.value) })
 }
 className="w-full accent-[var(--color-gold)]"
 />
 <span className="text-[10px] font-mono text-[var(--color-text-2)]">
 {val} — <span className="font-sans text-[var(--color-text-2)]">{SORENESS_LABELS[val] || ""}</span>
 </span>
 </div>
 );
 })}
 </div>
 </div>

 {/* Notes */}
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Notes (optional)</label>
 <textarea
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 rows={2}
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] resize-none"
 placeholder="Any additional notes..."
 />
 </div>

 <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full">
 {saving ? "Saving..." : "Submit Check-In"}
 </button>
 </div>
 );
}

// ── Main Profile Page ───────────────────────────────────────────────

interface ProfileData {
 athlete: {
 id: string;
 firstName: string;
 lastName: string;
 gender: string | null;
 sport: string | null;
 weight: number | null;
 height: number | null;
 profilePictureUrl?: string | null;
 };
 typing: {
 adaptationGroup: number | null;
 transferType: string | null;
 selfFeelingAccuracy: string | null;
 lightImplResponse: string | null;
 recoveryProfile: string | null;
 recommendedMethod: string | null;
 optimalComplexDuration: string | null;
 estimatedSessionsToForm: number | null;
 confidenceAdaptation: number;
 confidenceTransfer: number;
 confidenceSelfFeeling: number;
 quizCompletedDate: string | null;
 typingSource: string;
 quizAssignedByCoach: boolean;
 quizAssignedDate: string | null;
 } | null;
 checkins: Array<{
 date: string;
 selfFeeling: number;
 sleepHours: number | null;
 sleepQuality: number | null;
 energy: number | null;
 sorenessGeneral: number | null;
 sorenessShoulder: number | null;
 sorenessBack: number | null;
 sorenessHip: number | null;
 sorenessKnee: number | null;
 sorenessElbow: number | null;
 sorenessWrist: number | null;
 source: string;
 }>;
 complexes: Array<{
 id: string;
 startDate: string;
 endDate: string | null;
 exercises: string;
 sessionsCount: number;
 enteredSportsForm: boolean;
 sessionsToForm: number | null;
 peakMark: number | null;
 event: string;
 }>;
 competitions: Array<{
 id: string;
 name: string;
 date: string;
 event: string;
 priority: string;
 result: number | null;
 resultBy: string | null;
 }>;
 prs: Array<{
 event: string;
 implement: string;
 distance: number;
 }>;
 drillPRs: Array<{
 id: string;
 event: string;
 drillType: string;
 implement: string;
 distance: number;
 achievedAt: string;
 notes: string | null;
 }>;
 benchmarks: Record<string, number | null>;
 assignments: Array<{
 assignedDate: string;
 status: string;
 }>;
 competitionMarks: Array<{
 date: string;
 distance: number;
 implement: string;
 source: "training" | "competition";
 competitionName?: string;
 priority?: string;
 }>;
 annualThrowCount: number;
}

export default function AthleteProfilePage() {
 const searchParams = useSearchParams();
 const athleteId = searchParams.get("athleteId");
 const [profile, setProfile] = useState<ProfileData | null>(null);
 const [loading, setLoading] = useState(!!athleteId);
 const [error, setError] = useState(false);
 const [showCheckIn, setShowCheckIn] = useState(false);
 const [showAddPR, setShowAddPR] = useState(false);
 const [showBioEdit, setShowBioEdit] = useState(false);
 const [showTypingOverride, setShowTypingOverride] = useState(false);
 const [showCompetitions, setShowCompetitions] = useState(false);
 const [showDrillPRs, setShowDrillPRs] = useState(false);
 const [athletes, setAthletes] = useState<Array<{ id: string; profilePictureUrl?: string | null; user: { firstName: string; lastName: string } }>>([]);
 const [athletesLoaded, setAthletesLoaded] = useState(false);
 const [selectedAthleteId, setSelectedAthleteId] = useState(athleteId || "");
 const [assigningQuiz, setAssigningQuiz] = useState(false);
 const [quizAssigned, setQuizAssigned] = useState(false);

 async function handleAssignQuiz() {
 if (!selectedAthleteId) return;
 setAssigningQuiz(true);
 try {
 const res = await fetch("/api/throws/typing/assign", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({ athleteId: selectedAthleteId }),
 });
 const data = await res.json();
 if (data.success) { setQuizAssigned(true); loadProfile(selectedAthleteId); }
 } catch { /* ignore */ }
 setAssigningQuiz(false);
 }

 const loadProfile = useCallback(async (id: string) => {
 setLoading(true);
 setError(false);
 try {
 const res = await fetch(`/api/throws/profile?athleteId=${id}`);
 const data = await res.json();
 if (data.success) {
 setProfile(data.data);
 } else {
 setProfile(null);
 setError(true);
 }
 } catch {
 setProfile(null);
 setError(true);
 }
 setLoading(false);
 }, []);

 useEffect(() => {
 fetch("/api/athletes")
 .then((r) => r.json())
 .then((data) => {
 if (data.success) setAthletes(data.data);
 setAthletesLoaded(true);
 })
 .catch(() => setAthletesLoaded(true));
 }, []);

 useEffect(() => {
 if (selectedAthleteId) loadProfile(selectedAthleteId);
 }, [selectedAthleteId, loadProfile]);

 useEffect(() => {
 if (athleteId) setSelectedAthleteId(athleteId);
 }, [athleteId]);

 // ── Loading state
 if (loading && !profile) {
 return (
 <div className="animate-spring-up space-y-4">
 <div className="skeleton h-8 w-64" />
 <div className="grid grid-cols-3 gap-4">
 {[1, 2, 3].map((i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
 </div>
 {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
 </div>
 );
 }

 // Compute scores from profile data
 const today = todayISO();
 const todayCheckin = profile?.checkins.find((c) => c.date === today);
 const selfFeelingAccuracy = (profile?.typing?.selfFeelingAccuracy as "accurate" | "moderate" | "poor") || "moderate";

 // Readiness score
 const readiness = todayCheckin
 ? calcReadiness(todayCheckin, selfFeelingAccuracy)
 : { score: null, label: "No check-in today", color: "#6B7280", breakdown: {} };

 // Adaptation progress
 const currentComplex = profile?.complexes.find((c) => !c.endDate);
 const complexMarks = profile?.competitionMarks
 .filter((m) => currentComplex && m.date >= currentComplex.startDate)
 .map((m) => m.distance) || [];
 const adaptation = currentComplex
 ? calcAdaptationProgress(currentComplex.sessionsCount, complexMarks, currentComplex.enteredSportsForm)
 : { progress: 0, phase: "no-complex" as const, label: "No active complex" };

 // Next competition
 const nextComp = profile?.competitions.find((c) => c.date >= today);
 const daysToComp = nextComp ? daysBetween(today, nextComp.date) : null;
 const taper = daysToComp != null ? generateTaperPlan(daysToComp) : null;

 // Primary event
 const primaryPR = profile?.prs?.[0];
 const primaryEvent = primaryPR?.event as ThrowEvent | undefined;
 const primaryEventCode = primaryEvent ? EVENT_CODE_MAP[primaryEvent] : null;
 const genderCode: GenderCode = profile?.athlete.gender === "FEMALE" ? "F" : "M";

 // Transfer index — computed from correlation DB against current complex exercises
 const complexExercises: string[] = (() => {
 try { return JSON.parse(currentComplex?.exercises || "[]"); } catch { return []; }
 })();
 const transferResult = primaryEventCode && primaryPR
 ? calcTransferIndex(primaryEventCode, genderCode, complexExercises, primaryPR.distance)
 : { score: null, exercises: [] };
 const transferScore = transferResult.score;

 // Annual volume
 const qualification = primaryEventCode && primaryPR
 ? getQualification(primaryEventCode, genderCode, primaryPR.distance)
 : "low";
 const volumeTargets = primaryEventCode ? ANNUAL_VOLUME_TARGETS[primaryEventCode]?.[qualification] : null;

 // Adaptation phase color
 const phaseColors: Record<string, string> = {
 "no-complex": "#6B7280",
 loading: "#6A9FD8",
 adapting: "#D4915A",
 approaching: "#D4915A",
 "in-form": "#5BB88A",
 "readaptation-risk": "#D46A6A",
 };

 return (
 <div className="animate-spring-up space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">
 Athlete Profile
 </h1>
 <p className="text-sm text-[var(--color-text-2)]">
 Readiness, adaptation, and Bondarchuk typing
 </p>
 </div>
 <div className="flex items-center gap-2">
 <select
 value={selectedAthleteId}
 onChange={(e) => setSelectedAthleteId(e.target.value)}
 className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 >
 <option value="">Select athlete...</option>
 {athletes.map((a) => (
 <option key={a.id} value={a.id}>
 {a.user.firstName} {a.user.lastName}
 </option>
 ))}
 </select>
 <Link
 href="/coach/throws"
 className="text-sm text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] hover:text-[var(--color-gold-dark)] font-medium"
 >
 Dashboard
 </Link>
 </div>
 </div>

 {!selectedAthleteId && athletesLoaded && athletes.length === 0 && (
 <div className="card text-center py-12 space-y-4">
 <div className="w-14 h-14 mx-auto rounded-full bg-[var(--color-bg-subtle)] flex items-center justify-center">
 <svg className="w-7 h-7 text-[var(--color-text-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
 </svg>
 </div>
 <div>
 <p className="font-medium text-[var(--color-text-2)]">No athletes yet</p>
 <p className="text-sm text-[var(--color-text-2)] mt-1">Add an athlete to your roster to get started.</p>
 </div>
 <Link
 href="/coach/athletes/new"
 className="btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Add Athlete
 </Link>
 </div>
 )}

 {!selectedAthleteId && athletesLoaded && athletes.length > 0 && (
 <div className="space-y-3">
 <p className="text-sm font-semibold text-[var(--color-text-2)]">Choose an athlete</p>
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
 {athletes.map((a) => (
 <button
 key={a.id}
 onClick={() => setSelectedAthleteId(a.id)}
 className="card !p-4 flex flex-col items-center gap-2 hover:border-[var(--color-gold)] hover:shadow-md transition-all text-left cursor-pointer"
 >
 <UserAvatar
 src={a.profilePictureUrl}
 firstName={a.user.firstName}
 lastName={a.user.lastName}
 size="xl"
 />
 <p className="text-sm font-semibold text-[var(--color-text)] text-center leading-tight">
 {a.user.firstName} {a.user.lastName}
 </p>
 </button>
 ))}
 </div>
 </div>
 )}

 {selectedAthleteId && error && !loading && (
 <div className="card text-center py-12 space-y-4">
 <div className="w-14 h-14 mx-auto rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
 <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
 </svg>
 </div>
 <div>
 <p className="font-medium text-[var(--color-text-2)]">Could not load profile</p>
 <p className="text-sm text-[var(--color-text-2)] mt-1">There was a problem loading this athlete&apos;s profile data.</p>
 </div>
 <button
 onClick={() => loadProfile(selectedAthleteId)}
 className="btn-secondary text-sm px-5 py-2"
 >
 Try Again
 </button>
 </div>
 )}

 {profile && (
 <>
 {/* Athlete name bar */}
 <div className="card !p-4 space-y-3">
 <div className="flex items-center justify-between gap-3 flex-wrap">
 <div className="flex items-center gap-3">
 <UserAvatar
 src={profile.athlete.profilePictureUrl}
 firstName={profile.athlete.firstName}
 lastName={profile.athlete.lastName}
 size="lg"
 />
 <div>
 <p className="font-semibold text-[var(--color-text)]">
 {profile.athlete.firstName} {profile.athlete.lastName}
 </p>
 <div className="flex items-center gap-2 flex-wrap mt-0.5">
 {profile.athlete.gender && (
 <span className="text-[10px] text-[var(--color-text-2)] uppercase font-medium">{profile.athlete.gender}</span>
 )}
 {profile.athlete.sport && (
 <span className="text-[10px] text-[var(--color-text-2)]">{profile.athlete.sport}</span>
 )}
 {profile.athlete.weight && (
 <span className="text-[10px] text-[var(--color-text-2)]">{profile.athlete.weight}kg</span>
 )}
 {profile.athlete.height && (
 <span className="text-[10px] text-[var(--color-text-2)]">{profile.athlete.height}cm</span>
 )}
 </div>
 <p className="text-xs text-[var(--color-text-2)] mt-0.5">
 {profile.prs.map((pr) => {
 const e = EVENTS[pr.event as ThrowEvent];
 return e ? `${e.label} ${pr.distance.toFixed(2)}m` : null;
 }).filter(Boolean).join(" | ") || "No PRs recorded"}
 </p>
 </div>
 </div>
 <div className="flex gap-2 flex-wrap">
 <button
 onClick={() => setShowBioEdit(!showBioEdit)}
 className="btn-secondary text-xs px-3 py-1.5"
 >
 {showBioEdit ? "Hide Bio" : "Edit Bio"}
 </button>
 <button
 onClick={() => setShowCheckIn(!showCheckIn)}
 className="btn-secondary text-xs px-3 py-1.5"
 >
 {showCheckIn ? "Hide" : "Check-In"}
 </button>
 <button
 onClick={() => setShowAddPR(!showAddPR)}
 className="btn-secondary text-xs px-3 py-1.5"
 >
 {showAddPR ? "Hide" : "Record PR"}
 </button>
 <button
 onClick={() => setShowCompetitions(!showCompetitions)}
 className="btn-secondary text-xs px-3 py-1.5"
 >
 {showCompetitions ? "Hide Comps" : "Competitions"}
 </button>
 <button
 onClick={() => setShowDrillPRs(!showDrillPRs)}
 className="btn-secondary text-xs px-3 py-1.5"
 >
 {showDrillPRs ? "Hide Drills" : "Drill PRs"}
 </button>
 </div>
 </div>
 </div>

 {/* ── Typing Quiz Alert ─────────────────────────────────────── */}
 {!profile.typing?.quizCompletedDate && (
 <div className={`rounded-xl border-2 p-4 space-y-3 ${
 profile.typing?.quizAssignedByCoach || quizAssigned
 ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700"
 : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700"
 }`}>
 <div className="flex items-start gap-3">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
 profile.typing?.quizAssignedByCoach || quizAssigned
 ? "bg-amber-100 dark:bg-amber-900/40"
 : "bg-red-100 dark:bg-red-900/40"
 }`}>
 <svg className={`w-5 h-5 ${profile.typing?.quizAssignedByCoach || quizAssigned ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
 </svg>
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <p className={`text-sm font-bold ${profile.typing?.quizAssignedByCoach || quizAssigned ? "text-amber-800 dark:text-amber-300" : "text-red-800 dark:text-red-300"}`}>
 Bondarchuk Typing Quiz Not Completed
 </p>
 {(profile.typing?.quizAssignedByCoach || quizAssigned) && (
 <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 uppercase tracking-wider">
 Assigned to athlete
 </span>
 )}
 </div>
 <p className={`text-xs mt-0.5 ${profile.typing?.quizAssignedByCoach || quizAssigned ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"}`}>
 {profile.typing?.quizAssignedByCoach || quizAssigned
 ? `Quiz was assigned on ${profile.typing?.quizAssignedDate ?? "today"} — the athlete will see it as a priority on their dashboard.`
 : "Without a completed typing quiz, readiness scores, transfer index and recommended training methods are unavailable. Assign the quiz so the athlete can complete it, or take it now on their behalf."}
 </p>
 </div>
 </div>
 <div className="flex gap-2 flex-wrap">
 {!(profile.typing?.quizAssignedByCoach || quizAssigned) && (
 <button
 onClick={handleAssignQuiz}
 disabled={assigningQuiz}
 className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
 >
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
 </svg>
 {assigningQuiz ? "Assigning..." : "Assign Quiz to Athlete"}
 </button>
 )}
 <Link
 href={`/coach/throws/profile/typing?athleteId=${selectedAthleteId}`}
 className="btn-secondary text-xs px-4 py-2 flex items-center gap-1.5"
 >
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
 </svg>
 Take Quiz Now (on behalf)
 </Link>
 </div>
 </div>
 )}

 {/* Check-in form */}
 {showCheckIn && (
 <CheckInForm
 athleteId={selectedAthleteId}
 onSaved={() => {
 setShowCheckIn(false);
 loadProfile(selectedAthleteId);
 }}
 />
 )}

 {/* Record PR form */}
 {showAddPR && (
 <RecordPRForm
 athleteId={selectedAthleteId}
 onSaved={() => {
 setShowAddPR(false);
 loadProfile(selectedAthleteId);
 }}
 />
 )}

 {/* Bio edit form */}
 {showBioEdit && (
 <AthleteBioEditForm
 athleteId={selectedAthleteId}
 currentBio={{
 gender: profile.athlete.gender,
 sport: profile.athlete.sport,
 height: profile.athlete.height,
 weight: profile.athlete.weight,
 }}
 onSaved={() => {
 setShowBioEdit(false);
 loadProfile(selectedAthleteId);
 }}
 />
 )}

 {/* Competitions panel */}
 {showCompetitions && (
 <CompetitionsPanel
 athleteId={selectedAthleteId}
 competitions={profile.competitions}
 today={today}
 onSaved={() => loadProfile(selectedAthleteId)}
 />
 )}

 {/* Drill PRs panel */}
 {showDrillPRs && (
 <DrillPRPanel
 athleteId={selectedAthleteId}
 drillPRs={profile.drillPRs}
 primaryEvent={primaryEvent}
 onSaved={() => loadProfile(selectedAthleteId)}
 />
 )}

 {/* Testing Metrics — always visible so strength/jump/speed PRs are easy to update */}
 <TestingMetricsPanel
 athleteId={selectedAthleteId}
 benchmarks={profile.benchmarks}
 onSaved={() => loadProfile(selectedAthleteId)}
 />

 {/* ── Podium Throws KPI Panel ───────────────────────────────── */}
 <PodiumThrowsPanel athleteId={selectedAthleteId} />

 {/* ── PR Progression Chart ─────────────────────────────────── */}
 <PRProgressionChart athleteId={selectedAthleteId} />

 {/* ── Training Complex ─────────────────────────────────────── */}
 <div className="card !p-4 space-y-3">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
 Training Complex
 </h3>
 <ManageComplexForm
 athleteId={selectedAthleteId}
 currentComplex={currentComplex ? {
 startDate: currentComplex.startDate,
 exercises: currentComplex.exercises,
 sessionsCount: currentComplex.sessionsCount,
 event: currentComplex.event,
 } : null}
 primaryEvent={primaryEvent}
 onSaved={() => loadProfile(selectedAthleteId)}
 />
 </div>

 {/* ── Three Headline Scores ────────────────────────────────── */}
 <div className="grid grid-cols-3 gap-4">
 <div className="card !p-4 flex justify-center">
 <ScoreArc
 score={readiness.score}
 label="Readiness"
 sublabel={readiness.label}
 color={readiness.color}
 />
 </div>
 <div className="card !p-4 flex justify-center">
 <ScoreArc
 score={adaptation.progress}
 label="Adaptation"
 sublabel={adaptation.label}
 color={phaseColors[adaptation.phase] || "#6B7280"}
 />
 </div>
 <div className="card !p-4 flex justify-center">
 <ScoreArc
 score={transferScore}
 label="Transfer"
 sublabel={
 transferResult.exercises.length > 0
 ? `${transferResult.exercises.length} exercise${transferResult.exercises.length !== 1 ? "s" : ""} matched`
 : complexExercises.length > 0
 ? "No DB matches"
 : "Start a complex"
 }
 color={transferScore != null && transferScore >= 60 ? "#5BB88A" : "#D4915A"}
 />
 </div>
 </div>

 {/* ── Transfer Exercise Breakdown ─────────────────────────── */}
 {transferResult.exercises.length > 0 && (
 <div className="card !p-4 space-y-2">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
 Transfer Breakdown
 </h3>
 <p className="text-[10px] text-[var(--color-text-2)]">
 Expected correlation coefficients from Bondarchuk Vol IV for current complex exercises
 </p>
 <div className="space-y-1">
 {transferResult.exercises.map((ex) => (
 <div key={ex.name} className="flex items-center justify-between py-1 border-b border-[var(--color-border)] last:border-0">
 <span className="text-xs text-[var(--color-text-2)] truncate max-w-[60%]">{ex.name}</span>
 <div className="flex items-center gap-2">
 <div className="w-20 bg-[var(--color-bg-subtle)] rounded-full h-1.5">
 <div
 className="h-1.5 rounded-full"
 style={{
 width: `${Math.max(0, ex.expectedR) * 100}%`,
 backgroundColor: ex.status === "strong" ? "#5BB88A" : ex.status === "normal" ? "#D4915A" : ex.status === "weak" ? "#9CA3AF" : "#D46A6A",
 }}
 />
 </div>
 <span
 className="text-[10px] font-mono w-10 text-right"
 style={{
 color: ex.status === "strong" ? "#5BB88A" : ex.status === "normal" ? "#D4915A" : ex.status === "weak" ? "#9CA3AF" : "#D46A6A",
 }}
 >
 r={ex.expectedR.toFixed(2)}
 </span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* ── Panel 1: Mark Timeline ──────────────────────────────── */}
 <div className="card !p-4 space-y-3">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
 Mark Timeline
 </h3>
 {profile.competitionMarks.length > 0 ? (() => {
 const allMarks = profile.competitionMarks.slice(0, 60);
 const maxMark = Math.max(...allMarks.map((m) => m.distance));
 const minMark = Math.min(...allMarks.map((m) => m.distance));
 const range = maxMark - minMark || 1;
 const eventColor = primaryEvent ? EVENTS[primaryEvent]?.color || "#6A9FD8" : "#6A9FD8";
 const compCount = allMarks.filter((m) => m.source === "competition").length;
 const trainCount = allMarks.filter((m) => m.source === "training").length;
 return (
 <div className="space-y-2">
 <div className="flex items-end gap-0.5 h-32 overflow-x-auto">
 {allMarks.map((m, i) => {
 const height = ((m.distance - minMark) / range) * 100;
 const isComp = m.source === "competition";
 return (
 <div
 key={i}
 className="flex-shrink-0 rounded-t-sm relative group"
 style={{
 width: isComp ? "6px" : "4px",
 height: `${Math.max(8, height)}%`,
 backgroundColor: isComp ? "#D46A6A" : eventColor,
 opacity: isComp ? 1 : (0.4 + (height / 200)),
 outline: isComp ? "1px solid rgba(212,106,106,0.6)" : undefined,
 }}
 title={
 isComp
 ? `COMP ${m.date}: ${m.distance.toFixed(2)}m${m.competitionName ? ` — ${m.competitionName}` : ""}`
 : `Training ${m.date}: ${m.distance.toFixed(2)}m (${m.implement})`
 }
 >
 <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[var(--color-text)] text-[var(--color-surface)] text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
 {isComp ? "COMP " : ""}{m.distance.toFixed(2)}m
 </div>
 </div>
 );
 })}
 </div>
 <div className="flex items-center gap-4 text-[10px] text-[var(--color-text-2)] flex-wrap">
 {primaryPR && (
 <span>PR: <strong className="text-[var(--color-text)]">{primaryPR.distance.toFixed(2)}m</strong></span>
 )}
 {compCount > 0 && (
 <span className="flex items-center gap-1">
 <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#D46A6A" }} />
 Competition: <strong className="text-[var(--color-text)]">{compCount}</strong>
 </span>
 )}
 {trainCount > 0 && (
 <span className="flex items-center gap-1">
 <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: eventColor, opacity: 0.7 }} />
 Training: <strong className="text-[var(--color-text)]">{trainCount}</strong>
 </span>
 )}
 </div>
 </div>
 );
 })() : (
 <p className="text-xs text-[var(--color-text-3)] italic">No marks recorded yet.</p>
 )}
 </div>

 {/* ── Panel 7: Athlete Type Profile Card ─────────────────── */}
 <div className="card !p-4 space-y-3">
 <div className="flex items-center justify-between gap-2 flex-wrap">
 <div className="flex items-center gap-2">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
 Athlete Typing
 </h3>
 {profile.typing && <SourceBadge source={profile.typing.typingSource || "QUIZ"} />}
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setShowTypingOverride(!showTypingOverride)}
 className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
 >
 {showTypingOverride ? "Hide Override" : "Coach Override"}
 </button>
 {profile.typing?.quizCompletedDate && (
 <Link
 href={`/coach/throws/profile/typing?athleteId=${selectedAthleteId}`}
 className="text-xs text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] hover:underline"
 >
 Retake Quiz
 </Link>
 )}
 </div>
 </div>
 {showTypingOverride && (
 <TypingOverrideForm
 athleteId={selectedAthleteId}
 current={profile.typing}
 onSaved={() => {
 setShowTypingOverride(false);
 loadProfile(selectedAthleteId);
 }}
 />
 )}
 {profile.typing ? (
 <div className="space-y-2">
 {[
 { label: "Adaptation", value: profile.typing.adaptationGroup ? `Group ${profile.typing.adaptationGroup} — ${profile.typing.adaptationGroup === 1 ? "Fast" : profile.typing.adaptationGroup === 2 ? "Moderate" : "Slow"}` : "—", confidence: profile.typing.confidenceAdaptation },
 { label: "Transfer", value: profile.typing.transferType?.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "—", confidence: profile.typing.confidenceTransfer },
 { label: "Self-Feeling", value: profile.typing.selfFeelingAccuracy?.replace(/\b\w/g, (c: string) => c.toUpperCase()) || "—", confidence: profile.typing.confidenceSelfFeeling },
 { label: "Light Impl", value: profile.typing.lightImplResponse === "normal-87pct" ? "Normal (87% group)" : profile.typing.lightImplResponse === "tolerant-13pct" ? "Tolerant (13% group)" : "—", confidence: null },
 { label: "Recovery", value: profile.typing.recoveryProfile?.replace(/\b\w/g, (c: string) => c.toUpperCase()) || "—", confidence: null },
 { label: "Method", value: profile.typing.recommendedMethod?.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "—", confidence: null },
 ].map((dim) => (
 <div key={dim.label} className="flex items-center justify-between py-1 border-b border-[var(--color-border)] last:border-0">
 <span className="text-xs text-[var(--color-text-2)] font-medium">{dim.label}</span>
 <div className="flex items-center gap-2">
 <span className="text-xs font-semibold text-[var(--color-text)]">{dim.value}</span>
 {dim.confidence != null && dim.confidence > 0 && (
 <span className="text-[10px] text-[var(--color-text-3)] font-mono">[{dim.confidence}%]</span>
 )}
 </div>
 </div>
 ))}
 <div className="pt-2 flex items-center gap-4 text-[10px] text-[var(--color-text-2)]">
 <span>Duration: <strong>{profile.typing.optimalComplexDuration || "—"}</strong></span>
 <span>Sessions to form: <strong>~{profile.typing.estimatedSessionsToForm || "—"}</strong></span>
 </div>
 </div>
 ) : (
 <div className="text-center py-6">
 <p className="text-xs text-[var(--color-text-3)] mb-3">No typing quiz completed yet.</p>
 <Link
 href={`/coach/throws/profile/typing?athleteId=${selectedAthleteId}`}
 className="btn-primary text-xs px-4 py-2"
 >
 Start Typing Quiz
 </Link>
 </div>
 )}
 </div>

 {/* ── Panel 6: Body & Recovery Tracker ───────────────────── */}
 <div className="card !p-4 space-y-3">
 <div className="flex items-center justify-between">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
 Body & Recovery
 </h3>
 <div className="flex items-center gap-2">
 {todayCheckin ? (
 <>
 <span className="text-[10px] text-[var(--color-text-3)]">
 Filled today
 </span>
 <SourceBadge source={todayCheckin.source} />
 </>
 ) : profile.checkins.length > 0 ? (
 <span className="text-[10px] text-[var(--color-text-3)]">
 Last: {profile.checkins[0].date}
 </span>
 ) : null}
 </div>
 </div>
 {todayCheckin ? (
 <div className="space-y-4">
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <div className="text-center">
 <p className="text-[10px] text-[var(--color-text-2)] uppercase">Self-Feeling</p>
 <p className="text-2xl font-bold text-[var(--color-text)] font-mono">{todayCheckin.selfFeeling}/5</p>
 </div>
 <div className="text-center">
 <p className="text-[10px] text-[var(--color-text-2)] uppercase">Sleep</p>
 <p className="text-2xl font-bold text-[var(--color-text)] font-mono">{todayCheckin.sleepHours ?? "—"}h</p>
 </div>
 <div className="text-center">
 <p className="text-[10px] text-[var(--color-text-2)] uppercase">Energy</p>
 <p className="text-2xl font-bold text-[var(--color-text)] font-mono">{todayCheckin.energy ?? "—"}/10</p>
 </div>
 <div className="text-center">
 <p className="text-[10px] text-[var(--color-text-2)] uppercase">Sleep Quality</p>
 <p className="text-2xl font-bold text-[var(--color-text)] font-mono">{todayCheckin.sleepQuality ?? "—"}/5</p>
 </div>
 </div>
 <BodyMap soreness={{
 shoulder: todayCheckin.sorenessShoulder ?? 0,
 back: todayCheckin.sorenessBack ?? 0,
 hip: todayCheckin.sorenessHip ?? 0,
 knee: todayCheckin.sorenessKnee ?? 0,
 elbow: todayCheckin.sorenessElbow ?? 0,
 wrist: todayCheckin.sorenessWrist ?? 0,
 general: todayCheckin.sorenessGeneral ?? 0,
 }} />

 {/* Recent check-in trend (last 7 days) */}
 {profile.checkins.length > 1 && (
 <div className="space-y-1">
 <p className="text-[10px] font-semibold text-[var(--color-text-2)] uppercase">
 Self-Feeling Trend (Last 7 Days)
 </p>
 <div className="flex items-end gap-1 h-12">
 {profile.checkins.slice(0, 7).reverse().map((c, i) => (
 <div
 key={i}
 className="flex-1 rounded-t-sm"
 style={{
 height: `${(c.selfFeeling / 5) * 100}%`,
 backgroundColor: c.selfFeeling >= 4 ? "#5BB88A" : c.selfFeeling >= 3 ? "#D4915A" : "#D46A6A",
 opacity: 0.7,
 }}
 title={`${c.date}: ${c.selfFeeling}/5`}
 />
 ))}
 </div>
 </div>
 )}
 </div>
 ) : (
 <div className="text-center py-4">
 <p className="text-xs text-[var(--color-text-3)] mb-2">No check-in for today.</p>
 <button onClick={() => setShowCheckIn(true)} className="btn-secondary text-xs px-4 py-1.5">
 Submit Check-In
 </button>
 </div>
 )}
 </div>

 {/* ── Panel 3: Session Compliance ─────────────────────────── */}
 <div className="card !p-4 space-y-3">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
 Session Compliance
 </h3>
 {profile.assignments.length > 0 ? (
 <div className="space-y-2">
 <div className="flex items-center gap-4 text-xs text-[var(--color-text-2)]">
 <span>
 Completed:{" "}
 <strong className="text-[var(--color-text)]">
 {profile.assignments.filter((a) => a.status === "COMPLETED").length}
 </strong>
 /{profile.assignments.length}
 </span>
 <span>
 Rate:{" "}
 <strong className="text-[var(--color-text)]">
 {Math.round(
 (profile.assignments.filter((a) => a.status === "COMPLETED").length /
 profile.assignments.length) * 100,
 )}%
 </strong>
 </span>
 </div>
 <div className="flex gap-0.5 flex-wrap">
 {profile.assignments.slice(0, 30).map((a, i) => (
 <div
 key={i}
 className="w-3 h-3 rounded-sm"
 style={{
 backgroundColor:
 a.status === "COMPLETED"
 ? "#5BB88A"
 : a.status === "SKIPPED"
 ? "#D46A6A"
 : a.status === "PARTIAL"
 ? "#D4915A"
 : "#CBD5E1",
 }}
 title={`${a.assignedDate}: ${a.status}`}
 />
 ))}
 </div>
 <div className="flex gap-3 text-[10px] text-[var(--color-text-2)]">
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#5BB88A]" /> Completed</span>
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#D4915A]" /> Partial</span>
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#D46A6A]" /> Skipped</span>
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#CBD5E1]" /> Assigned</span>
 </div>
 </div>
 ) : (
 <p className="text-xs text-[var(--color-text-3)] italic">No sessions assigned yet.</p>
 )}
 </div>

 {/* ── Panel 2: Annual Volume Progress ────────────────────── */}
 <div className="card !p-4 space-y-3">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
 Annual Volume
 </h3>
 {volumeTargets ? (
 <div className="space-y-3">
 <p className="text-[10px] text-[var(--color-text-2)]">
 {primaryEvent ? EVENTS[primaryEvent]?.label : "Throws"} — {qualification.toUpperCase()} qualification level
 </p>
 {(["competition", "lighter", "heavier", "analogous", "total"] as const).map((cat) => {
 const target = volumeTargets[cat];
 // Use annualThrowCount as approximation split across categories
 const actual = cat === "total"
 ? profile.annualThrowCount
 : Math.round(profile.annualThrowCount * (target / volumeTargets.total));
 const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
 return (
 <div key={cat} className="space-y-1">
 <div className="flex justify-between text-[10px]">
 <span className="text-[var(--color-text-2)] capitalize font-medium">{cat}</span>
 <span className="text-[var(--color-text-2)] font-mono">
 {actual.toLocaleString()} / {target.toLocaleString()} ({pct}%)
 </span>
 </div>
 <div className="w-full bg-[var(--color-bg-subtle)] rounded-full h-2">
 <div
 className="h-2 rounded-full transition-all"
 style={{
 width: `${pct}%`,
 backgroundColor: primaryEvent
 ? EVENTS[primaryEvent]?.color || "#6A9FD8"
 : "#6A9FD8",
 }}
 />
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 <p className="text-xs text-[var(--color-text-3)] italic">
 Record PRs to see annual volume targets based on qualification level.
 </p>
 )}
 </div>

 {/* ── Panel 9: Competition Readiness ─────────────────────── */}
 <div className="card !p-4 space-y-3">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
 Competition Readiness
 </h3>
 {nextComp ? (
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-lg font-bold text-[var(--color-text)]">
 {daysToComp} days
 </p>
 <p className="text-xs text-[var(--color-text-2)]">
 to {nextComp.name}
 </p>
 </div>
 <span
 className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
 style={{
 backgroundColor:
 nextComp.priority === "A" ? "#D46A6A" : nextComp.priority === "B" ? "#D4915A" : "#6B7280",
 }}
 >
 Priority {nextComp.priority}
 </span>
 </div>

 {/* Form status */}
 <div className="p-2 rounded-lg bg-[var(--color-surface-2)]/50">
 {adaptation.phase === "in-form" ? (
 <p className="text-xs text-green-600 dark:text-green-400 font-semibold">
 IN FORM — Peak performance expected
 </p>
 ) : adaptation.phase === "approaching" ? (
 <p className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold">
 Approaching form — continue current complex
 </p>
 ) : adaptation.progress >= 30 ? (
 <p className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold">
 Still adapting — {Math.max(0, (profile.typing?.estimatedSessionsToForm || 18) - (currentComplex?.sessionsCount || 0))} sessions remaining (est.)
 </p>
 ) : (
 <p className="text-xs text-[var(--color-text-2)]">
 Early in complex — continue building
 </p>
 )}
 </div>

 {/* Taper preview */}
 {taper && daysToComp != null && daysToComp <= 7 && (
 <div className="space-y-1">
 <p className="text-[10px] font-semibold text-[var(--color-text-2)] uppercase">
 Taper Active
 </p>
 <p className="text-xs text-[var(--color-text-2)]">
 Volume at <strong>{Math.round(taper.volumeMultiplier * 100)}%</strong> ({daysToComp} days out)
 </p>
 </div>
 )}

 {/* Add competition form link */}
 <p className="text-[10px] text-[var(--color-text-2)]">
 Event: {EVENTS[nextComp.event as ThrowEvent]?.label || nextComp.event} | Date: {nextComp.date}
 </p>
 </div>
 ) : (
 <AddCompetitionForm athleteId={selectedAthleteId} onSaved={() => loadProfile(selectedAthleteId)} />
 )}
 </div>
 </>
 )}
 </div>
 );
}

// ── Record PR Mini-Form ─────────────────────────────────────────────

// ── Drill PR Panel ───────────────────────────────────────────────────

const DRILL_TYPE_OPTIONS = [
 { value: "STANDING", label: "Standing" },
 { value: "POWER_POSITION", label: "Power Position" },
 { value: "HALF_TURN", label: "Half Turn" },
 { value: "SOUTH_AFRICAN", label: "South African" },
 { value: "GLIDE", label: "Glide" },
 { value: "SPIN", label: "Full Spin" },
 { value: "FULL_THROW", label: "Full Throw (run-up)" },
];

function DrillPRPanel({
 athleteId,
 drillPRs,
 primaryEvent,
 onSaved,
}: {
 athleteId: string;
 drillPRs: Array<{ id: string; event: string; drillType: string; implement: string; distance: number; achievedAt: string; notes: string | null }>;
 primaryEvent?: string;
 onSaved: () => void;
}) {
 const [showForm, setShowForm] = useState(false);
 const [event, setEvent] = useState(primaryEvent || "SHOT_PUT");
 const [drillType, setDrillType] = useState("STANDING");
 const [implement, setImplement] = useState("");
 const [distance, setDistance] = useState("");
 const [achievedAt, setAchievedAt] = useState(localToday());
 const [notes, setNotes] = useState("");
 const [saving, setSaving] = useState(false);

 async function handleSubmit() {
 if (!implement || !distance) return;
 setSaving(true);
 try {
 const res = await fetch("/api/throws/drill-prs", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({
 athleteId, event, drillType, implement,
 distance: parseFloat(distance), achievedAt,
 notes: notes || undefined,
 }),
 });
 const data = await res.json();
 if (data.success) {
 setShowForm(false);
 setDistance("");
 setNotes("");
 setImplement("");
 onSaved();
 }
 } catch { /* ignore */ }
 setSaving(false);
 }

 return (
 <div className="card !p-5 space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
 Drill PRs
 </h3>
 <button
 onClick={() => setShowForm(!showForm)}
 className="btn-secondary text-xs px-3 py-1.5"
 >
 {showForm ? "Cancel" : "+ Log Drill PR"}
 </button>
 </div>

 {showForm && (
 <div className="bg-[var(--color-surface-2)]/50 rounded-lg p-4 space-y-3">
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Event</label>
 <select
 value={event}
 onChange={(e) => setEvent(e.target.value)}
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 >
 {(Object.keys(EVENTS) as ThrowEvent[]).map((e) => (
 <option key={e} value={e}>{EVENTS[e].label}</option>
 ))}
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Drill Type</label>
 <select
 value={drillType}
 onChange={(e) => setDrillType(e.target.value)}
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 >
 {DRILL_TYPE_OPTIONS.map((d) => (
 <option key={d.value} value={d.value}>{d.label}</option>
 ))}
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Implement</label>
 <input
 type="text"
 value={implement}
 onChange={(e) => setImplement(e.target.value)}
 placeholder="e.g. 7.26kg"
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Distance (m)</label>
 <input
 type="number"
 step="0.01"
 min="0"
 value={distance}
 onChange={(e) => setDistance(e.target.value)}
 placeholder="0.00"
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Date</label>
 <input
 type="date"
 value={achievedAt}
 onChange={(e) => setAchievedAt(e.target.value)}
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Notes</label>
 <input
 type="text"
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 placeholder="Optional"
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 </div>
 </div>
 <button
 onClick={handleSubmit}
 disabled={saving || !implement || !distance}
 className="btn-primary text-xs px-4 py-2"
 >
 {saving ? "Saving..." : "Save Drill PR"}
 </button>
 </div>
 )}

 {drillPRs.length === 0 && !showForm && (
 <p className="text-sm text-[var(--color-text-3)] text-center py-4">
 No drill PRs logged yet.
 </p>
 )}

 {drillPRs.length > 0 && (
 <div className="space-y-5">
 {(Object.keys(EVENTS) as ThrowEvent[])
 .filter((ev) => drillPRs.some((p) => p.event === ev))
 .map((ev) => {
 const eventPRs = drillPRs.filter((p) => p.event === ev);
 const eventMeta = EVENTS[ev];
 return (
 <div key={ev}>
 <div className="flex items-center gap-2 mb-2">
 <span
 className="inline-block w-2 h-2 rounded-full shrink-0"
 style={{ backgroundColor: eventMeta.color }}
 />
 <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-2)]">
 {eventMeta.label}
 </p>
 </div>
 <div className="space-y-1 pl-4">
 {DRILL_TYPE_OPTIONS.filter((dt) =>
 eventPRs.some((p) => p.drillType === dt.value)
 ).map((dt) => {
 const pr = eventPRs.find((p) => p.drillType === dt.value)!;
 return (
 <div
 key={dt.value}
 className="flex items-center justify-between text-sm py-1.5 border-b border-[var(--color-border)] last:border-0"
 >
 <div className="flex items-center gap-3 min-w-0">
 <span className="text-[10px] font-semibold text-[var(--color-text-2)] w-28 shrink-0">
 {dt.label}
 </span>
 <span className="text-xs text-[var(--color-text-3)] w-12 shrink-0">
 {pr.implement}
 </span>
 <span className="font-mono font-bold text-[var(--color-text)]">
 {pr.distance.toFixed(2)}m
 </span>
 {pr.notes && (
 <span className="text-[10px] text-[var(--color-text-3)] italic truncate max-w-[120px]">
 {pr.notes}
 </span>
 )}
 </div>
 <span className="text-[10px] text-[var(--color-text-3)] shrink-0 ml-2">{pr.achievedAt}</span>
 </div>
 );
 })}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
}

// ── Testing Metrics Panel ─────────────────────────────────────────────

type TestingField = {
 key: string;
 label: string;
 metricUnit: string;
 imperialUnit: string | null; // null = no imperial equivalent (e.g. seconds)
 imperialFactor: number | null; // metric × factor = imperial
 step: string;
};

// Storage is always metric. imperialFactor: metric × factor = imperial.
const TESTING_FIELDS: Record<string, TestingField[]> = {
 Strength: [
 { key: "squat1RM", label: "Back Squat", metricUnit: "kg", imperialUnit: "lbs", imperialFactor: 2.20462, step: "0.5" },
 { key: "powerClean1RM", label: "Power Clean", metricUnit: "kg", imperialUnit: "lbs", imperialFactor: 2.20462, step: "0.5" },
 { key: "snatch1RM", label: "Snatch", metricUnit: "kg", imperialUnit: "lbs", imperialFactor: 2.20462, step: "0.5" },
 { key: "bench1RM", label: "Bench Press", metricUnit: "kg", imperialUnit: "lbs", imperialFactor: 2.20462, step: "0.5" },
 { key: "deadlift1RM", label: "Deadlift", metricUnit: "kg", imperialUnit: "lbs", imperialFactor: 2.20462, step: "0.5" },
 { key: "overheadPress1RM",label: "Overhead Press", metricUnit: "kg", imperialUnit: "lbs", imperialFactor: 2.20462, step: "0.5" },
 ],
 Speed: [
 { key: "sprintTime30m", label: "30m Sprint", metricUnit: "s", imperialUnit: null, imperialFactor: null, step: "0.01" },
 { key: "sprintTime60m", label: "60m Sprint", metricUnit: "s", imperialUnit: null, imperialFactor: null, step: "0.01" },
 { key: "sprintTime100m", label: "100m Sprint", metricUnit: "s", imperialUnit: null, imperialFactor: null, step: "0.01" },
 ],
 Power: [
 { key: "overheadMB", label: "Overhead Med Ball", metricUnit: "m", imperialUnit: "ft", imperialFactor: 3.28084, step: "0.01" },
 { key: "rotationalMB", label: "Rotational Med Ball", metricUnit: "m", imperialUnit: "ft", imperialFactor: 3.28084, step: "0.01" },
 { key: "verticalJump", label: "Vertical Jump", metricUnit: "cm", imperialUnit: "in", imperialFactor: 0.393701, step: "0.5" },
 { key: "broadJump", label: "Broad Jump", metricUnit: "m", imperialUnit: "ft", imperialFactor: 3.28084, step: "0.01" },
 ],
};

const ALL_TESTING_FIELDS = Object.values(TESTING_FIELDS).flat();

function round(n: number, decimals: number) {
 return parseFloat(n.toFixed(decimals));
}

function TestingMetricsPanel({
 athleteId,
 benchmarks,
 onSaved,
}: {
 athleteId: string;
 benchmarks: Record<string, number | null>;
 onSaved: () => void;
}) {
 const [editing, setEditing] = useState(false);
 // form values stored in whatever unit the user picked for that field
 const [form, setForm] = useState<Record<string, string>>({});
 // per-field unit preference during editing
 const [fieldUnits, setFieldUnits] = useState<Record<string, "metric" | "imperial">>({});
 const [saving, setSaving] = useState(false);

 function startEdit() {
 const initForm: Record<string, string> = {};
 const initUnits: Record<string, "metric" | "imperial"> = {};
 ALL_TESTING_FIELDS.forEach(({ key }) => {
 initForm[key] = benchmarks[key] != null ? String(benchmarks[key]) : "";
 initUnits[key] = "metric";
 });
 setForm(initForm);
 setFieldUnits(initUnits);
 setEditing(true);
 }

 function toggleUnit(field: TestingField) {
 if (!field.imperialUnit || !field.imperialFactor) return;
 const current = fieldUnits[field.key] ?? "metric";
 const next = current === "metric" ? "imperial" : "metric";
 const raw = parseFloat(form[field.key]);
 setFieldUnits((prev) => ({ ...prev, [field.key]: next }));
 if (!isNaN(raw) && raw !== 0) {
 const converted = next === "imperial"
 ? round(raw * field.imperialFactor, 2)
 : round(raw / field.imperialFactor, 2);
 setForm((prev) => ({ ...prev, [field.key]: String(converted) }));
 }
 }

 async function handleSave() {
 setSaving(true);
 const payload: Record<string, number | null> = {};
 ALL_TESTING_FIELDS.forEach((field) => {
 const v = form[field.key];
 if (v === "" || v == null) { payload[field.key] = null; return; }
 const parsed = parseFloat(v);
 if (isNaN(parsed)) { payload[field.key] = null; return; }
 // Convert imperial → metric for storage
 if (fieldUnits[field.key] === "imperial" && field.imperialFactor) {
 payload[field.key] = round(parsed / field.imperialFactor, 3);
 } else {
 payload[field.key] = parsed;
 }
 });
 try {
 const res = await fetch("/api/throws/testing", {
 method: "PATCH",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({ athleteId, benchmarks: payload }),
 });
 const data = await res.json();
 if (data.success) { setEditing(false); onSaved(); }
 } catch { /* ignore */ }
 setSaving(false);
 }

 const allEmpty = ALL_TESTING_FIELDS.every(({ key }) => benchmarks[key] == null);

 return (
 <div className="card !p-5 space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
 Testing Metrics
 </h3>
 {!editing && (
 <button onClick={startEdit} className="btn-secondary text-xs px-3 py-1.5">
 {allEmpty ? "+ Add Benchmarks" : "Edit"}
 </button>
 )}
 </div>

 {editing ? (
 <div className="space-y-5">
 {Object.entries(TESTING_FIELDS).map(([category, fields]) => (
 <div key={category}>
 <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] mb-2">
 {category}
 </p>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 {fields.map((field) => {
 const isImperial = fieldUnits[field.key] === "imperial";
 const activeUnit = isImperial ? field.imperialUnit! : field.metricUnit;
 return (
 <div key={field.key} className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">
 {field.label}
 </label>
 <div className="flex items-center gap-1">
 <input
 type="number"
 step={field.step}
 min="0"
 value={form[field.key] || ""}
 onChange={(e) =>
 setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
 }
 placeholder="—"
 className="w-full min-w-0 px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 {field.imperialUnit ? (
 <button
 type="button"
 onClick={() => toggleUnit(field)}
 title={`Switch to ${isImperial ? field.metricUnit : field.imperialUnit}`}
 className="shrink-0 px-1.5 py-1 rounded text-[10px] font-bold border transition-colors whitespace-nowrap
 border-[var(--color-border-strong)]
 hover:border-[var(--color-gold)] hover:text-[var(--color-gold-dark)] dark:hover:text-[var(--color-gold-light)]
 text-[var(--color-text-2)]"
 >
 {activeUnit}
 </button>
 ) : (
 <span className="shrink-0 text-xs text-[var(--color-text-3)] whitespace-nowrap">{activeUnit}</span>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 ))}
 <div className="flex gap-2">
 <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-4 py-2">
 {saving ? "Saving..." : "Save"}
 </button>
 <button onClick={() => setEditing(false)} className="btn-secondary text-xs px-4 py-2">
 Cancel
 </button>
 </div>
 </div>
 ) : allEmpty ? (
 <p className="text-sm text-[var(--color-text-3)] text-center py-4">
 No benchmarks recorded yet.
 </p>
 ) : (
 <div className="space-y-4">
 {Object.entries(TESTING_FIELDS).map(([category, fields]) => {
 const populated = fields.filter(({ key }) => benchmarks[key] != null);
 if (populated.length === 0) return null;
 return (
 <div key={category}>
 <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)] mb-2">
 {category}
 </p>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
 {populated.map((field) => {
 const metricVal = benchmarks[field.key]!;
 const imperialVal = field.imperialFactor != null
 ? round(metricVal * field.imperialFactor, 1)
 : null;
 return (
 <div
 key={field.key}
 className="bg-[var(--color-surface-2)]/50 rounded-lg px-3 py-2"
 >
 <p className="text-xs text-[var(--color-text-2)] truncate mb-0.5">
 {field.label}
 </p>
 <p className="text-sm font-mono font-bold text-[var(--color-text)]">
 {metricVal}{field.metricUnit}
 {imperialVal != null && (
 <span className="ml-1.5 text-[10px] font-normal text-[var(--color-text-3)]">
 {imperialVal}{field.imperialUnit}
 </span>
 )}
 </p>
 </div>
 );
 })}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
}

// ── Record Competition PR Form ────────────────────────────────────────

function RecordPRForm({
 athleteId,
 onSaved,
}: {
 athleteId: string;
 onSaved: () => void;
}) {
 const [event, setEvent] = useState<string>("SHOT_PUT");
 const [implement, setImplement] = useState("");
 const [distance, setDistance] = useState("");
 const [saving, setSaving] = useState(false);

 async function handleSubmit() {
 if (!implement || !distance) return;
 setSaving(true);
 try {
 const res = await fetch("/api/throws/prs", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({
 athleteId,
 event,
 implement,
 distance: parseFloat(distance),
 source: "MANUAL",
 }),
 });
 const data = await res.json();
 if (data.success) onSaved();
 } catch { /* ignore */ }
 setSaving(false);
 }

 return (
 <div className="card !p-5 space-y-4">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
 Record Personal Record
 </h3>
 <div className="grid grid-cols-3 gap-3">
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Event</label>
 <select
 value={event}
 onChange={(e) => setEvent(e.target.value)}
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 >
 {(Object.keys(EVENTS) as ThrowEvent[]).map((e) => (
 <option key={e} value={e}>{EVENTS[e].label}</option>
 ))}
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Implement</label>
 <input
 type="text"
 value={implement}
 onChange={(e) => setImplement(e.target.value)}
 placeholder="e.g. 7.26kg"
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Distance (m)</label>
 <input
 type="number"
 step="0.01"
 min="0"
 value={distance}
 onChange={(e) => setDistance(e.target.value)}
 placeholder="0.00"
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 </div>
 </div>
 <button
 onClick={handleSubmit}
 disabled={saving || !implement || !distance}
 className="btn-primary text-xs px-4 py-2"
 >
 {saving ? "Saving..." : "Save PR"}
 </button>
 </div>
 );
}

// ── Manage Complex Form ──────────────────────────────────────────────

function ManageComplexForm({
 athleteId,
 currentComplex,
 primaryEvent,
 onSaved,
}: {
 athleteId: string;
 currentComplex?: { startDate: string; exercises: string; sessionsCount: number; event: string } | null;
 primaryEvent?: string;
 onSaved: () => void;
}) {
 const [expanded, setExpanded] = useState(!currentComplex);
 const [selectedExercises, setSelectedExercises] = useState<string[]>(() => {
 try { return JSON.parse(currentComplex?.exercises || "[]"); } catch { return []; }
 });
 const [customExercise, setCustomExercise] = useState("");
 const [event, setEvent] = useState(currentComplex?.event || primaryEvent || "SHOT_PUT");
 const [startDate] = useState(localToday());
 const [saving, setSaving] = useState(false);

 function toggleExercise(name: string) {
 setSelectedExercises((prev) =>
 prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name],
 );
 }

 function addCustom() {
 const trimmed = customExercise.trim();
 if (!trimmed || selectedExercises.includes(trimmed)) { setCustomExercise(""); return; }
 setSelectedExercises((prev) => [...prev, trimmed]);
 setCustomExercise("");
 }

 async function handleSubmit() {
 if (selectedExercises.length === 0) return;
 setSaving(true);
 try {
 const res = await fetch("/api/throws/complexes", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({ athleteId, startDate, exercises: selectedExercises, event }),
 });
 const data = await res.json();
 if (data.success) { setExpanded(false); onSaved(); }
 } catch { /* ignore */ }
 setSaving(false);
 }

 if (!expanded) {
 return (
 <div className="flex items-center justify-between">
 <div className="text-xs text-[var(--color-text-2)]">
 {currentComplex ? (
 <>Active since <strong className="text-[var(--color-text-2)]">{currentComplex.startDate}</strong> · {currentComplex.sessionsCount} sessions</>
 ) : "No active complex"}
 </div>
 <button onClick={() => setExpanded(true)} className="btn-secondary text-xs px-3 py-1.5">
 {currentComplex ? "New Complex" : "Start Complex"}
 </button>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {currentComplex && (
 <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
 <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
 Starting a new complex will close the current one (started {currentComplex.startDate}).
 </p>
 </div>
 )}
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Event</label>
 <select
 value={event}
 onChange={(e) => setEvent(e.target.value)}
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 >
 {(Object.keys(EVENTS) as ThrowEvent[]).map((e) => (
 <option key={e} value={e}>{EVENTS[e].label}</option>
 ))}
 </select>
 </div>
 <div className="space-y-2">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">
 Strength Exercises <span className="font-normal text-[var(--color-text-3)]">(select all in this complex)</span>
 </label>
 <div className="flex flex-wrap gap-1.5">
 {STRENGTH_DB.map((ex) => (
 <button
 key={ex.id}
 onClick={() => toggleExercise(ex.name)}
 className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
 selectedExercises.includes(ex.name)
 ? "bg-[var(--color-gold)] text-[var(--color-bg)] border-[var(--color-gold)]"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] border-[var(--color-border)] hover:border-[var(--color-gold)]"
 }`}
 >
 {ex.name}
 <span className="ml-1 opacity-60 text-[9px]">{ex.classification}</span>
 </button>
 ))}
 </div>
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">
 Add Implement <span className="font-normal text-[var(--color-text-3)]">(e.g. &quot;5kg Shot&quot;, &quot;9kg Hammer&quot;)</span>
 </label>
 <div className="flex gap-2">
 <input
 type="text"
 value={customExercise}
 onChange={(e) => setCustomExercise(e.target.value)}
 onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
 placeholder="5kg Shot"
 className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 <button onClick={addCustom} className="btn-secondary text-xs px-3 py-2">Add</button>
 </div>
 </div>
 {selectedExercises.length > 0 && (
 <div className="space-y-1">
 <p className="text-[10px] text-[var(--color-text-2)] font-semibold uppercase">Selected ({selectedExercises.length})</p>
 <div className="flex flex-wrap gap-1.5">
 {selectedExercises.map((ex) => (
 <span
 key={ex}
 className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[rgba(212,168,67,0.12)] text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)]"
 >
 {ex}
 <button onClick={() => toggleExercise(ex)} className="hover:text-red-500 leading-none">×</button>
 </span>
 ))}
 </div>
 </div>
 )}
 <div className="flex gap-2">
 <button
 onClick={handleSubmit}
 disabled={saving || selectedExercises.length === 0}
 className="btn-primary text-xs px-4 py-2"
 >
 {saving ? "Saving..." : "Start Complex"}
 </button>
 <button onClick={() => setExpanded(false)} className="btn-secondary text-xs px-3 py-2">Cancel</button>
 </div>
 </div>
 );
}

// ── Add Competition Mini-Form ────────────────────────────────────────

function AddCompetitionForm({
 athleteId,
 onSaved,
}: {
 athleteId: string;
 onSaved: () => void;
}) {
 const [name, setName] = useState("");
 const [date, setDate] = useState("");
 const [event, setEvent] = useState<string>("SHOT_PUT");
 const [priority, setPriority] = useState("B");
 const [saving, setSaving] = useState(false);
 const [expanded, setExpanded] = useState(false);

 async function handleSubmit() {
 if (!name || !date) return;
 setSaving(true);
 try {
 await fetch("/api/throws/competitions", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({ athleteId, name, date, event, priority }),
 });
 onSaved();
 } catch { /* ignore */ }
 setSaving(false);
 }

 if (!expanded) {
 return (
 <div className="text-center py-4">
 <p className="text-xs text-[var(--color-text-3)] mb-2">No upcoming competitions.</p>
 <button onClick={() => setExpanded(true)} className="btn-secondary text-xs px-4 py-1.5">
 Add Competition
 </button>
 </div>
 );
 }

 return (
 <div className="space-y-3">
 <input
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="Meet name"
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 <div className="grid grid-cols-3 gap-2">
 <input
 type="date"
 value={date}
 onChange={(e) => setDate(e.target.value)}
 className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 <select
 value={event}
 onChange={(e) => setEvent(e.target.value)}
 className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 >
 {(Object.keys(EVENTS) as ThrowEvent[]).map((e) => (
 <option key={e} value={e}>{EVENTS[e].label}</option>
 ))}
 </select>
 <select
 value={priority}
 onChange={(e) => setPriority(e.target.value)}
 className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 >
 <option value="A">A (Priority)</option>
 <option value="B">B (Standard)</option>
 <option value="C">C (Low)</option>
 </select>
 </div>
 <button onClick={handleSubmit} disabled={saving || !name || !date} className="btn-primary text-xs px-4 py-2">
 {saving ? "Saving..." : "Add Competition"}
 </button>
 </div>
 );
}

// ── Athlete Bio Edit Form ─────────────────────────────────────────────

function AthleteBioEditForm({
 athleteId,
 currentBio,
 onSaved,
}: {
 athleteId: string;
 currentBio: { gender: string | null; sport: string | null; height: number | null; weight: number | null };
 onSaved: () => void;
}) {
 const [gender, setGender] = useState(currentBio.gender || "");
 const [sport, setSport] = useState(currentBio.sport || "");
 const [height, setHeight] = useState(currentBio.height?.toString() || "");
 const [weight, setWeight] = useState(currentBio.weight?.toString() || "");
 const [saving, setSaving] = useState(false);

 async function handleSubmit() {
 setSaving(true);
 try {
 const res = await fetch("/api/throws/athlete-bio", {
 method: "PATCH",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({ athleteId, gender: gender || null, sport: sport || null, height: height || null, weight: weight || null }),
 });
 const data = await res.json();
 if (data.success) onSaved();
 } catch { /* ignore */ }
 setSaving(false);
 }

 return (
 <div className="card !p-5 space-y-4 border-2 border-purple-200 dark:border-purple-800">
 <div className="flex items-center gap-2">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">Edit Athlete Bio</h3>
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Coach</span>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Gender</label>
 <select
 value={gender}
 onChange={(e) => setGender(e.target.value)}
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 >
 <option value="">Not set</option>
 <option value="MALE">Male</option>
 <option value="FEMALE">Female</option>
 <option value="OTHER">Other</option>
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Sport / Event</label>
 <input
 type="text"
 value={sport}
 onChange={(e) => setSport(e.target.value)}
 placeholder="e.g. Shot Put"
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Height (cm)</label>
 <input
 type="number"
 value={height}
 onChange={(e) => setHeight(e.target.value)}
 placeholder="185"
 min={100}
 max={250}
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-[var(--color-text-2)]">Weight (kg)</label>
 <input
 type="number"
 value={weight}
 onChange={(e) => setWeight(e.target.value)}
 placeholder="110"
 min={30}
 max={300}
 step={0.1}
 className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 />
 </div>
 </div>
 <button onClick={handleSubmit} disabled={saving} className="btn-primary text-xs px-4 py-2">
 {saving ? "Saving..." : "Save Bio"}
 </button>
 </div>
 );
}

// ── Competitions Panel ────────────────────────────────────────────────

function CompetitionsPanel({
 athleteId,
 competitions,
 today,
 onSaved,
}: {
 athleteId: string;
 competitions: Array<{ id: string; name: string; date: string; event: string; priority: string; result: number | null; resultBy: string | null }>;
 today: string;
 onSaved: () => void;
}) {
 const [editingId, setEditingId] = useState<string | null>(null);
 const [resultInput, setResultInput] = useState("");
 const [saving, setSaving] = useState(false);
 const [showAdd, setShowAdd] = useState(false);

 async function handleSaveResult(id: string) {
 setSaving(true);
 try {
 const res = await fetch("/api/throws/competitions", {
 method: "PATCH",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({ id, result: resultInput, resultBy: "COACH" }),
 });
 const data = await res.json();
 if (data.success) { setEditingId(null); onSaved(); }
 } catch { /* ignore */ }
 setSaving(false);
 }

 const past = competitions.filter((c) => c.date < today).sort((a, b) => b.date.localeCompare(a.date));
 const upcoming = competitions.filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date));

 return (
 <div className="card !p-5 space-y-4 border-2 border-purple-200 dark:border-purple-800">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">Competitions</h3>
 <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Coach</span>
 </div>
 <button onClick={() => setShowAdd(!showAdd)} className="btn-secondary text-xs px-3 py-1.5">
 {showAdd ? "Cancel" : "+ Add"}
 </button>
 </div>

 {showAdd && (
 <div className="p-3 rounded-lg bg-[var(--color-surface-2)]/50 border border-[var(--color-border)]">
 <AddCompetitionForm athleteId={athleteId} onSaved={() => { setShowAdd(false); onSaved(); }} />
 </div>
 )}

 {upcoming.length > 0 && (
 <div className="space-y-2">
 <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)]">Upcoming</p>
 {upcoming.map((c) => (
 <div key={c.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0 gap-2 flex-wrap">
 <div>
 <p className="text-xs font-semibold text-[var(--color-text)]">{c.name}</p>
 <p className="text-[10px] text-[var(--color-text-2)]">{c.date} · {EVENTS[c.event as ThrowEvent]?.label || c.event} · Priority {c.priority}</p>
 </div>
 <div className="flex items-center gap-2">
 {c.result != null ? (
 <div className="flex items-center gap-1">
 <span className="text-xs font-mono font-bold text-[var(--color-text)]">{c.result.toFixed(2)}m</span>
 {c.resultBy && <SourceBadge source={c.resultBy} />}
 <button onClick={() => { setEditingId(c.id); setResultInput(c.result!.toString()); }} className="text-[10px] text-purple-600 hover:underline">Edit</button>
 </div>
 ) : (
 <button onClick={() => { setEditingId(c.id); setResultInput(""); }} className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-medium">Enter Result</button>
 )}
 </div>
 {editingId === c.id && (
 <div className="w-full flex items-center gap-2 mt-1">
 <input
 type="number"
 step="0.01"
 value={resultInput}
 onChange={(e) => setResultInput(e.target.value)}
 placeholder="Distance (m)"
 className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 autoFocus
 />
 <button onClick={() => handleSaveResult(c.id)} disabled={saving} className="btn-primary text-xs px-3 py-1.5">{saving ? "..." : "Save"}</button>
 <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
 </div>
 )}
 </div>
 ))}
 </div>
 )}

 {past.length > 0 && (
 <div className="space-y-2">
 <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-2)]">Past</p>
 {past.map((c) => (
 <div key={c.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0 gap-2 flex-wrap">
 <div>
 <p className="text-xs font-semibold text-[var(--color-text)]">{c.name}</p>
 <p className="text-[10px] text-[var(--color-text-2)]">{c.date} · {EVENTS[c.event as ThrowEvent]?.label || c.event} · Priority {c.priority}</p>
 </div>
 <div className="flex items-center gap-2">
 {c.result != null ? (
 <div className="flex items-center gap-1">
 <span className="text-xs font-mono font-bold text-[var(--color-text)]">{c.result.toFixed(2)}m</span>
 {c.resultBy && <SourceBadge source={c.resultBy} />}
 <button onClick={() => { setEditingId(c.id); setResultInput(c.result!.toString()); }} className="text-[10px] text-purple-600 hover:underline">Edit</button>
 </div>
 ) : (
 <button onClick={() => { setEditingId(c.id); setResultInput(""); }} className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-medium">Enter Result</button>
 )}
 </div>
 {editingId === c.id && (
 <div className="w-full flex items-center gap-2 mt-1">
 <input
 type="number"
 step="0.01"
 value={resultInput}
 onChange={(e) => setResultInput(e.target.value)}
 placeholder="Distance (m)"
 className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]"
 autoFocus
 />
 <button onClick={() => handleSaveResult(c.id)} disabled={saving} className="btn-primary text-xs px-3 py-1.5">{saving ? "..." : "Save"}</button>
 <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
 </div>
 )}
 </div>
 ))}
 </div>
 )}

 {competitions.length === 0 && !showAdd && (
 <p className="text-xs text-[var(--color-text-3)] italic text-center py-2">No competitions recorded yet.</p>
 )}
 </div>
 );
}

// ── Typing Override Form ──────────────────────────────────────────────

function TypingOverrideForm({
 athleteId,
 current,
 onSaved,
}: {
 athleteId: string;
 current: { adaptationGroup: number | null; transferType: string | null; selfFeelingAccuracy: string | null; lightImplResponse: string | null; recoveryProfile: string | null } | null;
 onSaved: () => void;
}) {
 const [adaptationGroup, setAdaptationGroup] = useState(current?.adaptationGroup?.toString() || "");
 const [transferType, setTransferType] = useState(current?.transferType || "");
 const [selfFeelingAccuracy, setSelfFeelingAccuracy] = useState(current?.selfFeelingAccuracy || "");
 const [lightImplResponse, setLightImplResponse] = useState(current?.lightImplResponse || "");
 const [recoveryProfile, setRecoveryProfile] = useState(current?.recoveryProfile || "");
 const [saving, setSaving] = useState(false);

 async function handleSubmit() {
 setSaving(true);
 try {
 const res = await fetch("/api/throws/typing", {
 method: "PATCH",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({
 athleteId,
 adaptationGroup: adaptationGroup || undefined,
 transferType: transferType || undefined,
 selfFeelingAccuracy: selfFeelingAccuracy || undefined,
 lightImplResponse: lightImplResponse || undefined,
 recoveryProfile: recoveryProfile || undefined,
 }),
 });
 const data = await res.json();
 if (data.success) onSaved();
 } catch { /* ignore */ }
 setSaving(false);
 }

 const inputCls = "w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)]";

 return (
 <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 space-y-3">
 <p className="text-[10px] text-purple-700 dark:text-purple-400 font-semibold uppercase tracking-wider">
 Coach Manual Override — sets classification directly without quiz
 </p>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 <div className="space-y-1">
 <label className="text-[10px] font-semibold text-[var(--color-text-2)] uppercase">Adaptation Group</label>
 <select value={adaptationGroup} onChange={(e) => setAdaptationGroup(e.target.value)} className={inputCls}>
 <option value="">Not set</option>
 <option value="1">1 — Fast</option>
 <option value="2">2 — Moderate</option>
 <option value="3">3 — Slow</option>
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-semibold text-[var(--color-text-2)] uppercase">Transfer Type</label>
 <select value={transferType} onChange={(e) => setTransferType(e.target.value)} className={inputCls}>
 <option value="">Not set</option>
 <option value="direct-high">Direct High</option>
 <option value="direct-moderate">Direct Moderate</option>
 <option value="indirect">Indirect</option>
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-semibold text-[var(--color-text-2)] uppercase">Self-Feeling</label>
 <select value={selfFeelingAccuracy} onChange={(e) => setSelfFeelingAccuracy(e.target.value)} className={inputCls}>
 <option value="">Not set</option>
 <option value="accurate">Accurate</option>
 <option value="moderate">Moderate</option>
 <option value="poor">Poor</option>
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-semibold text-[var(--color-text-2)] uppercase">Light Impl Response</label>
 <select value={lightImplResponse} onChange={(e) => setLightImplResponse(e.target.value)} className={inputCls}>
 <option value="">Not set</option>
 <option value="normal-87pct">Normal (87%)</option>
 <option value="tolerant-13pct">Tolerant (13%)</option>
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-semibold text-[var(--color-text-2)] uppercase">Recovery Profile</label>
 <select value={recoveryProfile} onChange={(e) => setRecoveryProfile(e.target.value)} className={inputCls}>
 <option value="">Not set</option>
 <option value="fast">Fast</option>
 <option value="standard">Standard</option>
 <option value="slow">Slow</option>
 </select>
 </div>
 </div>
 <button onClick={handleSubmit} disabled={saving} className="btn-primary text-xs px-4 py-2">
 {saving ? "Saving..." : "Save Override"}
 </button>
 </div>
 );
}

// ── PR Progression Chart ──────────────────────────────────────────────

type PRHistoryEntry = { event: string; implement: string; distance: number; achievedAt: string };
type BenchmarkHistoryEntry = { recordedAt: string; benchmarks: string };

const BENCH_OVERLAY_OPTIONS = [
 { key: "squat1RM", label: "Squat 1RM (kg)" },
 { key: "bench1RM", label: "Bench 1RM (kg)" },
 { key: "deadlift1RM", label: "Deadlift 1RM (kg)" },
 { key: "cleanAndJerk1RM", label: "Clean & Jerk (kg)" },
 { key: "snatch1RM", label: "Snatch (kg)" },
 { key: "vo2max", label: "VO₂max" },
];

const OVERLAY_COLOR = "#a78bfa"; // purple for benchmark overlays

function PRProgressionChart({ athleteId }: { athleteId: string }) {
 const [prHistory, setPrHistory] = useState<PRHistoryEntry[]>([]);
 const [benchHistory, setBenchHistory] = useState<BenchmarkHistoryEntry[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedEvent, setSelectedEvent] = useState<string>("SHOT_PUT");
 const [selectedImplement, setSelectedImplement] = useState<string>("");
 const [overlay, setOverlay] = useState<string>("");

 useEffect(() => {
 if (!athleteId) return;
 setLoading(true);
 fetch(`/api/throws/progression?athleteId=${athleteId}`)
 .then((r) => r.json())
 .then((d) => {
 if (d.success) {
 setPrHistory(d.data.prHistory);
 setBenchHistory(d.data.benchmarkHistory);
 }
 })
 .finally(() => setLoading(false));
 }, [athleteId]);

 // Derive available events & implements from history
 const eventOptions = Array.from(new Set(prHistory.map((p) => p.event)));
 const implementOptions = Array.from(
 new Set(prHistory.filter((p) => p.event === selectedEvent).map((p) => p.implement))
 );

 // Auto-select first implement when event changes
 useEffect(() => {
 if (implementOptions.length > 0 && !implementOptions.includes(selectedImplement)) {
 setSelectedImplement(implementOptions[0]);
 }
 }, [selectedEvent, implementOptions, selectedImplement]);

 // Build chart data: merge PR points + benchmark snapshots on shared date axis
 const filteredPRs = prHistory
 .filter((p) => p.event === selectedEvent && (!selectedImplement || p.implement === selectedImplement))
 .sort((a, b) => a.achievedAt.localeCompare(b.achievedAt));

 // Collect all unique dates
 const allDates = Array.from(
 new Set([
 ...filteredPRs.map((p) => p.achievedAt),
 ...(overlay ? benchHistory.map((b) => b.recordedAt) : []),
 ])
 ).sort();

 const chartData = allDates.map((date) => {
 const prPoint = filteredPRs.find((p) => p.achievedAt === date);
 const benchPoint = overlay
 ? benchHistory
 .filter((b) => b.recordedAt <= date)
 .slice(-1)[0]
 : null;
 const benchVal = benchPoint
 ? (JSON.parse(benchPoint.benchmarks) as Record<string, number | null>)[overlay]
 : undefined;

 return {
 date,
 distance: prPoint ? prPoint.distance : null,
 [overlay || "__none"]: benchVal ?? null,
 };
 });

 const eventMeta = EVENTS[selectedEvent as ThrowEvent];

 if (loading) {
 return (
 <div className="card !p-5 flex items-center justify-center h-32">
 <p className="text-sm text-[var(--color-text-3)]">Loading progression…</p>
 </div>
 );
 }

 if (prHistory.length === 0) {
 return null; // No history yet — don't show the card
 }

 return (
 <div className="card !p-5 space-y-4">
 <div className="flex items-center justify-between flex-wrap gap-2">
 <h3 className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">
 PR Progression
 </h3>
 <div className="flex items-center gap-2 flex-wrap">
 {/* Event selector */}
 <select
 value={selectedEvent}
 onChange={(e) => setSelectedEvent(e.target.value)}
 className="text-xs px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
 >
 {eventOptions.map((ev) => (
 <option key={ev} value={ev}>
 {EVENTS[ev as ThrowEvent]?.label ?? ev}
 </option>
 ))}
 </select>
 {/* Implement selector */}
 {implementOptions.length > 1 && (
 <select
 value={selectedImplement}
 onChange={(e) => setSelectedImplement(e.target.value)}
 className="text-xs px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
 >
 {implementOptions.map((imp) => (
 <option key={imp} value={imp}>{imp}</option>
 ))}
 </select>
 )}
 {/* Overlay selector */}
 <select
 value={overlay}
 onChange={(e) => setOverlay(e.target.value)}
 className="text-xs px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
 >
 <option value="">+ Compare metric</option>
 {BENCH_OVERLAY_OPTIONS.map((o) => (
 <option key={o.key} value={o.key}>{o.label}</option>
 ))}
 </select>
 </div>
 </div>

 {filteredPRs.length < 2 ? (
 <p className="text-xs text-[var(--color-text-3)] text-center py-6 italic">
 Need at least 2 PR entries to show a progression chart.
 </p>
 ) : (
 <ResponsiveContainer width="100%" height={220}>
 <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.2)" />
 <XAxis
 dataKey="date"
 tick={{ fontSize: 10, fill: "#9ca3af" }}
 tickFormatter={(v: string) => v.slice(5)} // MM-DD
 />
 <YAxis
 yAxisId="left"
 tick={{ fontSize: 10, fill: "#9ca3af" }}
 tickFormatter={(v: number) => `${v}m`}
 domain={["auto", "auto"]}
 />
 {overlay && (
 <YAxis
 yAxisId="right"
 orientation="right"
 tick={{ fontSize: 10, fill: OVERLAY_COLOR }}
 />
 )}
 <Tooltip
 contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", fontSize: 12 }}
 labelStyle={{ color: "#d1d5db" }}
 formatter={(value: number, name: string) =>
 name === "distance"
 ? [`${value?.toFixed(2)}m`, eventMeta?.label ?? selectedEvent]
 : [value, BENCH_OVERLAY_OPTIONS.find((o) => o.key === name)?.label ?? name]
 }
 />
 <Legend
 wrapperStyle={{ fontSize: 11 }}
 formatter={(value: string) =>
 value === "distance"
 ? (eventMeta?.label ?? selectedEvent)
 : (BENCH_OVERLAY_OPTIONS.find((o) => o.key === value)?.label ?? value)
 }
 />
 <Line
 yAxisId="left"
 type="monotone"
 dataKey="distance"
 stroke={eventMeta?.color ?? "#6A9FD8"}
 strokeWidth={2.5}
 dot={{ r: 4, fill: eventMeta?.color ?? "#6A9FD8", strokeWidth: 0 }}
 connectNulls
 activeDot={{ r: 6 }}
 />
 {overlay && (
 <Line
 yAxisId="right"
 type="monotone"
 dataKey={overlay}
 stroke={OVERLAY_COLOR}
 strokeWidth={2}
 strokeDasharray="5 3"
 dot={{ r: 3, fill: OVERLAY_COLOR, strokeWidth: 0 }}
 connectNulls
 />
 )}
 </LineChart>
 </ResponsiveContainer>
 )}
 </div>
 );
}
