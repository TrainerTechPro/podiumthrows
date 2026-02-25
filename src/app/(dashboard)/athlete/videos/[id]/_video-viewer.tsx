"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import type { AthleteVideoDetail } from "@/lib/data/athlete";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/video/VideoPlayer";
import { AnnotationCanvas } from "@/components/video/AnnotationCanvas";
import { AnnotationTimeline } from "@/components/video/AnnotationTimeline";
import { AnnotationList } from "@/components/video/AnnotationList";
import { Badge } from "@/components/ui/Badge";
import type { Annotation } from "@/components/video/types";
import { formatEventType } from "@/lib/utils";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  video: AthleteVideoDetail;
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function AthleteVideoViewer({ video }: Props) {
  const playerRef = useRef<VideoPlayerHandle>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSec ?? 0);

  const annotations: Annotation[] = Array.isArray(video.annotations)
    ? (video.annotations as Annotation[])
    : [];

  function seekTo(time: number) {
    playerRef.current?.seekTo(time);
  }

  return (
    <div className="space-y-4">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/athlete/videos"
          className="p-1.5 rounded-lg text-surface-400 hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-[var(--foreground)] truncate">
            {video.title ?? "Untitled Video"}
          </h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {video.coachName && (
              <span className="text-xs text-muted">
                From {video.coachName}
              </span>
            )}
            {video.event && (
              <Badge variant="primary">{formatEventType(video.event)}</Badge>
            )}
            {video.category && (
              <Badge variant="neutral">
                {video.category.charAt(0).toUpperCase() + video.category.slice(1)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Main layout ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Left: Video + Timeline */}
        <div className="space-y-3">
          <VideoPlayer
            ref={playerRef}
            src={video.url}
            poster={video.thumbnailUrl ?? undefined}
            onTimeUpdate={setCurrentTime}
            onReady={setDuration}
            overlay={
              <AnnotationCanvas
                annotations={annotations}
                currentTime={currentTime}
                isEditing={false}
              />
            }
            className="aspect-video"
          />

          {/* Timeline */}
          {annotations.length > 0 && (
            <AnnotationTimeline
              annotations={annotations}
              duration={duration}
              currentTime={currentTime}
              onSeek={seekTo}
            />
          )}
        </div>

        {/* Right: Annotations + Info */}
        <div className="space-y-4">
          {annotations.length > 0 && (
            <div className="card p-3">
              <AnnotationList
                annotations={annotations}
                currentTime={currentTime}
                isEditing={false}
                onSeek={seekTo}
              />
            </div>
          )}

          {/* Video info */}
          <div className="card p-3 space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
              Video Info
            </h3>
            <div className="space-y-1.5 text-xs">
              {video.description && (
                <p className="text-surface-600 dark:text-surface-400">
                  {video.description}
                </p>
              )}
              <div className="flex justify-between">
                <span className="text-muted">Uploaded</span>
                <span className="text-[var(--foreground)]">
                  {new Date(video.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Annotations</span>
                <span className="text-[var(--foreground)]">
                  {annotations.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
