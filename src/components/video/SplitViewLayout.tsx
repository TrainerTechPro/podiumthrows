"use client";

import type { ReactNode, RefObject } from "react";
import { useVideoWorkspace, type VideoSource } from "./useVideoWorkspace";
import { ZoomableVideoContainer } from "./ZoomableVideoContainer";
import { CanvasFrameRenderer } from "./CanvasFrameRenderer";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  videoA: VideoSource;
  videoB?: VideoSource;
  /** Overlay content rendered inside each video panel (e.g. annotation canvas) */
  children?: ReactNode;
  /** Overlay content rendered inside the Video B panel (split mode only) */
  childrenB?: ReactNode;
};

/* ─── Component ───────────────────────────────────────────────────────────── */

/**
 * Renders the video layout based on the current mode (single / split / ghost).
 * Mounts the actual `<video>` elements and attaches them to the refs from context.
 * Accepts overlay children for annotation canvases.
 */
export function SplitViewLayout({ videoA, videoB, children, childrenB }: Props) {
  const {
    mode,
    ghostOpacity,
    videoARef,
    videoBRef,
    zoomPanA,
    zoomPanB,
    linked,
    activePanel,
    setActivePanel,
    togglePlay,
    handleLoadedMetadata,
    handleLoadedMetadataB,
    handleVideoBTimeUpdate,
    handleVideoAPlay,
    handleVideoAPause,
    framePerfectMode,
    framePerfectActive,
    frameExtractor,
    currentFrameIndex,
    toggleFramePerfect,
  } = useVideoWorkspace();

  if (mode === "single") {
    /* ── SINGLE MODE ── */
    return (
      <ZoomableVideoContainer zoomPan={zoomPanA} className="aspect-video bg-black rounded-xl overflow-hidden">
        <div className="relative w-full h-full">
          {/* Video element — hidden during frame-perfect mode */}
          <video
            ref={videoARef as RefObject<HTMLVideoElement>}
            src={videoA.src}
            poster={videoA.poster}
            className="w-full h-full object-contain"
            style={framePerfectActive ? { display: "none" } : undefined}
            playsInline
            preload="metadata"
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handleVideoAPlay}
            onPause={handleVideoAPause}
            onClick={togglePlay}
          />

          {/* Frame-perfect canvas renderer */}
          {framePerfectActive && (
            <CanvasFrameRenderer
              frames={frameExtractor.frames}
              currentFrame={currentFrameIndex}
              className="w-full h-full object-contain"
            />
          )}

          {/* Extraction progress overlay */}
          {framePerfectMode && frameExtractor.isExtracting && (
            <ExtractionProgressOverlay
              progress={frameExtractor.progress}
              onCancel={() => {
                frameExtractor.cancel();
                toggleFramePerfect();
              }}
            />
          )}

          {/* Extraction error overlay */}
          {framePerfectMode && frameExtractor.error && (
            <ExtractionErrorOverlay
              error={frameExtractor.error}
              onDismiss={toggleFramePerfect}
            />
          )}

          {/* Overlay content (annotation canvas) */}
          {children}
        </div>
      </ZoomableVideoContainer>
    );
  }

  if (mode === "split") {
    /* ── SPLIT MODE ── */
    return (
      <div className="grid grid-cols-2 gap-2">
        {/* Video A — leader */}
        <div className="space-y-1">
          <div
            className={`flex items-center gap-1.5 px-1 ${!linked ? "cursor-pointer select-none" : ""}`}
            onClick={() => !linked && setActivePanel("A")}
            title={!linked ? "Click to scrub Video A with JogWheel" : undefined}
          >
            <span
              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0 transition-colors ${
                !linked
                  ? activePanel === "A"
                    ? "bg-primary-500 ring-1 ring-primary-300"
                    : "bg-primary-500/50"
                  : "bg-primary-500"
              }`}
            >
              A
            </span>
            <span className="text-xs font-medium text-[var(--foreground)] truncate">
              {videoA.title ?? "Primary"}
            </span>
            {!linked && activePanel === "A" && (
              <span className="text-[9px] text-primary-400 font-medium ml-auto">Active</span>
            )}
          </div>
          <ZoomableVideoContainer zoomPan={zoomPanA} className="aspect-video bg-black rounded-xl overflow-hidden">
            <div className="relative w-full h-full">
              <video
                ref={videoARef as RefObject<HTMLVideoElement>}
                src={videoA.src}
                poster={videoA.poster}
                className="w-full h-full object-contain"
                playsInline
                preload="metadata"
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={handleVideoAPlay}
                onPause={handleVideoAPause}
                onClick={togglePlay}
              />
              {children}
            </div>
          </ZoomableVideoContainer>
        </div>

        {/* Video B — follower / independent when unlinked */}
        <div className="space-y-1">
          <div
            className={`flex items-center gap-1.5 px-1 ${!linked ? "cursor-pointer select-none" : ""}`}
            onClick={() => !linked && setActivePanel("B")}
            title={!linked ? "Click to scrub Video B with JogWheel" : undefined}
          >
            <span
              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0 transition-colors ${
                !linked
                  ? activePanel === "B"
                    ? "bg-primary-500 ring-1 ring-primary-300"
                    : "bg-surface-600/60"
                  : "bg-surface-600"
              }`}
            >
              B
            </span>
            <span
              className={`text-xs font-medium truncate transition-colors ${
                !linked && activePanel === "B"
                  ? "text-[var(--foreground)]"
                  : "text-surface-500"
              }`}
            >
              {videoB?.title ?? "Comparison"}
            </span>
            {!linked && activePanel === "B" && (
              <span className="text-[9px] text-primary-400 font-medium ml-auto">Active</span>
            )}
          </div>
          <ZoomableVideoContainer zoomPan={zoomPanB} className="aspect-video bg-black rounded-xl overflow-hidden">
            <div className="relative w-full h-full">
              {videoB ? (
                <video
                  ref={videoBRef as RefObject<HTMLVideoElement>}
                  src={videoB.src}
                  poster={videoB.poster}
                  className="w-full h-full object-contain"
                  playsInline
                  preload="metadata"
                  muted
                  onLoadedMetadata={handleLoadedMetadataB}
                  onTimeUpdate={handleVideoBTimeUpdate}
                  onClick={togglePlay}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-surface-500 text-sm">
                  No comparison video selected
                </div>
              )}
              {childrenB}
            </div>
          </ZoomableVideoContainer>
        </div>
      </div>
    );
  }

  /* ── GHOST MODE ── */
  return (
    <ZoomableVideoContainer zoomPan={zoomPanA} className="aspect-video bg-black rounded-xl overflow-hidden">
      <div className="relative w-full h-full">
        {/* Primary video */}
        <video
          ref={videoARef as RefObject<HTMLVideoElement>}
          src={videoA.src}
          poster={videoA.poster}
          className="w-full h-full object-contain"
          playsInline
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handleVideoAPlay}
          onPause={handleVideoAPause}
          onClick={togglePlay}
        />

        {/* Ghost overlay */}
        {videoB && (
          <video
            ref={videoBRef as RefObject<HTMLVideoElement>}
            src={videoB.src}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            style={{ opacity: ghostOpacity / 100 }}
            playsInline
            preload="metadata"
            muted
            onLoadedMetadata={handleLoadedMetadataB}
            onTimeUpdate={handleVideoBTimeUpdate}
          />
        )}

        {/* Overlay content (annotation canvas) */}
        {children}

        {/* Ghost labels */}
        {videoB && (
          <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-none z-10">
            <span className="text-[10px] bg-primary-500/80 text-white px-2 py-0.5 rounded font-medium">
              A — {videoA.title ?? "Primary"}
            </span>
            <span
              className="text-[10px] bg-surface-600/80 text-white px-2 py-0.5 rounded font-medium"
              style={{ opacity: ghostOpacity / 100 + 0.4 }}
            >
              B — {videoB.title ?? "Ghost"}
            </span>
          </div>
        )}
      </div>
    </ZoomableVideoContainer>
  );
}

/* ─── Internal Sub-Components ────────────────────────────────────────────── */

function ExtractionProgressOverlay({
  progress,
  onCancel,
}: {
  progress: number;
  onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 z-10">
      <div className="text-xs font-medium text-primary-400 uppercase tracking-wider">
        Extracting Frames…
      </div>
      <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-[10px] text-surface-400 font-mono">
        {progress}%
      </span>
      <button
        onClick={onCancel}
        className="mt-1 text-[10px] text-surface-500 hover:text-white transition-colors underline"
      >
        Cancel
      </button>
    </div>
  );
}

function ExtractionErrorOverlay({
  error,
  onDismiss,
}: {
  error: string;
  onDismiss: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 z-10">
      <span className="text-xs text-red-400">
        Frame extraction failed: {error}
      </span>
      <button
        onClick={onDismiss}
        className="text-[10px] text-surface-400 hover:text-white transition-colors underline"
      >
        Dismiss
      </button>
    </div>
  );
}
