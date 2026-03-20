"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/toast";
import DrillVideoUpload from "@/components/drill-video-upload";
import { csrfHeaders } from "@/lib/csrf-client";
import { StaggeredList } from "@/components/ui/StaggeredList";

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
}

const DRILL_TYPE_LABELS: Record<string, string> = {
 STANDING: "Standing Throw",
 POWER_POSITION: "Power Position",
 HALF_TURN: "Half Turn",
 SOUTH_AFRICAN: "South African",
 GLIDE: "Glide",
 SPIN: "Spin / Rotational",
 FULL_THROW: "Full Throw",
 OTHER: "Other",
};

const EVENT_LABELS: Record<string, string> = {
 SHOT_PUT: "Shot Put",
 DISCUS: "Discus",
 HAMMER: "Hammer Throw",
 JAVELIN: "Javelin",
 OTHER: "Other",
};

const EVENT_COLORS: Record<string, string> = {
 SHOT_PUT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
 DISCUS: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
 HAMMER: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
 JAVELIN: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
 OTHER: "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 ",
};

function formatDate(dateStr: string): string {
 return new Date(dateStr).toLocaleDateString(undefined, {
 year: "numeric",
 month: "short",
 day: "numeric",
 });
}

export default function AthleteDrillVideosPage() {
 const { toast } = useToast();
 const [videos, setVideos] = useState<DrillVideo[]>([]);
 const [loading, setLoading] = useState(true);
 const [showUpload, setShowUpload] = useState(false);
 const [deletingId, setDeletingId] = useState<string | null>(null);
 const [playingId, setPlayingId] = useState<string | null>(null);
 const [filterEvent, setFilterEvent] = useState("");
 const [filterDrill, setFilterDrill] = useState("");
 const _videoRef = useRef<HTMLVideoElement>(null);

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

 useEffect(() => { loadVideos(); }, []);

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

 const filteredVideos = videos.filter((v) => {
 if (filterEvent && v.event !== filterEvent) return false;
 if (filterDrill && v.drillType !== filterDrill) return false;
 return true;
 });

 return (
 <div className="max-w-4xl">
 <div className="flex items-start justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Drill PR Videos</h1>
 <p className="text-surface-700 dark:text-surface-300 mt-1 text-sm">
 Short clips of your best drill performances (max 10 seconds each)
 </p>
 </div>
 <button
 onClick={() => setShowUpload(true)}
 className="btn-primary flex items-center gap-2 shrink-0"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
 </svg>
 Upload Video
 </button>
 </div>

 {/* Filters */}
 {videos.length > 0 && (
 <div className="flex flex-wrap gap-3 mb-6">
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
 {(filterEvent || filterDrill) && (
 <button
 onClick={() => { setFilterEvent(""); setFilterDrill(""); }}
 className="text-sm text-surface-700 dark:text-surface-300 hover:text-[var(--foreground)]"
 >
 Clear filters
 </button>
 )}
 </div>
 )}

 {loading ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {[1, 2, 3].map((i) => (
 <div key={i} className="card space-y-3">
 <div className="skeleton aspect-video rounded-lg" />
 <div className="skeleton h-4 w-3/4 rounded" />
 <div className="skeleton h-3 w-1/2 rounded" />
 </div>
 ))}
 </div>
 ) : filteredVideos.length === 0 ? (
 <div className="card text-center py-16">
 <div className="w-16 h-16 rounded-2xl bg-[rgba(212,168,67,0.12)] flex items-center justify-center mx-auto mb-4">
 <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.88v6.24a1 1 0 01-1.447.888L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
 </svg>
 </div>
 <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
 {videos.length === 0 ? "No drill videos yet" : "No videos match your filters"}
 </h3>
 <p className="text-surface-700 dark:text-surface-300 text-sm mb-6 max-w-sm mx-auto">
 {videos.length === 0
 ? "Upload short video clips of your drill PRs to track your technique and progress over time."
 : "Try adjusting your filters to see more videos."}
 </p>
 {videos.length === 0 && (
 <button onClick={() => setShowUpload(true)} className="btn-primary mx-auto">
 Upload Your First Drill Video
 </button>
 )}
 </div>
 ) : (
 <StaggeredList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
 </button>
 )}
 </div>

 {/* Metadata */}
 <div className="p-4 flex flex-col flex-1">
 <div className="flex items-start justify-between gap-2 mb-2">
 <h3 className="text-sm font-semibold text-[var(--foreground)] line-clamp-2 flex-1">
 {video.title}
 </h3>
 <button
 onClick={() => handleDelete(video.id)}
 disabled={deletingId === video.id}
 className="text-muted hover:text-red-500 dark:hover:text-red-400 shrink-0 transition-colors p-0.5"
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
 <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 ">
 {DRILL_TYPE_LABELS[video.drillType] || video.drillType}
 </span>
 </div>

 {video.notes && (
 <p className="text-xs text-surface-700 dark:text-surface-300 line-clamp-2 mb-2">{video.notes}</p>
 )}

 <p className="text-xs text-muted mt-auto">{formatDate(video.createdAt)}</p>
 </div>
 </div>
 ))}
 </StaggeredList>
 )}

 {/* Upload Modal */}
 {showUpload && (
 <DrillVideoUpload
 onClose={() => setShowUpload(false)}
 onUploadComplete={() => {
 setShowUpload(false);
 loadVideos();
 toast("Drill video uploaded successfully");
 }}
 />
 )}
 </div>
 );
}
