"use client";

import { useVideoWorkspace } from "./useVideoWorkspace";
import { AnnotationCanvas } from "./AnnotationCanvas";
import type { Annotation, AnnotationTool } from "./types";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  /** Persisted annotation data — passed as props, NOT from context */
  annotations: Annotation[];
  /** Whether annotation editing mode is active */
  isEditing: boolean;
  /** Active annotation drawing tool */
  activeTool: AnnotationTool;
  /** Active stroke color */
  activeColor: string;
  /** Active stroke width */
  activeStrokeWidth: number;
  /** Callback when a new annotation is drawn */
  onAnnotationAdd: (ann: Annotation) => void;
};

/* ─── Component ───────────────────────────────────────────────────────────── */

/**
 * Renders the annotation canvas overlay for a video panel.
 * Reads `currentTime` from the workspace context for time-based annotation visibility.
 * All annotation data flows through props (persisted state, not transient UI state).
 *
 * Usage: Pass as `children` to `<SplitViewLayout>` to overlay annotations on the video.
 */
export function VideoCanvas({
  annotations,
  isEditing,
  activeTool,
  activeColor,
  activeStrokeWidth,
  onAnnotationAdd,
}: Props) {
  const { currentTime } = useVideoWorkspace();

  return (
    <div
      className="absolute inset-0"
      style={{ pointerEvents: isEditing ? "auto" : "none" }}
    >
      <AnnotationCanvas
        annotations={annotations}
        currentTime={currentTime}
        isEditing={isEditing}
        activeTool={activeTool}
        activeColor={activeColor}
        activeStrokeWidth={activeStrokeWidth}
        onAnnotationAdd={onAnnotationAdd}
      />
    </div>
  );
}
