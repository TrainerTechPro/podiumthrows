"use client";

import { useState, useEffect, useRef } from "react";
import { Video, Search } from "lucide-react";
import { useToast } from "@/components/toast";
import DrillVideoUpload from "@/components/drill-video-upload";
import { csrfHeaders } from "@/lib/csrf-client";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { EmptyState } from "@/components/ui/EmptyState";
import { logger } from "@/lib/logger";
import {
  WatchNextOverlay,
  type WatchNextRecommendation,
} from "@/components/video/WatchNextOverlay";

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
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [filterEvent, setFilterEvent] = useState("");
  const [filterDrill, setFilterDrill] = useState("");
  const _videoRef = useRef<HTMLVideoElement>(null);

  // Watch-next: when a clip ends, fetch 3 recommendations and overlay them
  // on top of the same player. `endedVideoId` doubles as "show overlay over
  // this card" — clearing it dismisses the overlay.
  const [endedVideoId, setEndedVideoId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<WatchNextRecommendation[]>([]);
  const [recFocusKeywords, setRecFocusKeywords] = useState<string[]>([]);

  async function recordView(input: {
    drillVideoId: string;
    source: "manual" | "recommendation" | "autoplay";
    recommendedFromId?: string | null;
  }) {
    try {
      await fetch("/api/drill-videos/views", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(input),
      });
    } catch (err) {
      // View tracking is best-effort — log but don't break playback.
      logger.warn("drill view record failed", {
        context: "athlete/drill-videos",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
  }

  async function handleVideoEnded(justWatchedId: string) {
    setEndedVideoId(justWatchedId);
    try {
      const res = await fetch("/api/drill-videos/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ justWatchedId }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        // No recommendations? Just hide the overlay and reset the card.
        setEndedVideoId(null);
        setPlayingId(null);
        return;
      }
      const recs: WatchNextRecommendation[] = payload.data.recommendations ?? [];
      if (recs.length === 0) {
        setEndedVideoId(null);
        setPlayingId(null);
        return;
      }
      setRecommendations(recs);
      setRecFocusKeywords(payload.data.focusKeywords ?? []);
    } catch {
      setEndedVideoId(null);
      setPlayingId(null);
    }
  }

  function handleWatchNextSelect(
    rec: WatchNextRecommendation,
    source: "recommendation" | "autoplay"
  ) {
    const justWatchedId = endedVideoId;
    // Record the click-through immediately for analytics. Don't await — the
    // user shouldn't wait on a tracking fetch to start their next video.
    recordView({
      drillVideoId: rec.id,
      source,
      recommendedFromId: justWatchedId,
    });
    setEndedVideoId(null);
    setRecommendations([]);
    setPlayingId(rec.id);
  }

  function handleWatchNextDismiss() {
    setEndedVideoId(null);
    setRecommendations([]);
    setPlayingId(null);
  }

  async function loadVideos(cursor?: string) {
    const isInitial = !cursor;
    if (!isInitial) setLoadingMore(true);
    try {
      const url = cursor
        ? `/api/drill-videos?cursor=${encodeURIComponent(cursor)}`
        : "/api/drill-videos";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        // Response is `{ success, data: { videos, nextCursor } }`. Append on
        // load-more; replace on initial load.
        setVideos((prev) => (isInitial ? data.data.videos : [...prev, ...data.data.videos]));
        setNextCursor(data.data.nextCursor ?? null);
      }
    } catch {
      toast("Failed to load drill videos", "error");
    } finally {
      if (isInitial) setLoading(false);
      else setLoadingMore(false);
    }
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    loadVideos();
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/drill-videos/${id}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
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
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Drill PR Videos
          </h1>
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
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={filterDrill}
            onChange={(e) => setFilterDrill(e.target.value)}
            className="input text-sm py-1.5 w-auto"
          >
            <option value="">All Drill Types</option>
            {Object.entries(DRILL_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {(filterEvent || filterDrill) && (
            <button
              onClick={() => {
                setFilterEvent("");
                setFilterDrill("");
              }}
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
        videos.length === 0 ? (
          <EmptyState
            icon={<Video size={48} strokeWidth={1.75} aria-hidden="true" />}
            title="No drill videos yet"
            description="Upload a short clip of your standing throw — even 10 seconds. Future you will thank you when you watch it back."
            action={
              <button type="button" onClick={() => setShowUpload(true)} className="btn-primary">
                Upload your first drill
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={<Search size={48} strokeWidth={1.75} aria-hidden="true" />}
            title="No videos match your filters"
            description="Try a different event or drill — or clear the filters to see everything."
            action={
              <button
                type="button"
                onClick={() => {
                  setFilterEvent("");
                  setFilterDrill("");
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[var(--foreground)] bg-[var(--card-bg)] border border-[var(--card-border)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                Clear filters
              </button>
            }
          />
        )
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
                    onPlay={() => {
                      // Best-effort manual-source view ping. Source defaults
                      // to "manual"; recommendation source is logged from
                      // the overlay's select handler, so we don't double-log.
                      recordView({ drillVideoId: video.id, source: "manual" });
                    }}
                    onEnded={() => handleVideoEnded(video.id)}
                  />
                ) : (
                  <button
                    className="absolute inset-0 flex items-center justify-center group w-full h-full bg-[var(--color-bg)]"
                    onClick={() => setPlayingId(video.id)}
                  >
                    <div className="w-14 h-14 rounded-full bg-white/20 group-hover:bg-white/30 flex items-center justify-center transition-colors">
                      <svg
                        className="w-7 h-7 text-white ml-1"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs font-mono">
                      {video.duration.toFixed(1)}s
                    </span>
                  </button>
                )}

                {/* Watch-next overlay — only over the card whose clip just
                    ended. The player stays mounted underneath but is fully
                    covered, so the next click in the overlay drives state. */}
                <WatchNextOverlay
                  open={endedVideoId === video.id && recommendations.length > 0}
                  recommendations={recommendations}
                  focusKeywords={recFocusKeywords}
                  onSelect={handleWatchNextSelect}
                  onDismiss={handleWatchNextDismiss}
                />
              </div>

              {/* Metadata */}
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-[var(--foreground)] line-clamp-2 flex-1">
                    {video.title}
                  </h3>
                  <button
                    onClick={() =>
                      confirmDeleteId === video.id
                        ? handleDelete(video.id)
                        : setConfirmDeleteId(video.id)
                    }
                    onBlur={() => setTimeout(() => setConfirmDeleteId(null), 200)}
                    disabled={deletingId === video.id}
                    className={`shrink-0 transition-colors p-2 rounded-lg ${
                      confirmDeleteId === video.id
                        ? "text-red-500 bg-red-500/10"
                        : "text-muted hover:text-red-500 dark:hover:text-red-400"
                    }`}
                    title={confirmDeleteId === video.id ? "Tap again to confirm" : "Delete video"}
                  >
                    {deletingId === video.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_COLORS[video.event] || EVENT_COLORS.OTHER}`}
                  >
                    {EVENT_LABELS[video.event] || video.event}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 ">
                    {DRILL_TYPE_LABELS[video.drillType] || video.drillType}
                  </span>
                </div>

                {video.notes && (
                  <p className="text-xs text-surface-700 dark:text-surface-300 line-clamp-2 mb-2">
                    {video.notes}
                  </p>
                )}

                <p className="text-xs text-muted mt-auto">{formatDate(video.createdAt)}</p>
              </div>
            </div>
          ))}
        </StaggeredList>
      )}

      {/* Load more — only shown when the API reports another page, and when no
          event/drill filter is active (filters run over already-loaded rows, so
          "Load more" under a filter could imply those filters will re-apply to
          new rows, which is true but reads confusingly). */}
      {nextCursor && !filterEvent && !filterDrill && (
        <div className="flex justify-center mt-6">
          <button
            type="button"
            onClick={() => loadVideos(nextCursor)}
            disabled={loadingMore}
            className="btn-secondary px-6 py-2 disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
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
