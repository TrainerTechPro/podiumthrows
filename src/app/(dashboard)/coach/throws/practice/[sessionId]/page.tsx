"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import { useParams, useRouter } from "next/navigation";
import { CommentThread } from "@/components/comment-thread";
import Link from "next/link";
import UserAvatar from "@/components/user-avatar";
import { CODE_EVENT_MAP, type EventCode } from "@/lib/throws/constants";
import { useOnlineStatus } from "@/lib/pwa/online-status";
import { useSyncQueue } from "@/hooks/useSyncQueue";
import { PendingSyncBadge } from "@/components/pwa/PendingSyncBadge";
import { useToast } from "@/components/ui/Toast";

// ── Types ───────────────────────────────────────────────────────────────────

interface AthleteInfo {
 id: string;
 avatarUrl?: string | null;
 user: { firstName: string; lastName: string };
 throwsProfile: {
 event: string;
 competitionPb: number | null;
 heavyImplementKg: number | null;
 lightImplementKg: number | null;
 } | null;
 throwsPRs: { event: string; implement: string; distance: number }[];
}

interface PracticeAttempt {
 id: string;
 sessionId: string;
 athleteId: string;
 event: string;
 implement: string;
 distance: number | null;
 drillType: string | null;
 coachNote: string | null;
 videoUrl: string | null;
 isPR: boolean;
 attemptNumber: number;
 createdAt: string;
 athlete: {
 id: string;
 avatarUrl?: string | null;
 user: { firstName: string; lastName: string };
 };
 /** Set when attempt is queued offline and not yet synced */
 _pendingId?: string;
}

interface PracticeSession {
 id: string;
 name: string;
 date: string;
 status: string;
 notes: string | null;
 attempts: PracticeAttempt[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
 SHOT_PUT: "Shot Put",
 DISCUS: "Discus",
 HAMMER: "Hammer",
 JAVELIN: "Javelin",
};
const EVENT_COLORS: Record<string, string> = {
 SHOT_PUT: "#D4915A",
 DISCUS: "#6A9FD8",
 HAMMER: "#5BB88A",
 JAVELIN: "#D46A6A",
};

const DRILL_TYPES = [
 { value: "STANDING", label: "Standing Throw" },
 { value: "POWER_POSITION", label: "Power Position" },
 { value: "HALF_TURN", label: "Half Turn" },
 { value: "SOUTH_AFRICAN", label: "South African" },
 { value: "GLIDE", label: "Glide" },
 { value: "SPIN", label: "Spin / Rotational" },
 { value: "FULL_THROW", label: "Full Throw" },
 { value: "OTHER", label: "Other" },
];

const EVENT_OPTIONS = ["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"];

const MAX_VIDEO_SECONDS = 10;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: string) {
 return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(dateStr: string) {
 return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
 weekday: "long",
 month: "long",
 day: "numeric",
 });
}

function getDefaultImplement(profile: AthleteInfo["throwsProfile"], event: string): string {
 if (!profile) return "";
 // comp implement weights by event
 const defaults: Record<string, { M: string; F: string }> = {
 SHOT_PUT: { M: "7.26kg", F: "4kg" },
 DISCUS: { M: "2kg", F: "1kg" },
 HAMMER: { M: "7.26kg", F: "4kg" },
 JAVELIN: { M: "800g", F: "600g" },
 };
 return defaults[event]?.M ?? "";
}

// ── Log Attempt Panel ────────────────────────────────────────────────────────

interface LogAttemptPanelProps {
 athlete: AthleteInfo;
 sessionId: string;
 athleteAttemptCount: number;
 onSave: (attempt: PracticeAttempt) => void;
 onCancel: () => void;
 isOnline: boolean;
 queueAttempt: (sessionId: string, payload: import("@/lib/pwa/sync-queue").AttemptPayload) => Promise<import("@/lib/pwa/sync-queue").QueuedAttempt>;
}

function LogAttemptPanel({ athlete, sessionId, athleteAttemptCount, onSave, onCancel, isOnline, queueAttempt: queueAttemptFn }: LogAttemptPanelProps) {
 const defaultEvent = athlete.throwsProfile?.event ?? "SHOT_PUT";
 const [event, setEvent] = useState(defaultEvent);
 const [implement, setImplement] = useState(() => getDefaultImplement(athlete.throwsProfile, defaultEvent));
 const [distance, setDistance] = useState("");
 const [drillType, setDrillType] = useState("");
 const [coachNote, setCoachNote] = useState("");
 const [videoFile, setVideoFile] = useState<File | null>(null);
 const [videoDuration, setVideoDuration] = useState<number | null>(null);
 const [videoError, setVideoError] = useState("");
 const [saving, setSaving] = useState(false);
 const [saveError, setSaveError] = useState("");
 const fileInputRef = useRef<HTMLInputElement>(null);

 // Find existing PR for current event+implement combo
 const existingPR = athlete.throwsPRs.find(
 (pr) => pr.event === event && pr.implement === implement
 );

 const distanceNum = parseFloat(distance);
 const wouldBePR = !isNaN(distanceNum) && distance !== "" &&
 (existingPR === undefined || distanceNum > existingPR.distance);

 function handleEventChange(ev: string) {
 setEvent(ev);
 setImplement(getDefaultImplement(athlete.throwsProfile, ev));
 }

 function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
 const file = e.target.files?.[0];
 if (!file) return;
 setVideoError("");
 const url = URL.createObjectURL(file);
 const vid = document.createElement("video");
 vid.preload = "metadata";
 vid.onloadedmetadata = () => {
 const dur = vid.duration;
 setVideoDuration(dur);
 URL.revokeObjectURL(url);
 if (dur > MAX_VIDEO_SECONDS + 0.05) {
 setVideoError(`Clip is ${dur.toFixed(1)}s — trim to ${MAX_VIDEO_SECONDS}s on your iPhone before uploading.`);
 setVideoFile(null);
 } else {
 setVideoFile(file);
 }
 };
 vid.onerror = () => {
 URL.revokeObjectURL(url);
 setVideoError("Could not read video file.");
 };
 vid.src = url;
 }

 async function handleSave(e: React.FormEvent) {
 e.preventDefault();
 setSaving(true);
 setSaveError("");

 const attemptPayload = {
 athleteId: athlete.id,
 event,
 implement,
 distance: distance ? parseFloat(distance) : undefined,
 drillType: drillType || undefined,
 coachNote: coachNote || undefined,
 attemptNumber: athleteAttemptCount + 1,
 };

 // ── Offline path: queue to IndexedDB ──
 if (!isOnline) {
 try {
 const queued = await queueAttemptFn(sessionId, attemptPayload);
 // Create optimistic attempt for immediate UI feedback
 const optimisticAttempt: PracticeAttempt = {
 id: queued.id,
 sessionId,
 athleteId: athlete.id,
 event,
 implement,
 distance: distance ? parseFloat(distance) : null,
 drillType: drillType || null,
 coachNote: coachNote || null,
 videoUrl: null,
 isPR: false,
 attemptNumber: athleteAttemptCount + 1,
 createdAt: new Date().toISOString(),
 athlete: {
 id: athlete.id,
 avatarUrl: athlete.avatarUrl,
 user: athlete.user,
 },
 _pendingId: queued.id,
 };
 onSave(optimisticAttempt);
 } catch {
 setSaveError("Failed to save offline");
 setSaving(false);
 }
 return;
 }

 // ── Online path: normal fetch ──
 try {
 let videoUrl: string | undefined;

 // Upload video first if selected
 if (videoFile) {
 const fd = new FormData();
 fd.append("video", videoFile);
 fd.append("sessionId", sessionId);
 fd.append("athleteId", athlete.id);
 fd.append("event", event);
 const uploadRes = await fetch("/api/throws/practice/video-upload", {
 method: "POST",
 headers: videoDuration !== null ? { "x-video-duration": String(videoDuration), ...csrfHeaders() } : { ...csrfHeaders() },
 body: fd,
 });
 const uploadData = await uploadRes.json();
 if (!uploadData.success) {
 setSaveError(uploadData.error ?? "Video upload failed");
 setSaving(false);
 return;
 }
 videoUrl = uploadData.url;
 }

 const res = await fetch(`/api/throws/practice/${sessionId}/attempts`, {
 method: "POST",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({ ...attemptPayload, videoUrl }),
 });

 const data = await res.json();
 if (data.success) {
 onSave(data.data);
 } else {
 setSaveError(data.error ?? "Failed to save attempt");
 setSaving(false);
 }
 } catch {
 // Network error while "online" — fallback to queue
 try {
 const queued = await queueAttemptFn(sessionId, attemptPayload);
 const optimisticAttempt: PracticeAttempt = {
 id: queued.id,
 sessionId,
 athleteId: athlete.id,
 event,
 implement,
 distance: distance ? parseFloat(distance) : null,
 drillType: drillType || null,
 coachNote: coachNote || null,
 videoUrl: null,
 isPR: false,
 attemptNumber: athleteAttemptCount + 1,
 createdAt: new Date().toISOString(),
 athlete: {
 id: athlete.id,
 avatarUrl: athlete.avatarUrl,
 user: athlete.user,
 },
 _pendingId: queued.id,
 };
 onSave(optimisticAttempt);
 } catch {
 setSaveError("Failed to save attempt");
 setSaving(false);
 }
 }
 }

 return (
 <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
 <div className="w-full sm:max-w-lg bg-[var(--color-surface)] rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
 {/* Header */}
 <div className="sticky top-0 bg-[var(--color-surface)] px-5 pt-5 pb-3 border-b border-[var(--color-border)] flex items-center justify-between">
 <div className="flex items-center gap-3">
 <UserAvatar
 src={athlete.avatarUrl}
 firstName={athlete.user.firstName}
 lastName={athlete.user.lastName}
 size="sm"
 />
 <div>
 <p className="font-semibold text-[var(--color-text)] text-sm">
 {athlete.user.firstName} {athlete.user.lastName}
 </p>
 <p className="text-xs text-[var(--color-text-3)]">
 Attempt #{athleteAttemptCount + 1}
 </p>
 </div>
 </div>
 <button
 onClick={onCancel}
 className="p-2 rounded-xl text-[var(--color-text-3)] hover:text-[var(--color-text-2)] hover:bg-[var(--color-bg-subtle)] transition-colors"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 <form onSubmit={handleSave} className="p-5 space-y-4">
 {/* Event */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">
 Event
 </label>
 <select
 value={event}
 onChange={(e) => handleEventChange(e.target.value)}
 className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
 >
 {EVENT_OPTIONS.map((ev) => (
 <option key={ev} value={ev}>{EVENT_LABELS[ev]}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">
 Implement
 </label>
 <input
 type="text"
 value={implement}
 onChange={(e) => setImplement(e.target.value)}
 required
 placeholder="e.g. 7.26kg"
 className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
 />
 </div>
 </div>

 {/* Distance */}
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">
 Distance <span className="font-normal text-[var(--color-text-3)]">(meters)</span>
 </label>
 <div className="relative">
 <input
 type="number"
 step="0.01"
 min="0"
 value={distance}
 onChange={(e) => setDistance(e.target.value)}
 placeholder="e.g. 18.45"
 className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 pr-10 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
 />
 {wouldBePR && (
 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-600 dark:text-amber-400">
 PR!
 </span>
 )}
 </div>
 {existingPR && (
 <p className="text-[11px] text-[var(--color-text-3)] mt-1">
 Current PR: <span className="font-mono font-semibold text-[var(--color-text-2)]">{existingPR.distance.toFixed(2)}m</span>
 {distance && !wouldBePR && (
 <span className="ml-1 text-[var(--color-text-3)]">
 (−{(existingPR.distance - parseFloat(distance)).toFixed(2)}m)
 </span>
 )}
 </p>
 )}
 </div>

 {/* Drill type */}
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">
 Drill Type <span className="font-normal text-[var(--color-text-3)]">(optional)</span>
 </label>
 <select
 value={drillType}
 onChange={(e) => setDrillType(e.target.value)}
 className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)]"
 >
 <option value="">— Select drill —</option>
 {DRILL_TYPES.map((d) => (
 <option key={d.value} value={d.value}>{d.label}</option>
 ))}
 </select>
 </div>

 {/* Coach note */}
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">
 Coaching Note <span className="font-normal text-[var(--color-text-3)]">(optional)</span>
 </label>
 <textarea
 value={coachNote}
 onChange={(e) => setCoachNote(e.target.value)}
 rows={2}
 className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,67,0.35)] resize-none"
 placeholder="Observations, technique cues, feedback…"
 />
 </div>

 {/* Video */}
 <div>
 <label className="block text-xs font-medium text-[var(--color-text-2)] mb-1">
 Video <span className="font-normal text-[var(--color-text-3)]">(optional, max 10s)</span>
 </label>
 {!isOnline ? (
 <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-xs text-[var(--color-text-3)]">
 <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <line x1="1" y1="1" x2="23" y2="23" strokeWidth={2} strokeLinecap="round" />
 <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" strokeWidth={2} strokeLinecap="round" />
 <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" strokeWidth={2} strokeLinecap="round" />
 </svg>
 Video upload requires a connection
 </div>
 ) : (
 <>
 <input
 ref={fileInputRef}
 type="file"
 accept="video/*"
 className="hidden"
 onChange={handleVideoSelect}
 />
 {videoFile ? (
 <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
 <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
 </svg>
 <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium truncate flex-1">
 {videoFile.name}
 {videoDuration !== null && (
 <span className="text-emerald-600/70 dark:text-emerald-400/70 ml-1">({videoDuration.toFixed(1)}s)</span>
 )}
 </span>
 <button
 type="button"
 onClick={() => { setVideoFile(null); setVideoDuration(null); setVideoError(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
 className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 p-0.5 rounded"
 >
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 ) : (
 <button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[var(--color-border-strong)] text-sm text-[var(--color-text-2)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold-dark)] dark:hover:text-[var(--color-gold)] transition-colors"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
 </svg>
 Attach video clip
 </button>
 )}
 {videoError && (
 <div className="mt-2 flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
 <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <p className="text-xs text-amber-700 dark:text-amber-300">{videoError}</p>
 </div>
 )}
 </>
 )}
 </div>

 {saveError && (
 <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>
 )}

 <div className="flex gap-3 pt-1 pb-safe">
 <button
 type="button"
 onClick={onCancel}
 className="flex-1 btn-secondary text-sm py-2.5"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={saving || !implement}
 className="flex-1 btn-primary text-sm py-2.5 flex items-center justify-center gap-1.5 disabled:opacity-60"
 >
 {saving ? (
 <>
 <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
 Saving…
 </>
 ) : (
 "Save Attempt"
 )}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}

// ── Attempt Card ─────────────────────────────────────────────────────────────

function AttemptCard({ attempt, onDelete, sessionClosed }: {
 attempt: PracticeAttempt;
 onDelete: (id: string) => void;
 sessionClosed: boolean;
}) {
 const [confirmDelete, setConfirmDelete] = useState(false);
 const [deleting, setDeleting] = useState(false);

 async function handleDelete() {
 setDeleting(true);
 onDelete(attempt.id);
 }

 const eventColor = EVENT_COLORS[attempt.event] ?? "#d4a843";
 const eventLabel = EVENT_LABELS[attempt.event] ?? attempt.event;

 return (
 <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-surface-2)]/50 hover:bg-[var(--color-bg-subtle)] transition-colors">
 <UserAvatar
 src={attempt.athlete.avatarUrl}
 firstName={attempt.athlete.user.firstName}
 lastName={attempt.athlete.user.lastName}
 size="sm"
 />
 <div className="flex-1 min-w-0 space-y-1">
 <div className="flex items-center gap-2 flex-wrap">
 <p className="text-xs font-semibold text-[var(--color-text)]">
 {attempt.athlete.user.firstName} {attempt.athlete.user.lastName}
 </p>
 <span
 className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white flex-shrink-0"
 style={{ backgroundColor: eventColor }}
 >
 {eventLabel}
 </span>
 <span className="text-[10px] text-[var(--color-text-3)] flex-shrink-0">
 {attempt.implement}
 </span>
 {attempt.isPR && (
 <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex-shrink-0">
 ★ PR
 </span>
 )}
 </div>
 <div className="flex items-center gap-3 flex-wrap">
 {attempt.distance !== null ? (
 <span className="text-base font-bold font-mono text-[var(--color-text)]">
 {attempt.distance.toFixed(2)}m
 </span>
 ) : (
 <span className="text-xs text-[var(--color-text-3)] italic">No distance</span>
 )}
 {attempt.drillType && (
 <span className="text-xs text-[var(--color-text-2)]">
 {DRILL_TYPES.find((d) => d.value === attempt.drillType)?.label ?? attempt.drillType}
 </span>
 )}
 {attempt.videoUrl && (
 <a
 href={attempt.videoUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 text-[11px] text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] hover:text-[var(--color-gold-dark)] font-medium"
 >
 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 Video
 </a>
 )}
 </div>
 {attempt.coachNote && (
 <p className="text-xs text-[var(--color-text-2)] italic line-clamp-2">
 {attempt.coachNote}
 </p>
 )}
 {!attempt._pendingId && (
 <CommentThread
  targetField="practiceAttemptId"
  targetId={attempt.id}
  compact
 />
 )}
 <div className="flex items-center gap-1.5">
 <p className="text-[10px] text-[var(--color-text-3)]">
 #{attempt.attemptNumber} · {attempt._pendingId ? "just now" : formatTime(attempt.createdAt)}
 </p>
 {attempt._pendingId && <PendingSyncBadge count={1} variant="inline" />}
 </div>
 </div>
 {!sessionClosed && (
 <div className="flex-shrink-0">
 {confirmDelete ? (
 <div className="flex items-center gap-1.5">
 <button
 onClick={handleDelete}
 disabled={deleting}
 className="text-[11px] px-2 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
 >
 {deleting ? "…" : "Yes"}
 </button>
 <button
 onClick={() => setConfirmDelete(false)}
 className="text-[11px] px-2 py-1 rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)]"
 >
 No
 </button>
 </div>
 ) : (
 <button
 onClick={() => setConfirmDelete(true)}
 className="p-1 text-[var(--color-border-strong)] hover:text-red-500 dark:hover:text-red-400 rounded transition-colors"
 title="Remove attempt"
 >
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 )}
 </div>
 )}
 </div>
 );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function LiveSessionPage() {
 const params = useParams<{ sessionId: string }>();
 const _router = useRouter();
 const [session, setSession] = useState<PracticeSession | null>(null);
 const [rosterAthletes, setRosterAthletes] = useState<AthleteInfo[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedAthlete, setSelectedAthlete] = useState<AthleteInfo | null>(null);
 const [closing, setClosing] = useState(false);
 const [confirmClose, setConfirmClose] = useState(false);
 const { isOnline } = useOnlineStatus();
 const { success: toastSuccess } = useToast();
 const { pendingCount, isSyncing, queueAttempt } = useSyncQueue(
 (results) => {
 const synced = results.filter((r) => r.success).length;
 if (synced > 0) {
 toastSuccess("Synced", `${synced} attempt${synced > 1 ? "s" : ""} synced`);
 // Replace optimistic attempts with server data
 setSession((prev) => {
 if (!prev) return prev;
 const updated = prev.attempts.map((a) => {
 if (!a._pendingId) return a;
 const result = results.find((r) => r.queueId === a._pendingId && r.success);
 if (result?.serverData) {
 return { ...(result.serverData as PracticeAttempt), _pendingId: undefined };
 }
 return a;
 });
 return { ...prev, attempts: updated };
 });
 }
 }
 );

 const _fetchSession = useCallback(() => {
 fetch(`/api/throws/practice/${params.sessionId}`)
 .then((r) => r.json())
 .then((data) => {
 if (data.success) setSession(data.data);
 setLoading(false);
 })
 .catch(() => setLoading(false));
 }, [params.sessionId]);

 useEffect(() => {
 // Fetch session + roster in parallel
 setLoading(true);
 Promise.all([
 fetch(`/api/throws/practice/${params.sessionId}`).then((r) => r.json()),
 fetch("/api/throws/podium-roster").then((r) => r.json()),
 ]).then(([sessionData, rosterData]) => {
 if (sessionData.success) setSession(sessionData.data);
 if (rosterData.success) {
 // Build AthleteInfo from roster data
 const athletes: AthleteInfo[] = (rosterData.data as {
 athleteId: string;
 event: string;
 competitionPb: number | null;
 heavyImplementKg: number | null;
 lightImplementKg: number | null;
 athlete: {
 id: string;
 avatarUrl?: string | null;
 user: { firstName: string; lastName: string };
 };
 }[]).map((p) => ({
 id: p.athleteId,
 avatarUrl: p.athlete.avatarUrl,
 user: p.athlete.user,
 throwsProfile: {
 event: CODE_EVENT_MAP[p.event as EventCode] ?? p.event,
 competitionPb: p.competitionPb,
 heavyImplementKg: p.heavyImplementKg,
 lightImplementKg: p.lightImplementKg,
 },
 throwsPRs: [], // PRs are embedded in attempt data
 }));
 setRosterAthletes(athletes);
 }
 setLoading(false);
 }).catch(() => setLoading(false));
 }, [params.sessionId]);

 async function handleCloseSession() {
 setClosing(true);
 try {
 await fetch(`/api/throws/practice/${params.sessionId}`, {
 method: "PATCH",
 headers: { "Content-Type": "application/json", ...csrfHeaders() },
 body: JSON.stringify({ status: "CLOSED" }),
 });
 setSession((s) => s ? { ...s, status: "CLOSED" } : s);
 setConfirmClose(false);
 } finally {
 setClosing(false);
 }
 }

 function handleAttemptSaved(attempt: PracticeAttempt) {
 setSession((prev) =>
 prev ? { ...prev, attempts: [...prev.attempts, attempt] } : prev
 );
 setSelectedAthlete(null);
 }

 function handleAttemptDeleted(attemptId: string) {
 // Optimistic removal
 setSession((prev) =>
 prev
 ? { ...prev, attempts: prev.attempts.filter((a) => a.id !== attemptId) }
 : prev
 );
 // Confirm on server
 fetch(`/api/throws/practice/${params.sessionId}/attempts/${attemptId}`, { method: "DELETE", headers: csrfHeaders() });
 }

 if (loading) {
 return (
 <div className="animate-spring-up space-y-4">
 <div className="skeleton h-8 w-56" />
 <div className="skeleton h-16 rounded-xl" />
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
 </div>
 </div>
 );
 }

 if (!session) {
 return (
 <div className="card text-center py-16">
 <p className="text-[var(--color-text-2)]">Session not found.</p>
 <Link href="/coach/throws/practice" className="btn-secondary text-sm mt-4 inline-block">
 Back to Practice
 </Link>
 </div>
 );
 }

 const isClosed = session.status === "CLOSED";

 // Count attempts per athlete
 const attemptCountByAthlete = session.attempts.reduce<Record<string, number>>((acc, a) => {
 acc[a.athleteId] = (acc[a.athleteId] ?? 0) + 1;
 return acc;
 }, {});

 // PRs per athlete from attempt records (inline data)
 const prsByAthlete: Record<string, { event: string; implement: string; distance: number }[]> = {};
 for (const attempt of session.attempts) {
 if (!prsByAthlete[attempt.athleteId]) prsByAthlete[attempt.athleteId] = [];
 // Use attempt's athlete.throwsPRs if embedded (from the GET endpoint)
 const attemptAthlete = attempt.athlete as unknown as { throwsPRs?: { event: string; implement: string; distance: number }[] };
 if (attemptAthlete.throwsPRs) {
 prsByAthlete[attempt.athleteId] = attemptAthlete.throwsPRs;
 }
 }

 // Enrich roster athletes with PRs from session data
 const enrichedAthletes = rosterAthletes.map((a) => ({
 ...a,
 throwsPRs: prsByAthlete[a.id] ?? a.throwsPRs,
 }));

 return (
 <div className="animate-spring-up space-y-5">
 {/* Log Attempt Panel overlay */}
 {selectedAthlete && (
 <LogAttemptPanel
 athlete={enrichedAthletes.find((a) => a.id === selectedAthlete.id) ?? selectedAthlete}
 sessionId={session.id}
 athleteAttemptCount={attemptCountByAthlete[selectedAthlete.id] ?? 0}
 onSave={handleAttemptSaved}
 onCancel={() => setSelectedAthlete(null)}
 isOnline={isOnline}
 queueAttempt={queueAttempt}
 />
 )}

 {/* Header */}
 <div className="flex items-start justify-between gap-3 flex-wrap">
 <div>
 <div className="flex items-center gap-2 flex-wrap">
 <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text)]">
 {session.name}
 </h1>
 {isClosed ? (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-bg-subtle)] text-[var(--color-text-2)]">
 Closed
 </span>
 ) : (
 <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
 Live
 </span>
 )}
 {pendingCount > 0 && (
 <PendingSyncBadge count={pendingCount} isSyncing={isSyncing} variant="header" />
 )}
 </div>
 <p className="text-sm text-[var(--color-text-2)] mt-0.5">
 {formatDate(session.date)} · {session.attempts.length} attempts
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Link href="/coach/throws/practice" className="btn-secondary text-sm px-3 py-1.5">
 ← Sessions
 </Link>
 {!isClosed && (
 confirmClose ? (
 <div className="flex items-center gap-2">
 <span className="text-xs text-[var(--color-text-2)]">Close session?</span>
 <button
 onClick={handleCloseSession}
 disabled={closing}
 className="text-xs px-3 py-1.5 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 font-medium"
 >
 {closing ? "…" : "Yes, close"}
 </button>
 <button
 onClick={() => setConfirmClose(false)}
 className="text-xs px-3 py-1.5 rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] font-medium"
 >
 Cancel
 </button>
 </div>
 ) : (
 <button
 onClick={() => setConfirmClose(true)}
 className="btn-secondary text-sm px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
 >
 Close Session
 </button>
 )
 )}
 </div>
 </div>

 {/* Session notes */}
 {session.notes && (
 <div className="px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
 <p className="text-xs text-amber-700 dark:text-amber-300">{session.notes}</p>
 </div>
 )}

 <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
 {/* ── Athletes Queue ── */}
 <div className="lg:col-span-2 space-y-3">
 <h2 className="text-sm font-semibold text-[var(--color-text-2)]">
 Athletes Queue
 </h2>
 {rosterAthletes.length === 0 ? (
 <div className="card text-center py-8">
 <p className="text-xs text-[var(--color-text-3)]">
 No Podium athletes enrolled.{" "}
 <Link href="/coach/throws/roster" className="text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] hover:underline">
 Enroll athletes
 </Link>
 </p>
 </div>
 ) : (
 rosterAthletes.map((athlete) => {
 const count = attemptCountByAthlete[athlete.id] ?? 0;
 const eventColor = EVENT_COLORS[athlete.throwsProfile?.event ?? ""] ?? "#d4a843";
 const eventLabel = EVENT_LABELS[athlete.throwsProfile?.event ?? ""] ?? athlete.throwsProfile?.event ?? "—";
 const isSelected = selectedAthlete?.id === athlete.id;

 return (
 <button
 key={athlete.id}
 onClick={() => {
 if (!isClosed) setSelectedAthlete(athlete);
 }}
 disabled={isClosed}
 className={`w-full card !p-3 flex items-center gap-3 text-left transition-all ${
 isClosed
 ? "opacity-60 cursor-not-allowed"
 : "hover:shadow-md hover:border-[rgba(212,168,67,0.2)] active:scale-[0.98] cursor-pointer"
 } ${isSelected ? "border-[rgba(212,168,67,0.3)] dark:border-[var(--color-gold)] shadow-md" : ""}`}
 >
 <UserAvatar
 src={athlete.avatarUrl}
 firstName={athlete.user.firstName}
 lastName={athlete.user.lastName}
 size="sm"
 />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-[var(--color-text)] truncate">
 {athlete.user.firstName} {athlete.user.lastName}
 </p>
 <div className="flex items-center gap-1.5 mt-0.5">
 <span
 className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
 style={{ backgroundColor: eventColor }}
 >
 {eventLabel}
 </span>
 </div>
 </div>
 <div className="flex-shrink-0 text-right">
 <p className="text-lg font-bold text-[var(--color-text)]">{count}</p>
 <p className="text-[10px] text-[var(--color-text-3)]">
 {count === 1 ? "attempt" : "attempts"}
 </p>
 </div>
 {!isClosed && (
 <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[rgba(212,168,67,0.12)] flex items-center justify-center">
 <svg className="w-4 h-4 text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 </div>
 )}
 </button>
 );
 })
 )}
 </div>

 {/* ── Attempt Feed ── */}
 <div className="lg:col-span-3 space-y-3">
 <h2 className="text-sm font-semibold text-[var(--color-text-2)]">
 Attempt Feed
 {session.attempts.length > 0 && (
 <span className="ml-1.5 text-[var(--color-text-3)] font-normal">
 ({session.attempts.length})
 </span>
 )}
 </h2>
 {session.attempts.length === 0 ? (
 <div className="card text-center py-12 space-y-2">
 <svg className="w-8 h-8 text-[var(--color-border-strong)] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
 </svg>
 <p className="text-xs text-[var(--color-text-3)]">
 {isClosed ? "No attempts were logged." : "Tap an athlete to log their first attempt."}
 </p>
 </div>
 ) : (
 // Show newest first
 [...session.attempts].reverse().map((attempt) => (
 <AttemptCard
 key={attempt.id}
 attempt={attempt}
 onDelete={handleAttemptDeleted}
 sessionClosed={isClosed}
 />
 ))
 )}
 </div>
 </div>
 </div>
 );
}
