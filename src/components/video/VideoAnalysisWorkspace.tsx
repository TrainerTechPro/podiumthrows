"use client";

import { useEffect, type MutableRefObject } from "react";
import type { Annotation, AnnotationTool } from "./types";
import { VideoWorkspaceProvider } from "./VideoWorkspaceProvider";
import { type VideoSource, useVideoWorkspace } from "./useVideoWorkspace";
import { SplitViewLayout } from "./SplitViewLayout";
import { VideoCanvas } from "./VideoCanvas";
import { PlaybackControls } from "./PlaybackControls";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  videoA: VideoSource;
  videoB?: VideoSource;
  mode: "single" | "split" | "ghost";
  annotations: Annotation[];
  isEditing: boolean;
  activeTool: AnnotationTool;
  activeColor: string;
  activeStrokeWidth: number;
  onAnnotationAdd: (ann: Annotation) => void;
  onTimeUpdate?: (time: number) => void;
  onDurationReady?: (duration: number) => void;
  ghostOpacity?: number;
  onGhostOpacityChange?: (v: number) => void;
  className?: string;
  /**
   * Mutable ref that will be populated with the workspace's `seekTo` function.
   * Use this instead of the old imperative ref handle.
   *
   * @example
   * const seekRef = useRef<((t: number) => void) | null>(null);
   * <VideoAnalysisWorkspace seekRef={seekRef} ... />
   * // later: seekRef.current?.(time);
   */
  seekRef?: MutableRefObject<((time: number) => void) | null>;
};

/**
 * @deprecated Use `VideoWorkspaceProvider` + `useVideoWorkspace()` directly for new code.
 * This type is kept for backwards compatibility with existing consumers.
 */
export type VideoAnalysisWorkspaceHandle = {
  seekTo: (time: number) => void;
};

/* ─── SeekRef Bridge ──────────────────────────────────────────────────────── */

/**
 * Tiny internal component that lives inside the provider and writes the
 * context's `seekTo` into the parent's mutable ref. This bridges the gap
 * between the context-based API and consumers that need imperative access
 * from outside the provider tree.
 */
function SeekRefBridge({
  seekRef,
}: {
  seekRef: MutableRefObject<((time: number) => void) | null>;
}) {
  const { seekTo } = useVideoWorkspace();

  useEffect(() => {
    seekRef.current = seekTo;
    return () => {
      seekRef.current = null;
    };
  }, [seekTo, seekRef]);

  return null;
}

/* ─── Composed Shell ──────────────────────────────────────────────────────── */

/**
 * Backwards-compatible composed shell for the video analysis workspace.
 *
 * Wraps `<VideoWorkspaceProvider>` and renders:
 * - `<SplitViewLayout>` (video layout with `<video>` elements)
 * - `<VideoCanvas>` (annotation overlay per panel)
 * - `<PlaybackControls>` (transport bar, jog wheel, sync toggles)
 *
 * For new code, prefer using the provider and sub-components directly.
 */
export function VideoAnalysisWorkspace({
  videoA,
  videoB,
  mode,
  annotations,
  isEditing,
  activeTool,
  activeColor,
  activeStrokeWidth,
  onAnnotationAdd,
  onTimeUpdate,
  onDurationReady,
  ghostOpacity,
  onGhostOpacityChange,
  className,
  seekRef,
}: Props) {
  /* Annotation canvas for Video A (primary) */
  const canvasA = (
    <VideoCanvas
      annotations={annotations}
      isEditing={isEditing}
      activeTool={activeTool}
      activeColor={activeColor}
      activeStrokeWidth={activeStrokeWidth}
      onAnnotationAdd={onAnnotationAdd}
    />
  );

  return (
    <VideoWorkspaceProvider
      videoA={videoA}
      videoB={videoB}
      mode={mode}
      onTimeUpdate={onTimeUpdate}
      onDurationReady={onDurationReady}
      ghostOpacity={ghostOpacity}
      onGhostOpacityChange={onGhostOpacityChange}
      isDrawingActive={isEditing && activeTool !== "select"}
    >
      {/* Bridge: expose seekTo to parent via mutable ref */}
      {seekRef && <SeekRefBridge seekRef={seekRef} />}

      <div className={`space-y-3 ${className ?? ""}`}>
        <SplitViewLayout videoA={videoA} videoB={videoB}>
          {canvasA}
        </SplitViewLayout>
        <PlaybackControls />
      </div>
    </VideoWorkspaceProvider>
  );
}
