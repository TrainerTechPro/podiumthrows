"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import UserAvatar from "@/components/user-avatar";
import {
 EVENTS,
 PHASE_CONFIGS,
 PHASE_RATIOS,
 PHASE_IMPLEMENT_DIST,
 WEEKLY_SCHEDULES,
 TAPER_PROTOCOL,
 CLASSIFICATIONS,
 parseEvents,
 type ThrowEvent,
 type TrainingPhase,
 type EventCode,
 CODE_EVENT_MAP,
} from "@/lib/throws/constants";

interface ThrowsSessionSummary {
 id: string;
 name: string;
 event: string;
 sessionType: string;
 targetPhase: string | null;
 createdAt: string;
 blocks: { id: string; blockType: string; config: string }[];
 assignments: {
 id: string;
 assignedDate: string;
 status: string;
 athlete: { user: { firstName: string; lastName: string } };
 }[];
}

interface RosterAthleteRow {
 id: string;
 athleteId: string;
 event: string;
 gender: string;
 deficitPrimary: string | null;
 deficitStatus: string | null;
 overPowered: boolean;
 competitionPb: number | null;
 athlete: {
 id: string;
 profilePictureUrl?: string | null;
 user: { firstName: string; lastName: string };
 throwsPRs?: { event: string; implement: string; distance: number }[];
 };
 testingRecords: { testDate: string; testType: string }[];
}

const EVENT_COLORS_MAP: Record<string, string> = {
 SP: "#D4915A",
 DT: "#6A9FD8",
 HT: "#5BB88A",
 JT: "#D46A6A",
};
const EVENT_LABELS_MAP: Record<string, string> = {
 SP: "Shot Put",
 DT: "Discus",
 HT: "Hammer",
 JT: "Javelin",
};

function rosterTestStatus(records: { testDate: string }[]): "never" | "overdue" | "due-soon" | "ok" {
 if (records.length === 0) return "never";
 const days = Math.floor((Date.now() - new Date(records[0].testDate).getTime()) / 86_400_000);
 if (days > 14) return "overdue";
 if (days > 7) return "due-soon";
 return "ok";
}

const PHASE_COLORS: Record<TrainingPhase, string> = {
 ACCUMULATION: "#6A9FD8",
 TRANSMUTATION: "#5BB88A",
 REALIZATION: "#D4915A",
 COMPETITION: "#D46A6A",
};

export default function ThrowsDashboard() {
 const [sessions, setSessions] = useState<ThrowsSessionSummary[]>([]);
 const [roster, setRoster] = useState<RosterAthleteRow[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedPhase, setSelectedPhase] = useState<TrainingPhase>("ACCUMULATION");

 useEffect(() => {
 Promise.all([
 fetch("/api/throws/sessions").then((r) => r.json()),
 fetch("/api/throws/podium-roster").then((r) => r.json()),
 ])
 .then(([sessionsData, rosterData]) => {
 if (sessionsData.success) setSessions(sessionsData.data);
 if (rosterData.success) setRoster(rosterData.data);
 setLoading(false);
 })
 .catch(() => setLoading(false));
 }, []); // eslint-disable-line react-hooks/exhaustive-deps

 const recentSessions = sessions.slice(0, 6);
 const totalAssignments = sessions.reduce((s, ses) => s + ses.assignments.length, 0);
 const completedAssignments = sessions.reduce(
 (s, ses) => s + ses.assignments.filter((a) => a.status === "COMPLETED").length,
 0
 );
 const eventCounts = sessions.reduce<Record<string, number>>((acc, s) => {
 for (const ev of parseEvents(s.event)) {
 acc[ev] = (acc[ev] || 0) + 1;
 }
 return acc;
 }, {});

 const phaseConfig = PHASE_CONFIGS.find((p) => p.phase === selectedPhase)!;
 const phaseRatios = PHASE_RATIOS[selectedPhase];
 const phaseDist = PHASE_IMPLEMENT_DIST.find((p) => p.phase === selectedPhase)!;
 const weeklySchedule = WEEKLY_SCHEDULES[selectedPhase];

 if (loading) {
 return (
 <div className="animate-spring-up space-y-6">
 <div className="skeleton h-8 w-56" />
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 {[1, 2, 3, 4].map((i) => (
 <div key={i} className="skeleton h-24 rounded-xl" />
 ))}
 </div>
 </div>
 );
 }

 return (
 <div className="animate-spring-up space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div>
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">
 Podium Throws
 </h1>
 <p className="text-sm text-[var(--color-text-2)]">
 Bondarchuk Transfer of Training — Volume IV Programming
 </p>
 </div>
 <div className="flex gap-2 self-start sm:self-auto">
 <Link href="/coach/throws/invite" className="btn-secondary whitespace-nowrap flex items-center gap-1.5">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
 </svg>
 Invite
 </Link>
 <Link href="/coach/throws/roster" className="btn-secondary whitespace-nowrap">
 Roster
 </Link>
 <Link href="/coach/throws/builder" className="btn-primary whitespace-nowrap">
 Build Session
 </Link>
 </div>
 </div>

 {/* Quick Actions Row */}
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 <Link
 href="/coach/throws/practice"
 className="card !p-4 flex items-center gap-3 hover:shadow-md transition-shadow group col-span-2 sm:col-span-1"
 >
 <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
 <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 </div>
 <div>
 <p className="text-sm font-semibold text-[var(--color-text)]">Live Practice</p>
 <p className="text-xs text-[var(--color-text-2)]">Log attempts in real time</p>
 </div>
 </Link>
 <Link
 href="/coach/throws/invite"
 className="card !p-4 flex items-center gap-3 hover:shadow-md transition-shadow group"
 >
 <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
 <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
 </svg>
 </div>
 <div>
 <p className="text-sm font-semibold text-[var(--color-text)]">Invite Athlete</p>
 <p className="text-xs text-[var(--color-text-2)]">Generate a shareable link</p>
 </div>
 </Link>
 <Link
 href="/coach/athlete-preview"
 className="card !p-4 flex items-center gap-3 hover:shadow-md transition-shadow group"
 >
 <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
 <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
 </svg>
 </div>
 <div>
 <p className="text-sm font-semibold text-[var(--color-text)]">View as Athlete</p>
 <p className="text-xs text-[var(--color-text-2)]">Preview the athlete experience</p>
 </div>
 </Link>
 </div>

 {/* ── Roster Pulse ─────────────────────────────────────────── */}
 {roster.length > 0 && (() => {
 const needsAttention = roster.filter((p) => {
 const s = rosterTestStatus(p.testingRecords ?? []);
 return s === "never" || s === "overdue";
 });
 const sortedRoster = [...roster].sort((a, b) => {
 const order = { never: 0, overdue: 1, "due-soon": 2, ok: 3 };
 return order[rosterTestStatus(a.testingRecords ?? [])] - order[rosterTestStatus(b.testingRecords ?? [])];
 });
 return (
 <div className="card space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <h2 className="text-sm font-semibold text-[var(--color-text)]">Roster Pulse</h2>
 <span className="text-xs text-[var(--color-text-3)]">{roster.length} enrolled</span>
 </div>
 <div className="flex items-center gap-2">
 {needsAttention.length > 0 && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 {needsAttention.length} need testing
 </span>
 )}
 <Link href="/coach/throws/roster" className="text-xs text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] hover:text-[var(--color-gold-dark)] font-medium">
 Full Roster →
 </Link>
 </div>
 </div>
 <div className="space-y-2">
 {sortedRoster.map((p) => {
 const status = rosterTestStatus(p.testingRecords ?? []);
 const eventColor = EVENT_COLORS_MAP[p.event] ?? "#d4a843";
 const eventLabel = EVENT_LABELS_MAP[p.event] ?? p.event;
 const days = p.testingRecords?.length
 ? Math.floor((Date.now() - new Date(p.testingRecords[0].testDate).getTime()) / 86_400_000)
 : null;
 const eventLong = CODE_EVENT_MAP[p.event as EventCode] ?? p.event;
 const prForEvent = p.athlete.throwsPRs?.find((pr) => pr.event === eventLong);
 const prGap =
 p.competitionPb != null && prForEvent != null
 ? p.competitionPb - prForEvent.distance
 : null;

 const statusBadge = {
 never: (
 <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
 Never tested
 </span>
 ),
 overdue: (
 <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
 {days}d — test due
 </span>
 ),
 "due-soon": (
 <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
 {days}d ago
 </span>
 ),
 ok: (
 <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
 {days === 0 ? "Today" : `${days}d ago`}
 </span>
 ),
 }[status];

 return (
 <Link
 key={p.id}
 href={`/coach/throws/profile?athleteId=${p.athleteId}`}
 className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--color-surface-2)]/50 transition-colors group"
 >
 <UserAvatar
 src={p.athlete.profilePictureUrl}
 firstName={p.athlete.user.firstName}
 lastName={p.athlete.user.lastName}
 size="sm"
 />
 <div className="flex-1 min-w-0">
 <p className="text-xs font-semibold text-[var(--color-text)] truncate">
 {p.athlete.user.firstName} {p.athlete.user.lastName}
 </p>
 <div className="flex items-center gap-1.5 mt-0.5">
 <span
 className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
 style={{ backgroundColor: eventColor }}
 >
 {eventLabel} {p.gender === "M" ? "♂" : "♀"}
 </span>
 {p.overPowered && (
 <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
 OverPowered
 </span>
 )}
 {p.deficitPrimary && p.deficitPrimary !== "none" && (
 <span className="text-[10px] text-[var(--color-text-3)] truncate">
 {p.deficitPrimary}
 </span>
 )}
 </div>
 </div>
 <div className="flex items-center gap-2 flex-shrink-0">
 {prGap != null && (
 <span
 className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
 prGap > 2
 ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
 : prGap > 0.5
 ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
 : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
 }`}
 title={`${prForEvent?.distance.toFixed(2)}m training PR vs ${p.competitionPb?.toFixed(2)}m comp PB`}
 >
 {prGap > 0 ? `−${prGap.toFixed(2)}m` : `+${Math.abs(prGap).toFixed(2)}m`}
 </span>
 )}
 {statusBadge}
 <svg className="w-3.5 h-3.5 text-[var(--color-text-3)] group-hover:text-[var(--color-gold)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </div>
 </Link>
 );
 })}
 </div>
 </div>
 );
 })()}

 {/* Stats cards */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 <div className="card !p-4">
 <p className="text-xs font-medium text-[var(--color-text-2)] uppercase tracking-wider">Sessions</p>
 <p className="text-2xl font-bold text-[var(--color-text)] mt-1">{sessions.length}</p>
 <p className="text-xs text-[var(--color-text-3)] mt-0.5">in library</p>
 </div>
 <div className="card !p-4">
 <p className="text-xs font-medium text-[var(--color-text-2)] uppercase tracking-wider">Assigned</p>
 <p className="text-2xl font-bold text-[var(--color-text)] mt-1">{totalAssignments}</p>
 <p className="text-xs text-[var(--color-text-3)] mt-0.5">total assignments</p>
 </div>
 <div className="card !p-4">
 <p className="text-xs font-medium text-[var(--color-text-2)] uppercase tracking-wider">Completed</p>
 <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{completedAssignments}</p>
 <p className="text-xs text-[var(--color-text-3)] mt-0.5">
 {totalAssignments > 0 ? `${Math.round((completedAssignments / totalAssignments) * 100)}% rate` : "no data yet"}
 </p>
 </div>
 <div className="card !p-4">
 <p className="text-xs font-medium text-[var(--color-text-2)] uppercase tracking-wider">Events</p>
 <div className="flex flex-wrap gap-1 mt-2">
 {Object.entries(eventCounts).map(([ev, count]) => (
 <span
 key={ev}
 className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
 style={{ backgroundColor: EVENTS[ev as ThrowEvent]?.color || "#666" }}
 >
 {EVENTS[ev as ThrowEvent]?.label || ev} ({count})
 </span>
 ))}
 {Object.keys(eventCounts).length === 0 && (
 <span className="text-sm text-[var(--color-text-3)]">No sessions yet</span>
 )}
 </div>
 </div>
 </div>

 {/* Phase Programming Section */}
 <div className="card space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-lg font-semibold text-[var(--color-text)]">Phase Programming</h2>
 <div className="flex gap-1">
 {(["ACCUMULATION", "TRANSMUTATION", "REALIZATION", "COMPETITION"] as TrainingPhase[]).map((phase) => (
 <button
 key={phase}
 onClick={() => setSelectedPhase(phase)}
 className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
 selectedPhase === phase
 ? "text-white"
 : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)] "
 }`}
 style={selectedPhase === phase ? { backgroundColor: PHASE_COLORS[phase] } : undefined}
 >
 {phase.slice(0, 3)}
 </button>
 ))}
 </div>
 </div>

 {/* Phase details grid */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {/* Exercise Classification Ratios */}
 <div className="rounded-lg bg-[var(--color-surface-2)]/50 p-3 space-y-2">
 <p className="text-xs font-semibold text-[var(--color-text-2)] uppercase tracking-wider">Classification Ratios</p>
 <div className="space-y-1.5">
 {(["CE", "SD", "SP", "GP"] as const).map((cls) => (
 <div key={cls} className="flex items-center gap-2">
 <span className="text-xs font-medium text-[var(--color-text-2)] w-6">{cls}</span>
 <div className="flex-1 h-3 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
 <div
 className="h-full rounded-full transition-all"
 style={{
 width: `${phaseRatios[cls]}%`,
 backgroundColor: PHASE_COLORS[selectedPhase],
 }}
 />
 </div>
 <span className="text-xs font-bold text-[var(--color-text)] w-8 text-right">{phaseRatios[cls]}%</span>
 </div>
 ))}
 </div>
 <p className="text-[10px] text-[var(--color-text-3)] mt-1">
 {CLASSIFICATIONS.CE.label} | {CLASSIFICATIONS.SD.label}
 </p>
 </div>

 {/* Volume & Scheduling */}
 <div className="rounded-lg bg-[var(--color-surface-2)]/50 p-3 space-y-2">
 <p className="text-xs font-semibold text-[var(--color-text-2)] uppercase tracking-wider">Weekly Parameters</p>
 <div className="grid grid-cols-2 gap-2">
 <div>
 <p className="text-[10px] text-[var(--color-text-3)]">Throws/Wk</p>
 <p className="text-sm font-bold text-[var(--color-text)]">
 {phaseConfig.throwsPerWeekMin}–{phaseConfig.throwsPerWeekMax}
 </p>
 </div>
 <div>
 <p className="text-[10px] text-[var(--color-text-3)]">Strength Days</p>
 <p className="text-sm font-bold text-[var(--color-text)]">
 {phaseConfig.strengthDaysMin}–{phaseConfig.strengthDaysMax}
 </p>
 </div>
 <div>
 <p className="text-[10px] text-[var(--color-text-3)]">Duration</p>
 <p className="text-sm font-bold text-[var(--color-text)]">
 {phaseConfig.durationWeeksMin}–{phaseConfig.durationWeeksMax} wk
 </p>
 </div>
 </div>
 </div>

 {/* Implement Distribution */}
 <div className="rounded-lg bg-[var(--color-surface-2)]/50 p-3 space-y-2">
 <p className="text-xs font-semibold text-[var(--color-text-2)] uppercase tracking-wider">Implement Distribution</p>
 <div className="flex h-6 rounded-full overflow-hidden">
 <div
 className="flex items-center justify-center text-[10px] font-bold text-white"
 style={{ width: `${phaseDist.heavyPercent}%`, backgroundColor: "#D46A6A" }}
 title={`Heavy: ${phaseDist.heavyPercent}%`}
 >
 {phaseDist.heavyPercent}%
 </div>
 <div
 className="flex items-center justify-center text-[10px] font-bold text-white"
 style={{ width: `${phaseDist.compPercent}%`, backgroundColor: "#5BB88A" }}
 title={`Comp: ${phaseDist.compPercent}%`}
 >
 {phaseDist.compPercent}%
 </div>
 <div
 className="flex items-center justify-center text-[10px] font-bold text-white"
 style={{ width: `${phaseDist.lightPercent}%`, backgroundColor: "#6A9FD8" }}
 title={`Light: ${phaseDist.lightPercent}%`}
 >
 {phaseDist.lightPercent}%
 </div>
 </div>
 <div className="flex justify-between text-[10px] text-[var(--color-text-2)]">
 <span>Heavy</span>
 <span>Competition</span>
 <span>Light</span>
 </div>
 </div>
 </div>

 {/* Weekly Schedule */}
 <div>
 <p className="text-xs font-semibold text-[var(--color-text-2)] uppercase tracking-wider mb-2">
 Weekly Template — {selectedPhase.charAt(0) + selectedPhase.slice(1).toLowerCase()}
 </p>
 <div className="overflow-x-auto">
 <div className="flex gap-2 min-w-max">
 {weeklySchedule.map((day) => (
 <div
 key={day.day}
 className="flex-shrink-0 w-28 rounded-lg border border-[var(--color-border)] p-2 space-y-1"
 style={{ borderTopColor: PHASE_COLORS[selectedPhase], borderTopWidth: "3px" }}
 >
 <p className="text-xs font-bold text-[var(--color-text)]">{day.day}</p>
 <p className="text-[10px] font-semibold" style={{ color: PHASE_COLORS[selectedPhase] }}>
 Type {day.type}
 </p>
 <p className="text-[10px] text-[var(--color-text-2)]">{day.focus}</p>
 <p className="text-[10px] text-[var(--color-text-3)]">
 {day.throwsMin}–{day.throwsMax} throws
 </p>
 <p className="text-[10px] text-[var(--color-text-3)]">
 Str: {day.strength}
 </p>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>

 {/* Taper Protocol */}
 <div className="card space-y-3">
 <h2 className="text-lg font-semibold text-[var(--color-text)]">Taper Protocol</h2>
 <div className="flex items-end gap-3 h-20">
 {TAPER_PROTOCOL.map((entry) => (
 <div key={entry.daysOut} className="flex-1 flex flex-col items-center gap-1">
 <div
 className="w-full rounded-t-md transition-all"
 style={{
 height: `${entry.volumeMultiplier * 100}%`,
 backgroundColor: "#D46A6A",
 opacity: 0.3 + entry.volumeMultiplier * 0.7,
 }}
 />
 <span className="text-[10px] font-bold text-[var(--color-text)]">
 {Math.round(entry.volumeMultiplier * 100)}%
 </span>
 <span className="text-[10px] text-[var(--color-text-3)]">
 {entry.daysOut}d out
 </span>
 </div>
 ))}
 </div>
 </div>

 {/* Recent sessions */}
 <div>
 <div className="flex items-center justify-between mb-3">
 <h2 className="text-lg font-semibold text-[var(--color-text)]">Recent Sessions</h2>
 {sessions.length > 6 && (
 <Link href="/coach/throws/library" className="text-sm text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] hover:text-[var(--color-gold-dark)] font-medium">
 View All
 </Link>
 )}
 </div>

 {sessions.length === 0 ? (
 <div className="card text-center py-12">
 <h3 className="text-lg font-semibold text-[var(--color-text)] mb-1">
 No sessions yet
 </h3>
 <p className="text-sm text-[var(--color-text-2)] mb-4">
 Build your first Bondarchuk-validated throws session to get started.
 </p>
 <Link href="/coach/throws/builder" className="btn-primary">
 Build Your First Session
 </Link>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {recentSessions.map((session) => {
 const sessionEvents = parseEvents(session.event);
 const throwBlocks = session.blocks.filter((b) => b.blockType === "THROWING");
 const totalThrows = throwBlocks.reduce((sum, b) => {
 try { return sum + (JSON.parse(b.config)?.throwCount || 0); } catch { return sum; }
 }, 0);

 return (
 <div key={session.id} className="card !p-4 space-y-3 hover:shadow-md transition-shadow">
 <div className="flex items-start justify-between">
 <div>
 <h3 className="font-semibold text-[var(--color-text)] text-sm">{session.name}</h3>
 <div className="flex items-center gap-2 mt-1 flex-wrap">
 {sessionEvents.map((ev) => {
 const meta = EVENTS[ev];
 return (
 <span
 key={ev}
 className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
 style={{ backgroundColor: meta?.color || "#666" }}
 >
 {meta?.label || ev}
 </span>
 );
 })}
 <span className="text-xs text-[var(--color-text-3)]">
 {session.sessionType.replace(/_/g, " ")}
 </span>
 {session.targetPhase && (
 <span
 className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
 style={{
 color: PHASE_COLORS[session.targetPhase as TrainingPhase] || "#666",
 backgroundColor: `${PHASE_COLORS[session.targetPhase as TrainingPhase] || "#666"}15`,
 }}
 >
 {session.targetPhase.slice(0, 3)}
 </span>
 )}
 </div>
 </div>
 </div>
 <div className="flex items-center gap-4 text-xs text-[var(--color-text-2)]">
 <span>{session.blocks.length} blocks</span>
 {totalThrows > 0 && <span>{totalThrows} throws</span>}
 <span>{session.assignments.length} assigned</span>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 );
}
