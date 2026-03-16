"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import UserAvatar from "@/components/user-avatar";
import { csrfHeaders } from "@/lib/csrf-client";
import { type EventCode, type GenderCode } from "@/lib/throws/constants";
import {
 DEFICIT_TYPE_LABELS,
 DEFICIT_LEVEL_COLORS,
 DEFICIT_LEVEL_BG,
 type DeficitType,
 type DeficitLevel,
} from "@/lib/throws/podium-profile";

// ── Types ─────────────────────────────────────────────────────────────────

interface CoachAthlete {
 id: string;
 profilePictureUrl?: string | null;
 user: { firstName: string; lastName: string; email: string };
}

interface ThrowsProfileRow {
 id: string;
 athleteId: string;
 event: string;
 gender: string;
 status: string;
 competitionPb: number | null;
 currentDistanceBand: string | null;
 deficitPrimary: string | null;
 deficitSecondary: string | null;
 deficitStatus: string | null;
 overPowered: boolean;
 enrolledAt: string;
 athlete: CoachAthlete;
 testingRecords: { testDate: string; testType: string }[];
}

function daysSince(dateStr: string): number {
 return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function TestingBadge({ records }: { records: { testDate: string }[] }) {
 if (records.length === 0) {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex-shrink-0">
 <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 Never tested
 </span>
 );
 }
 const days = daysSince(records[0].testDate);
 if (days > 14) {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex-shrink-0">
 <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 Test due · {days}d ago
 </span>
 );
 }
 if (days > 7) {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex-shrink-0">
 <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 {days}d ago
 </span>
 );
 }
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex-shrink-0">
 <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 {days === 0 ? "Tested today" : `${days}d ago`}
 </span>
 );
}

const EVENT_LABELS: Record<EventCode, string> = {
 SP: "Shot Put",
 DT: "Discus",
 HT: "Hammer",
 JT: "Javelin",
};

const EVENT_COLORS: Record<EventCode, string> = {
 SP: "#D4915A",
 DT: "#6A9FD8",
 HT: "#5BB88A",
 JT: "#D46A6A",
};

// ── Page ──────────────────────────────────────────────────────────────────

export default function ThrowsRosterPage() {
 const [podiumAthletes, setPodiumAthletes] = useState<ThrowsProfileRow[]>([]);
 const [allAthletes, setAllAthletes] = useState<CoachAthlete[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState<"podium" | "all">("podium");

 // Enrollment form
 const [enrollOpen, setEnrollOpen] = useState(false);
 const [enrollForm, setEnrollForm] = useState({
 athleteId: "",
 event: "" as EventCode | "",
 gender: "" as GenderCode | "",
 competitionPb: "",
 });
 const [saving, setSaving] = useState(false);
 const [saveError, setSaveError] = useState("");

 // Removal
 const [removingId, setRemovingId] = useState<string | null>(null);
 const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
 const [removeError, setRemoveError] = useState("");

 // ── Data fetching ──────────────────────────────────────────────

 const fetchData = useCallback(() => {
 setLoading(true);
 Promise.all([
 fetch("/api/throws/podium-roster").then((r) => r.json()),
 fetch("/api/athletes").then((r) => r.json()),
 ])
 .then(([podiumData, athletesData]) => {
 if (podiumData.success) setPodiumAthletes(podiumData.data);
 if (athletesData.success) {
 const list = Array.isArray(athletesData.data)
 ? athletesData.data
 : athletesData.data
 ? [athletesData.data]
 : [];
 setAllAthletes(list);
 }
 setLoading(false);
 })
 .catch(() => setLoading(false));
 }, []);

 useEffect(() => {
 fetchData();
 }, [fetchData]);

 // ── Derived state ──────────────────────────────────────────────

 const enrolledAthleteIds = new Set(podiumAthletes.map((p) => p.athleteId));
 const unenrolledAthletes = allAthletes.filter(
 (a) => !enrolledAthleteIds.has(a.id)
 );

 // ── Enrollment ─────────────────────────────────────────────────

 async function handleEnroll(e: React.FormEvent) {
 e.preventDefault();
 if (!enrollForm.athleteId || !enrollForm.event || !enrollForm.gender) return;
 setSaving(true);
 setSaveError("");
 try {
 const res = await fetch("/api/throws/podium-roster", {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({
 athleteId: enrollForm.athleteId,
 event: enrollForm.event,
 gender: enrollForm.gender,
 competitionPb: enrollForm.competitionPb
 ? parseFloat(enrollForm.competitionPb)
 : undefined,
 }),
 });
 const data = await res.json();
 if (data.success) {
 setEnrollOpen(false);
 setEnrollForm({ athleteId: "", event: "", gender: "", competitionPb: "" });
 fetchData();
 } else {
 setSaveError(data.error || "Enrollment failed");
 }
 } catch {
 setSaveError("Enrollment failed");
 } finally {
 setSaving(false);
 }
 }

 // ── Removal ────────────────────────────────────────────────────

 async function handleRemove(athleteId: string) {
 setRemovingId(athleteId);
 setRemoveError("");
 try {
 await fetch(`/api/throws/podium-roster/${athleteId}`, {
 method: "PATCH",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({ status: "inactive" }),
 });
 fetchData();
 } catch {
 setRemoveError("Failed to remove athlete. Please try again.");
 } finally {
 setRemovingId(null);
 setConfirmRemoveId(null);
 }
 }

 // ── Loading skeleton ───────────────────────────────────────────

 if (loading) {
 return (
 <div className="animate-spring-up space-y-4">
 <div className="skeleton h-8 w-56" />
 <div className="skeleton h-16 rounded-2xl" />
 {[1, 2, 3].map((i) => (
 <div key={i} className="skeleton h-20 rounded-xl" />
 ))}
 </div>
 );
 }

 // ── Event breakdown (for stats strip) ─────────────────────────

 const eventCounts = podiumAthletes.reduce<Record<string, number>>((acc, p) => {
 acc[p.event] = (acc[p.event] ?? 0) + 1;
 return acc;
 }, {});

 return (
 <div className="animate-spring-up space-y-6">

 {/* ── Page Header ──────────────────────────────────────────── */}
 <div className="flex items-start justify-between gap-3 flex-wrap">
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">
 Throws Roster
 </h1>
 <p className="text-sm text-[var(--color-text-2)] mt-0.5">
 Manage Podium Throws enrollments and view deficit profiles
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Link
 href="/coach/throws"
 className="text-sm text-[var(--color-text-2)] hover:text-[var(--color-text)] font-medium"
 >
 Dashboard
 </Link>
 </div>
 </div>

 {/* ── Stats Strip ──────────────────────────────────────────── */}
 <div className="space-y-3">
 <div className="card !p-3 text-center">
 <p className="text-2xl font-bold text-[var(--color-text)]">
 {podiumAthletes.length}
 </p>
 <p className="text-xs text-[var(--color-text-2)] mt-0.5">
 Athletes Enrolled
 </p>
 </div>
 <div className="grid grid-cols-4 gap-3">
 {(["SP", "DT", "HT", "JT"] as EventCode[]).map((code) => (
 <div key={code} className="card !p-3 text-center">
 <p
 className="text-2xl font-bold"
 style={{ color: EVENT_COLORS[code] }}
 >
 {eventCounts[code] ?? 0}
 </p>
 <p className="text-xs text-[var(--color-text-2)] mt-0.5">
 {EVENT_LABELS[code]}
 </p>
 </div>
 ))}
 </div>
 </div>

 {/* ── Tabs ─────────────────────────────────────────────────── */}
 <div className="flex items-center gap-1 bg-[var(--color-bg-subtle)] rounded-xl p-1 w-fit">
 {(
 [
 { id: "podium", label: "Podium Throws" },
 { id: "all", label: "All Athletes" },
 ] as const
 ).map((tab) => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
 activeTab === tab.id
 ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
 : "text-[var(--color-text-2)] hover:text-[var(--color-text)]"
 }`}
 >
 {tab.label}
 {tab.id === "podium" && podiumAthletes.length > 0 && (
 <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[rgba(212,168,67,0.12)] text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] text-[10px] font-bold">
 {podiumAthletes.length}
 </span>
 )}
 </button>
 ))}
 </div>

 {/* ══════════════════════════════════════════════════════════ */}
 {/* PODIUM THROWS TAB */}
 {/* ══════════════════════════════════════════════════════════ */}
 {activeTab === "podium" && (
 <div className="space-y-4">

 {removeError && (
 <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">
 {removeError}
 </div>
 )}

 {/* Enroll button */}
 <div className="flex items-center justify-between">
 <p className="text-sm text-[var(--color-text-2)]">
 {podiumAthletes.length === 0
 ? "No athletes enrolled yet"
 : `${podiumAthletes.length} athlete${podiumAthletes.length !== 1 ? "s" : ""} in Podium Throws`}
 </p>
 {unenrolledAthletes.length > 0 && (
 <button
 onClick={() => {
 setEnrollOpen(true);
 setSaveError("");
 }}
 className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
 >
 <svg
 className="w-3.5 h-3.5"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M12 4v16m8-8H4"
 />
 </svg>
 Add to Podium Throws
 </button>
 )}
 </div>

 {/* ── Enrollment Form (inline panel) ───────────────────── */}
 {enrollOpen && (
 <div className="card !p-5 border-2 border-[rgba(212,168,67,0.2)] space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="font-semibold text-[var(--color-text)] text-sm">
 Enroll Athlete in Podium Throws
 </h3>
 <button
 onClick={() => setEnrollOpen(false)}
 className="p-1 text-[var(--color-text-3)] hover:text-[var(--color-text-2)] rounded-lg"
 >
 <svg
 className="w-4 h-4"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M6 18L18 6M6 6l12 12"
 />
 </svg>
 </button>
 </div>

 <form onSubmit={handleEnroll} className="space-y-3">
 {/* Athlete selector */}
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">
 Athlete
 </label>
 <select
 value={enrollForm.athleteId}
 onChange={(e) =>
 setEnrollForm((f) => ({ ...f, athleteId: e.target.value }))
 }
 required
 className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
 >
 <option value="">Select athlete…</option>
 {unenrolledAthletes.map((a) => (
 <option key={a.id} value={a.id}>
 {a.user.firstName} {a.user.lastName}
 </option>
 ))}
 </select>
 </div>

 <div className="grid grid-cols-2 gap-3">
 {/* Event */}
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">
 Event
 </label>
 <select
 value={enrollForm.event}
 onChange={(e) =>
 setEnrollForm((f) => ({
 ...f,
 event: e.target.value as EventCode,
 }))
 }
 required
 className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
 >
 <option value="">Select event…</option>
 {(["SP", "DT", "HT", "JT"] as EventCode[]).map((code) => (
 <option key={code} value={code}>
 {EVENT_LABELS[code]}
 </option>
 ))}
 </select>
 </div>

 {/* Gender */}
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">
 Gender
 </label>
 <select
 value={enrollForm.gender}
 onChange={(e) =>
 setEnrollForm((f) => ({
 ...f,
 gender: e.target.value as GenderCode,
 }))
 }
 required
 className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
 >
 <option value="">Select…</option>
 <option value="M">Male</option>
 <option value="F">Female</option>
 </select>
 </div>
 </div>

 {/* Competition PB (optional) */}
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">
 Competition PB{" "}
 <span className="text-[var(--color-text-3)] font-normal">(meters, optional)</span>
 </label>
 <input
 type="number"
 step="0.01"
 min="0"
 placeholder="e.g. 18.45"
 value={enrollForm.competitionPb}
 onChange={(e) =>
 setEnrollForm((f) => ({
 ...f,
 competitionPb: e.target.value,
 }))
 }
 className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
 />
 </div>

 {saveError && (
 <p className="text-xs text-red-600 dark:text-red-400">
 {saveError}
 </p>
 )}

 <div className="flex gap-2 pt-1">
 <button
 type="button"
 onClick={() => setEnrollOpen(false)}
 className="btn-secondary text-sm px-4 py-2"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={saving}
 className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5 disabled:opacity-60"
 >
 {saving ? (
 <>
 <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
 Enrolling…
 </>
 ) : (
 "Enroll Athlete"
 )}
 </button>
 </div>
 </form>
 </div>
 )}

 {/* ── Empty State ──────────────────────────────────────── */}
 {podiumAthletes.length === 0 && !enrollOpen && (
 <div className="card text-center py-12 space-y-3">
 <div className="w-12 h-12 rounded-2xl bg-[rgba(212,168,67,0.08)] flex items-center justify-center mx-auto">
 <svg
 className="w-6 h-6 text-[var(--color-gold)]"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={1.5}
 d="M13 10V3L4 14h7v7l9-11h-7z"
 />
 </svg>
 </div>
 <div>
 <p className="font-semibold text-[var(--color-text)] text-sm">
 No athletes in Podium Throws
 </p>
 <p className="text-xs text-[var(--color-text-3)] mt-1">
 Enroll athletes to unlock Bondarchuk deficit analysis and KPI
 profiling.
 </p>
 </div>
 {unenrolledAthletes.length > 0 && (
 <button
 onClick={() => setEnrollOpen(true)}
 className="btn-primary text-sm px-4 py-2 mx-auto"
 >
 Add First Athlete
 </button>
 )}
 {unenrolledAthletes.length === 0 && allAthletes.length === 0 && (
 <Link
 href="/coach/throws/invite"
 className="btn-primary text-sm px-4 py-2 inline-block"
 >
 Invite Athletes
 </Link>
 )}
 </div>
 )}

 {/* ── Enrolled Athletes List ────────────────────────────── */}
 {podiumAthletes.length > 0 && (
 <div className="space-y-3">
 {podiumAthletes.map((profile) => {
 const eventCode = profile.event as EventCode;
 const eventColor = EVENT_COLORS[eventCode] ?? "#d4a843";
 const eventLabel = EVENT_LABELS[eventCode] ?? profile.event;
 const deficitType = profile.deficitPrimary as DeficitType | null;
 const deficitLevel = profile.deficitStatus as DeficitLevel | null;
 const isRemoving = removingId === profile.athleteId;
 const confirmingRemove = confirmRemoveId === profile.athleteId;

 return (
 <div
 key={profile.id}
 className="card !p-4 flex items-center gap-3"
 >
 {/* Avatar */}
 <UserAvatar
 src={profile.athlete.profilePictureUrl}
 firstName={profile.athlete.user.firstName}
 lastName={profile.athlete.user.lastName}
 size="md"
 />

 {/* Main content: 2-row stacked */}
 <div className="flex-1 min-w-0 space-y-0.5">
 {/* Row 1: Name + event badge + PB */}
 <div className="flex items-center gap-2 flex-wrap">
 <p className="font-semibold text-[var(--color-text)] text-sm">
 {profile.athlete.user.firstName}{" "}
 {profile.athlete.user.lastName}
 </p>
 <span
 className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white flex-shrink-0"
 style={{ backgroundColor: eventColor }}
 >
 {eventLabel}
 <span className="opacity-80">
 {profile.gender === "M" ? "♂" : "♀"}
 </span>
 </span>
 {profile.competitionPb && (
 <span className="text-[11px] font-mono text-[var(--color-text-2)] flex-shrink-0">
 {profile.competitionPb.toFixed(2)}m
 {profile.currentDistanceBand && (
 <span className="font-sans ml-1 text-[var(--color-text-3)]">
 Band {profile.currentDistanceBand}m
 </span>
 )}
 </span>
 )}
 </div>
 {/* Row 2: Deficit badge + testing badge */}
 <div className="flex items-center gap-2 flex-wrap">
 {deficitLevel && deficitType && deficitType !== "none" ? (
 <span
 className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium flex-shrink-0 ${DEFICIT_LEVEL_COLORS[deficitLevel]} ${DEFICIT_LEVEL_BG[deficitLevel]}`}
 >
 {DEFICIT_TYPE_LABELS[deficitType]}
 </span>
 ) : (
 <span className="text-[10px] text-[var(--color-text-3)] flex-shrink-0">
 {profile.competitionPb ? "Awaiting test data" : "No PB entered"}
 </span>
 )}
 <TestingBadge records={profile.testingRecords ?? []} />
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center gap-2 flex-shrink-0">
 <Link
 href={`/coach/throws/profile?athleteId=${profile.athleteId}`}
 className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap"
 >
 View Profile
 </Link>

 {confirmingRemove ? (
 <div className="flex items-center gap-1.5">
 <span className="text-xs text-[var(--color-text-2)] whitespace-nowrap">
 Remove?
 </span>
 <button
 onClick={() => handleRemove(profile.athleteId)}
 disabled={isRemoving}
 className="text-xs px-2.5 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 whitespace-nowrap"
 >
 {isRemoving ? "…" : "Yes"}
 </button>
 <button
 onClick={() => setConfirmRemoveId(null)}
 className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)] "
 >
 No
 </button>
 </div>
 ) : (
 <button
 onClick={() => setConfirmRemoveId(profile.athleteId)}
 className="text-xs px-2.5 py-1.5 rounded-lg text-[var(--color-text-3)] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
 title="Remove from Podium Throws"
 >
 <svg
 className="w-4 h-4"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z M18 12v6m-3-3h6"
 />
 </svg>
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}

 {/* ══════════════════════════════════════════════════════════ */}
 {/* ALL ATHLETES TAB */}
 {/* ══════════════════════════════════════════════════════════ */}
 {activeTab === "all" && (
 <div className="space-y-3">
 {allAthletes.length === 0 ? (
 <div className="card text-center py-10">
 <p className="text-sm text-[var(--color-text-3)]">
 No athletes on your roster yet.
 </p>
 <Link
 href="/coach/throws/invite"
 className="btn-primary text-sm px-4 py-2 mt-3 inline-block"
 >
 Invite Athlete
 </Link>
 </div>
 ) : (
 allAthletes.map((athlete) => {
 const enrolled = enrolledAthleteIds.has(athlete.id);
 const profileRow = podiumAthletes.find(
 (p) => p.athleteId === athlete.id
 );
 return (
 <div
 key={athlete.id}
 className="card !p-4 flex items-center gap-3 flex-wrap sm:flex-nowrap"
 >
 <UserAvatar
 src={athlete.profilePictureUrl}
 firstName={athlete.user.firstName}
 lastName={athlete.user.lastName}
 size="md"
 />
 <div className="min-w-0 flex-1">
 <p className="font-semibold text-[var(--color-text)] text-sm">
 {athlete.user.firstName} {athlete.user.lastName}
 </p>
 <p className="text-xs text-[var(--color-text-3)]">
 {athlete.user.email}
 </p>
 </div>

 {/* Podium Throws status pill */}
 {enrolled && profileRow ? (
 <span
 className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white flex-shrink-0"
 style={{
 backgroundColor:
 EVENT_COLORS[profileRow.event as EventCode] ??
 "#d4a843",
 }}
 >
 <svg
 className="w-3 h-3"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2.5}
 d="M13 10V3L4 14h7v7l9-11h-7z"
 />
 </svg>
 Podium {EVENT_LABELS[profileRow.event as EventCode]}
 </span>
 ) : (
 <span className="text-[11px] text-[var(--color-text-3)] flex-shrink-0">
 Not enrolled
 </span>
 )}

 <div className="flex gap-2 flex-shrink-0 ml-auto sm:ml-0">
 <Link
 href={`/coach/throws/profile?athleteId=${athlete.id}`}
 className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap"
 >
 Throws Profile
 </Link>
 {!enrolled && (
 <button
 onClick={() => {
 setEnrollForm((f) => ({
 ...f,
 athleteId: athlete.id,
 }));
 setActiveTab("podium");
 setEnrollOpen(true);
 }}
 className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap"
 >
 Enroll
 </button>
 )}
 </div>
 </div>
 );
 })
 )}
 </div>
 )}
 </div>
 );
}
