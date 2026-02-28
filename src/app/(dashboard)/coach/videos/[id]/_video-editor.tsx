"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { VideoDetail } from "@/lib/data/coach";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/video/VideoPlayer";
import { AnnotationCanvas } from "@/components/video/AnnotationCanvas";
import { AnnotationToolbar } from "@/components/video/AnnotationToolbar";
import { AnnotationTimeline } from "@/components/video/AnnotationTimeline";
import { AnnotationList } from "@/components/video/AnnotationList";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { Annotation, AnnotationTool } from "@/components/video/types";
import { formatEventType } from "@/lib/utils";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  video: VideoDetail;
  athletes: { id: string; name: string }[];
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function VideoEditor({ video, athletes }: Props) {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();
  const playerRef = useRef<VideoPlayerHandle>(null);

  // Video state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSec ?? 0);

  // Annotation state
  const [annotations, setAnnotations] = useState<Annotation[]>(() => {
    const raw = video.annotations;
    return Array.isArray(raw) ? (raw as Annotation[]) : [];
  });
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("select");
  const [activeColor, setActiveColor] = useState("#ef4444");
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(4);
  const [isSaving, setIsSaving] = useState(false);

  // Share modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<Set<string>>(
    () => new Set(video.sharedWithAthletes)
  );
  const [isSharing, setIsSharing] = useState(false);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  /* ── Annotation management ───────────────────────────────────────────── */

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev, annotations]);
    setRedoStack([]);
  }, [annotations]);

  const addAnnotation = useCallback(
    (ann: Annotation) => {
      pushUndo();
      setAnnotations((prev) => [...prev, ann]);
    },
    [pushUndo]
  );

  const deleteAnnotation = useCallback(
    (id: string) => {
      pushUndo();
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    },
    [pushUndo]
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, annotations]);
    setAnnotations(prev);
    setUndoStack((u) => u.slice(0, -1));
  }, [undoStack, annotations]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, annotations]);
    setAnnotations(next);
    setRedoStack((r) => r.slice(0, -1));
  }, [redoStack, annotations]);

  const clearAll = useCallback(() => {
    pushUndo();
    setAnnotations([]);
  }, [pushUndo]);

  /* ── Save annotations ────────────────────────────────────────────────── */

  async function saveAnnotations() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/coach/videos/${video.id}/annotations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setUndoStack([]);
      setRedoStack([]);
      toastSuccess("Annotations saved");
    } catch (err) {
      console.error("Save failed:", err);
      toastError("Save failed", "Could not save annotations. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  /* ── Share ────────────────────────────────────────────────────────────── */

  async function handleShare() {
    setIsSharing(true);
    try {
      const res = await fetch(`/api/coach/videos/${video.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteIds: Array.from(selectedAthleteIds) }),
      });
      if (!res.ok) throw new Error("Failed to share");
      setShowShareModal(false);
      toastSuccess("Video shared", `Shared with ${selectedAthleteIds.size} athlete${selectedAthleteIds.size !== 1 ? "s" : ""}.`);
    } catch (err) {
      console.error("Share failed:", err);
      toastError("Share failed", "Could not update sharing settings. Please try again.");
    } finally {
      setIsSharing(false);
    }
  }

  /* ── Delete ──────────────────────────────────────────────────────────── */

  async function handleDelete() {
    try {
      const res = await fetch(`/api/coach/videos/${video.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/coach/videos");
    } catch (err) {
      console.error("Delete failed:", err);
      toastError("Delete failed", "Could not delete the video. Please try again.");
    }
  }

  /* ── Seek helper ─────────────────────────────────────────────────────── */

  function seekTo(time: number) {
    playerRef.current?.seekTo(time);
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/coach/videos"
          aria-label="Back to Video Library"
          className="p-1.5 rounded-lg text-surface-400 hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-[var(--foreground)] truncate">
            {video.title ?? "Untitled Video"}
          </h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {video.athleteName && (
              <span className="text-xs text-muted">{video.athleteName}</span>
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

        {/* Mode toggle */}
        <button
          onClick={() => {
            setIsEditing(!isEditing);
            setActiveTool("select");
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isEditing
              ? "bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300"
              : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
          }`}
        >
          {isEditing ? "Editing" : "View Mode"}
        </button>

        {/* Share */}
        <button
          onClick={() => setShowShareModal(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
        >
          Share
        </button>

        {/* Delete */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          title="Delete video"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      {/* ── Main layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Left: Video + Toolbar + Timeline */}
        <div className="space-y-3">
          {/* Video player with annotation overlay */}
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
                isEditing={isEditing}
                activeTool={activeTool}
                activeColor={activeColor}
                activeStrokeWidth={activeStrokeWidth}
                onAnnotationAdd={addAnnotation}
              />
            }
            className="aspect-video"
          />

          {/* Annotation toolbar (edit mode only) */}
          {isEditing && (
            <AnnotationToolbar
              activeTool={activeTool}
              activeColor={activeColor}
              activeStrokeWidth={activeStrokeWidth}
              onToolChange={setActiveTool}
              onColorChange={setActiveColor}
              onStrokeWidthChange={setActiveStrokeWidth}
              onUndo={undo}
              onRedo={redo}
              onClear={clearAll}
              onSave={saveAnnotations}
              canUndo={undoStack.length > 0}
              canRedo={redoStack.length > 0}
              isSaving={isSaving}
              annotationCount={annotations.length}
            />
          )}

          {/* Annotation timeline */}
          <AnnotationTimeline
            annotations={annotations}
            duration={duration}
            currentTime={currentTime}
            onSeek={seekTo}
          />
        </div>

        {/* Right: Annotation list + Video info */}
        <div className="space-y-4">
          {/* Annotation list */}
          <div className="card p-3">
            <AnnotationList
              annotations={annotations}
              currentTime={currentTime}
              isEditing={isEditing}
              onSeek={seekTo}
              onDelete={isEditing ? deleteAnnotation : undefined}
            />
          </div>

          {/* Video info */}
          <div className="card p-3 space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
              Video Info
            </h3>
            <div className="space-y-1.5 text-xs">
              {video.description && (
                <p className="text-surface-600 dark:text-surface-400">{video.description}</p>
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
              {video.fileSizeMb && (
                <div className="flex justify-between">
                  <span className="text-muted">Size</span>
                  <span className="text-[var(--foreground)]">
                    {video.fileSizeMb.toFixed(1)} MB
                  </span>
                </div>
              )}
              {video.sharedWithAthletes.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">Shared with</span>
                  <span className="text-[var(--foreground)]">
                    {video.sharedWithAthletes.length} athlete{video.sharedWithAthletes.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Share Modal ─────────────────────────────────────────────── */}
      <Modal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Video"
        size="sm"
        footer={
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => setShowShareModal(false)}
              className="btn-ghost text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="btn-primary text-sm"
            >
              {isSharing ? "Sharing…" : "Share"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-muted mb-3">
          Select athletes to share this video with. They&apos;ll be able to view
          annotations.
        </p>
        <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
          {athletes.length === 0 ? (
            <p className="text-xs text-muted text-center py-4">
              No athletes on your roster yet.
            </p>
          ) : (
            athletes.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedAthleteIds.has(a.id)}
                  onChange={(e) => {
                    const next = new Set(selectedAthleteIds);
                    if (e.target.checked) next.add(a.id);
                    else next.delete(a.id);
                    setSelectedAthleteIds(next);
                  }}
                  className="rounded border-surface-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-[var(--foreground)]">{a.name}</span>
              </label>
            ))
          )}
        </div>
      </Modal>

      {/* ── Delete Confirmation ─────────────────────────────────────── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Video"
        description={
          <>
            Are you sure you want to delete &ldquo;{video.title ?? "this video"}&rdquo;?
            This will permanently remove the video and all annotations. This action
            cannot be undone.
          </>
        }
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
