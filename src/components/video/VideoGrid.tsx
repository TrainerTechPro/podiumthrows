"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { formatEventType } from "@/lib/utils";
import { formatTimestamp } from "@/components/video/types";
import { OfflineVideoButton } from "@/components/pwa/OfflineVideoButton";

/* ─── Types ───────────────────────────────────────────────────────────────── */

export type VideoCardData = {
  id: string;
  title: string | null;
  url: string;
  thumbnailUrl: string | null;
  event: string | null;
  category: string | null;
  status: string;
  athleteId: string | null;
  athleteName: string | null;
  durationSec: number | null;
  fileSizeMb: number | null;
  annotationCount: number;
  tags: string[];
  createdAt: string;
};

type StatusPollResult = {
  id: string;
  status: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
};

/* ─── Processing Card Skeleton ────────────────────────────────────────────── */

function ProcessingVideoCard({ video }: { video: VideoCardData }) {
  const isUploading = video.status === "uploading";
  const isFailed = video.status === "failed";

  return (
    <div className="card overflow-hidden opacity-80">
      {/* Skeleton thumbnail */}
      <div className="relative aspect-video bg-surface-100 dark:bg-surface-800 overflow-hidden">
        <div className="flex flex-col items-center justify-center h-full gap-2">
          {isFailed ? (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span className="text-xs font-medium text-red-400">
                Processing failed
              </span>
            </>
          ) : (
            <>
              {/* Animated processing spinner */}
              <div className="relative">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500 animate-pulse">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <span className="text-xs font-medium text-primary-500">
                {isUploading ? "Uploading…" : "Processing…"}
              </span>
              {/* Pulsing progress bar */}
              <div className="w-24 h-1 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                <div className="h-full bg-primary-500/60 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
          {video.title ?? "Untitled Video"}
        </h3>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {video.athleteName && (
            <span className="text-xs text-muted truncate">
              {video.athleteName}
            </span>
          )}
          {video.event && (
            <Badge variant="primary">
              {formatEventType(video.event)}
            </Badge>
          )}
          <Badge variant={isFailed ? "danger" : "neutral"}>
            {isFailed ? "Failed" : isUploading ? "Uploading" : "Processing"}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-2 text-sm text-surface-400">
          <span>
            {new Date(video.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Ready Video Card ────────────────────────────────────────────────────── */

function ReadyVideoCard({ video }: { video: VideoCardData }) {
  return (
    <Link
      href={`/coach/videos/${video.id}`}
      className="card group overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-surface-100 dark:bg-surface-800 overflow-hidden">
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl}
            alt={video.title ?? "Video thumbnail"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gradient-to-br from-surface-800 to-surface-900 text-surface-600">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
        )}

        {/* Duration badge */}
        {video.durationSec && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded">
            {formatTimestamp(video.durationSec)}
          </span>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-surface-900 ml-0.5">
              <polygon points="5 3 19 12 5 21" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)] truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {video.title ?? "Untitled Video"}
        </h3>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {video.athleteName && (
            <span className="text-xs text-muted truncate">
              {video.athleteName}
            </span>
          )}
          {video.event && (
            <Badge variant="primary">
              {formatEventType(video.event)}
            </Badge>
          )}
          {video.category && (
            <Badge variant="neutral">
              {video.category.charAt(0).toUpperCase() + video.category.slice(1)}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex items-center gap-3 text-sm text-surface-400">
            {video.annotationCount > 0 && (
              <span className="flex items-center gap-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                </svg>
                {video.annotationCount}
              </span>
            )}
            <span>
              {new Date(video.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <OfflineVideoButton
            videoId={video.id}
            videoUrl={video.url}
            title={video.title ?? "Untitled"}
            fileSizeMb={video.fileSizeMb ?? undefined}
          />
        </div>
      </div>
    </Link>
  );
}

/* ─── VideoGrid (with polling) ────────────────────────────────────────────── */

const POLL_INTERVAL_MS = 4000;

export function VideoGrid({ initialVideos }: { initialVideos: VideoCardData[] }) {
  const [videos, setVideos] = useState(initialVideos);

  // Track which videos need polling (uploading or processing)
  const processingIds = videos
    .filter((v) => v.status === "uploading" || v.status === "processing")
    .map((v) => v.id);

  const pollStatuses = useCallback(async () => {
    if (processingIds.length === 0) return;

    const results = await Promise.allSettled(
      processingIds.map((id) =>
        fetch(`/api/coach/videos/${id}/status`).then((r) =>
          r.ok ? (r.json() as Promise<StatusPollResult>) : null
        )
      )
    );

    setVideos((prev) =>
      prev.map((video) => {
        if (!processingIds.includes(video.id)) return video;

        const idx = processingIds.indexOf(video.id);
        const result = results[idx];
        if (result.status !== "fulfilled" || !result.value) return video;

        const poll = result.value;
        if (poll.status === video.status) return video; // No change

        return {
          ...video,
          status: poll.status,
          thumbnailUrl: poll.thumbnailUrl ?? video.thumbnailUrl,
          durationSec: poll.durationSec ?? video.durationSec,
        };
      })
    );
  }, [processingIds]);

  useEffect(() => {
    if (processingIds.length === 0) return;

    const interval = setInterval(pollStatuses, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [processingIds.length, pollStatuses]);

  // Sync with server-rendered data on navigation
  useEffect(() => {
    setVideos(initialVideos);
  }, [initialVideos]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((video) =>
        video.status === "ready" ? (
          <ReadyVideoCard key={video.id} video={video} />
        ) : (
          <ProcessingVideoCard key={video.id} video={video} />
        )
      )}
    </div>
  );
}
