"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/toast";
import DrillVideoUpload from "@/components/drill-video-upload";
import { EmptyState } from "@/components/ui/EmptyState";
import { Video } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";

interface DrillVideo {
 id: string;
 title: string;
 drillType: string;
 event: string;
 duration: number;
 notes: string | null;
 uploadedBy: string;
 videoUrl: string;
 createdAt: string;
 athleteId: string | null;
 athlete?: {
 id: string;
 user: { firstName: string; lastName: string };
 } | null;
}

interface Athlete {
 id: string;
 user: { firstName: string; lastName: string };
}

const DRILL_TYPE_LABELS: Record<string, string> = {
 STANDING: "Standing",
 POWER_POSITION: "Power Position",
 HALF_TURN: "Half Turn",
 SOUTH_AFRICAN: "South African",
 GLIDE: "Glide",
 SPIN: "Spin",
 FULL_THROW: "Full Throw",
 OTHER: "Other",
};

const EVENT_LABELS: Record<string, string> = {
 SHOT_PUT: "Shot Put",
 DISCUS: "Discus",
 HAMMER: "Hammer",
 JAVELIN: "Javelin",
 OTHER: "Other",
};

const EVENT_COLORS: Record<string, string> = {
 SHOT_PUT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
 DISCUS: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
 HAMMER: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
 JAVELIN: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
 OTHER: "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] ",
};

function formatDate(dateStr: string): string {
 return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function CoachDrillVideosPage() {
 const { toast } = useToast();
 const [videos, setVideos] = useState<DrillVideo[]>([]);
 const [athletes, setAthletes] = useState<Athlete[]>([]);
 const [loading, setLoading] = useState(true);
 const [showUpload, setShowUpload] = useState(false);
 const [uploadForAthleteId, setUploadForAthleteId] = useState<string>("");
 const [deletingId, setDeletingId] = useState<string | null>(null);
 const [playingId, setPlayingId] = useState<string | null>(null);
 const [filterAthleteId, setFilterAthleteId] = useState("");
 const [filterEvent, setFilterEvent] = useState("");
 const [filterDrill, setFilterDrill] = useState("");

 async function loadVideos() {
 try {
 const res = await fetch("/api/drill-videos");
 const data = await res.json();
 if (data.success) setVideos(data.data);
 } catch {
 toast("Failed to load drill videos", "error");
 } finally {
 setLoading(false);
 }
 }

 async function loadAthletes() {
 try {
 const res = await fetch("/api/athletes");
 const data = await res.json();
 if (data.success) setAthletes(data.data);
 } catch {
 // Non-critical
 }
 }

 useEffect(() => {
 loadVideos();
 loadAthletes();
 }, []);

 async function handleDelete(id: string) {
 if (!confirm("Delete this drill video? This cannot be undone.")) return;
 setDeletingId(id);
 try {
 const res = await fetch(`/api/drill-videos/${id}`, { method: "DELETE", headers: csrfHeaders() });
 const data = await res.json();
 if (data.success) {
 setVideos((vs) => vs.filter((v) => v.id !== id));
 if (playingId === id) setPlayingId(null);
 toast("Video deleted");
 } else {
 toast(data.error || "Failed to delete video", "error");
 }
 } catch {
 toast("Failed to delete video", "error");
 } finally {
 setDeletingId(null);
 }
 }

 function handleUploadForAthlete(athleteId: string) {
 setUploadForAthleteId(athleteId);
 setShowUpload(true);
 }

 const filteredVideos = videos.filter((v) => {
 if (filterAthleteId && v.athleteId !== filterAthleteId) return false;
 if (filterEvent && v.event !== filterEvent) return false;
 if (filterDrill && v.drillType !== filterDrill) return false;
 return true;
 });

 const athleteName = (video: DrillVideo) => {
 if (video.athlete?.user) {
 return `${video.athlete.user.firstName} ${video.athlete.user.lastName}`;
 }
 return "Unknown Athlete";
 };

 return (
 <div className="max-w-5xl">
 <div className="flex items-start justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold font-heading text-[var(--color-text)]">Drill PR Videos</h1>
 <p className="text-[var(--color-text-2)] mt-1 text-sm">
 Short clips of drill personal records from your athletes (max 10 seconds each)
 </p>
 </div>
 <button
 onClick={() => { setUploadForAthleteId(""); setShowUpload(true); }}
 className="btn-primary flex items-center gap-2 shrink-0"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Upload Video
 </button>
 </div>

 {/* Quick-upload per athlete */}
 {athletes.length > 0 && (
 <div className="card mb-6">
 <h2 className="text-sm font-semibold text-[var(--color-text-2)] mb-3">Upload for Athlete</h2>
 <div className="flex flex-wrap gap-2">
 {athletes.slice(0, 12).map((athlete) => (
 <button
 key={athlete.id}
 onClick={() => handleUploadForAthlete(athlete.id)}
 className="px-3 py-1.5 rounded-lg text-sm bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] hover:bg-[rgba(212,168,67,0.12)] hover:text-[var(--color-gold-dark)] dark:hover:text-[var(--color-gold)] transition-colors flex items-center gap-1.5"
 >
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 {athlete.user.firstName} {athlete.user.lastName}
 </button>
 ))}
 </div>
 </div>
 )}

 {/* Filters */}
 {videos.length > 0 && (
 <div className="flex flex-wrap gap-3 mb-6">
 {athletes.length > 0 && (
 <select
 value={filterAthleteId}
 onChange={(e) => setFilterAthleteId(e.target.value)}
 className="input text-sm py-1.5 w-auto"
 >
 <option value="">All Athletes</option>
 {athletes.map((a) => (
 <option key={a.id} value={a.id}>
 {a.user.firstName} {a.user.lastName}
 </option>
 ))}
 </select>
 )}
 <select
 value={filterEvent}
 onChange={(e) => setFilterEvent(e.target.value)}
 className="input text-sm py-1.5 w-auto"
 >
 <option value="">All Events</option>
 {Object.entries(EVENT_LABELS).map(([v, l]) => (
 <option key={v} value={v}>{l}</option>
 ))}
 </select>
 <select
 value={filterDrill}
 onChange={(e) => setFilterDrill(e.target.value)}
 className="input text-sm py-1.5 w-auto"
 >
 <option value="">All Drill Types</option>
 {Object.entries(DRILL_TYPE_LABELS).map(([v, l]) => (
 <option key={v} value={v}>{l}</option>
 ))}
 </select>
 {(filterAthleteId || filterEvent || filterDrill) && (
 <button
 onClick={() => { setFilterAthleteId(""); setFilterEvent(""); setFilterDrill(""); }}
 className="text-sm text-[var(--color-text-2)] hover:text-[var(--color-text)]"
 >
 Clear filters
 </button>
 )}
 </div>
 )}

 {loading ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {[1, 2, 3].map((i) => (
 <div key={i} className="card overflow-hidden p-0">
 <div className="skeleton aspect-video" />
 <div className="p-4 space-y-2">
 <div className="skeleton h-4 w-3/4 rounded" />
 <div className="skeleton h-3 w-1/2 rounded" />
 </div>
 </div>
 ))}
 </div>
 ) : filteredVideos.length === 0 ? (
 <div className="card">
 <EmptyState
 icon={<Video size={24} strokeWidth={1.5} aria-hidden="true" />}
 title={videos.length === 0 ? "No drill videos yet" : "No videos match your filters"}
 description={videos.length === 0
 ? "Upload short video clips of athlete drill PRs to track technique and progress over time."
 : "Try adjusting your filters."}
 action={videos.length === 0 && (
 <button onClick={() => { setUploadForAthleteId(""); setShowUpload(true); }} className="btn-primary">
 Upload First Drill Video
 </button>
 )}
 />
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {filteredVideos.map((video) => (
 <div key={video.id} className="card overflow-hidden p-0 flex flex-col">
 {/* Video player */}
 <div className="relative bg-black aspect-video">
 {playingId === video.id ? (
 <video
 src={video.videoUrl}
 className="w-full h-full object-contain"
 autoPlay
 controls
 playsInline
 onEnded={() => setPlayingId(null)}
 />
 ) : (
 <button
 className="absolute inset-0 flex items-center justify-center group w-full h-full bg-[var(--color-bg)]"
 onClick={() => setPlayingId(video.id)}
 >
 <div className="w-14 h-14 rounded-full bg-white/20 group-hover:bg-white/30 flex items-center justify-center transition-colors">
 <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
 <path d="M8 5v14l11-7z" />
 </svg>
 </div>
 <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs font-mono">
 {video.duration.toFixed(1)}s
 </span>
 <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs font-medium">
 {video.uploadedBy === "COACH" ? "Coach upload" : "Self upload"}
 </span>
 </button>
 )}
 </div>

 {/* Metadata */}
 <div className="p-4 flex flex-col flex-1">
 {video.athlete && (
 <p className="text-xs font-semibold text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] mb-1">
 {athleteName(video)}
 </p>
 )}
 <div className="flex items-start justify-between gap-2 mb-2">
 <h3 className="text-sm font-semibold text-[var(--color-text)] line-clamp-2 flex-1">
 {video.title}
 </h3>
 <button
 onClick={() => handleDelete(video.id)}
 disabled={deletingId === video.id}
 className="text-[var(--color-text-3)] hover:text-red-500 dark:hover:text-red-400 shrink-0 transition-colors p-0.5"
 title="Delete video"
 >
 {deletingId === video.id ? (
 <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
 </svg>
 ) : (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 )}
 </button>
 </div>

 <div className="flex flex-wrap gap-1.5 mb-3">
 <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_COLORS[video.event] || EVENT_COLORS.OTHER}`}>
 {EVENT_LABELS[video.event] || video.event}
 </span>
 <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-bg-subtle)] text-[var(--color-text-2)] ">
 {DRILL_TYPE_LABELS[video.drillType] || video.drillType}
 </span>
 </div>

 {video.notes && (
 <p className="text-xs text-[var(--color-text-2)] line-clamp-2 mb-2">{video.notes}</p>
 )}
 <p className="text-xs text-[var(--color-text-3)] mt-auto">{formatDate(video.createdAt)}</p>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Upload Modal */}
 {showUpload && (
 <DrillVideoUpload
 athleteId={uploadForAthleteId || undefined}
 onClose={() => { setShowUpload(false); setUploadForAthleteId(""); }}
 onUploadComplete={() => {
 setShowUpload(false);
 setUploadForAthleteId("");
 loadVideos();
 toast("Drill video uploaded successfully");
 }}
 />
 )}
 </div>
 );
}
