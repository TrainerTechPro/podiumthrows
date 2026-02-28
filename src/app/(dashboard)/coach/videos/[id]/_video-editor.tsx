"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
import { ImmersiveVideoOverlay } from "@/components/video/ImmersiveVideoOverlay";
import { formatEventType } from "@/lib/utils";
import { formatTimestamp } from "@/components/video/types";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  video: VideoDetail;
  athletes: { id: string; name: string }[];
};

type AnalysisMode = "single" | "split" | "ghost";

type CompareVideo = {
  id: string;
  title: string | null;
  url: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function VideoEditor({ video, athletes }: Props) {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();
  const playerRef = useRef<VideoPlayerHandle>(null);
  const compareRef = useRef<VideoPlayerHandle>(null);
  const ghostVideoRef = useRef<HTMLVideoElement>(null);

  // Primary video state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSec ?? 0);

  // Analysis mode
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("single");
  const [masterTime, setMasterTime] = useState(0);
  const [masterPlaying, setMasterPlaying] = useState(false);
  const [compareVideo, setCompareVideo] = useState<CompareVideo | null>(null);
  const [compareVideos, setCompareVideos] = useState<CompareVideo[] | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [ghostOpacity, setGhostOpacity] = useState(50);
  const [compareSpeed, setCompareSpeed] = useState(1);

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

  // Immersive mode
  const [showImmersive, setShowImmersive] = useState(false);

  /* ── Load compare video list ─────────────────────────────────────────── */

  async function loadCompareVideos() {
    if (compareVideos !== null) return;
    setLoadingCompare(true);
    try {
      const res = await fetch("/api/coach/videos");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setCompareVideos(
        (data.videos as CompareVideo[]).filter((v) => v.id !== video.id)
      );
    } catch {
      toastError("Error", "Could not load video library.");
    } finally {
      setLoadingCompare(false);
    }
  }

  function activateMode(mode: "split" | "ghost") {
    if (analysisMode === mode) {
      // Toggle off
      setAnalysisMode("single");
      setCompareVideo(null);
      setMasterPlaying(false);
      playerRef.current?.pause();
      return;
    }
    setAnalysisMode(mode);
    loadCompareVideos();
  }

  function selectCompareVideo(cv: CompareVideo) {
    setCompareVideo(cv);
    setMasterTime(playerRef.current?.currentTime ?? 0);
  }

  /* ── Master sync controls ────────────────────────────────────────────── */

  const handlePrimaryTimeUpdate = useCallback(
    (t: number) => {
      setCurrentTime(t);
      setMasterTime(t);
    },
    []
  );

  function handleMasterSeek(t: number) {
    setMasterTime(t);
    playerRef.current?.seekTo(t);
    if (analysisMode === "split" && compareRef.current) {
      compareRef.current.seekTo(t);
    }
    if (analysisMode === "ghost" && ghostVideoRef.current) {
      ghostVideoRef.current.currentTime = t;
    }
  }

  function toggleMasterPlay() {
    if (masterPlaying) {
      playerRef.current?.pause();
      if (analysisMode === "split") compareRef.current?.pause();
      if (analysisMode === "ghost") ghostVideoRef.current?.pause();
      setMasterPlaying(false);
    } else {
      playerRef.current?.play();
      if (analysisMode === "split" && compareVideo) compareRef.current?.play();
      if (analysisMode === "ghost" && compareVideo)
        ghostVideoRef.current?.play();
      setMasterPlaying(true);
    }
  }

  function frameMasterStep(dir: 1 | -1) {
    const step = dir * (1 / 30);
    const t = Math.max(0, Math.min(duration, masterTime + step));
    handleMasterSeek(t);
    // Pause both when stepping frames
    playerRef.current?.pause();
    if (analysisMode === "split") compareRef.current?.pause();
    if (analysisMode === "ghost") ghostVideoRef.current?.pause();
    setMasterPlaying(false);
  }

  function reSync() {
    if (analysisMode === "split" && compareRef.current) {
      compareRef.current.seekTo(masterTime);
    }
    if (analysisMode === "ghost" && ghostVideoRef.current) {
      ghostVideoRef.current.currentTime = masterTime;
    }
  }

  // Keep ghost video speed in sync
  useEffect(() => {
    if (ghostVideoRef.current) {
      ghostVideoRef.current.playbackRate = compareSpeed;
    }
  }, [compareSpeed]);

  // Sync masterPlaying state when primary video auto-pauses (e.g., reaches end)
  const handlePrimaryPause = useCallback(() => setMasterPlaying(false), []);
  const handlePrimaryPlay = useCallback(() => setMasterPlaying(true), []);

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
      toastSuccess(
        "Video shared",
        `Shared with ${selectedAthleteIds.size} athlete${selectedAthleteIds.size !== 1 ? "s" : ""}.`
      );
    } catch (err) {
      console.error("Share failed:", err);
      toastError("Share failed", "Could not update sharing settings.");
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
      toastError("Delete failed", "Could not delete the video.");
    }
  }

  /* ── Seek helper ─────────────────────────────────────────────────────── */

  function seekTo(time: number) {
    playerRef.current?.seekTo(time);
    if (analysisMode !== "single") handleMasterSeek(time);
  }

  /* ── Annotation canvas (shared across all modes) ─────────────────────── */

  const annotationCanvas = (
    <AnnotationCanvas
      annotations={annotations}
      currentTime={currentTime}
      isEditing={isEditing}
      activeTool={activeTool}
      activeColor={activeColor}
      activeStrokeWidth={activeStrokeWidth}
      onAnnotationAdd={addAnnotation}
    />
  );

  /* ── Render ──────────────────────────────────────────────────────────── */

  const isMasterMode = analysisMode !== "single";

  return (
    <div className="space-y-4">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/coach/videos"
          aria-label="Back to Video Library"
          className="p-1.5 rounded-lg text-surface-400 hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
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
                {video.category.charAt(0).toUpperCase() +
                  video.category.slice(1)}
              </Badge>
            )}
          </div>
        </div>

        {/* Analysis mode toggle */}
        <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-lg p-0.5 gap-0.5">
          <ModeButton
            label="Single"
            icon={<SingleIcon />}
            active={analysisMode === "single"}
            onClick={() => {
              setAnalysisMode("single");
              setCompareVideo(null);
              setMasterPlaying(false);
              playerRef.current?.pause();
            }}
          />
          <ModeButton
            label="Split"
            icon={<SplitIcon />}
            active={analysisMode === "split"}
            onClick={() => activateMode("split")}
            title="Side-by-side comparison"
          />
          <ModeButton
            label="Ghost"
            icon={<GhostIcon />}
            active={analysisMode === "ghost"}
            onClick={() => activateMode("ghost")}
            title="Overlay comparison at 50% opacity"
          />
        </div>

        {/* Edit mode toggle */}
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

        {/* Immersive */}
        <button
          onClick={() => setShowImmersive(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
          title="Open immersive review mode"
        >
          Immersive
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
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      {/* ── Main layout ─────────────────────────────────────────────── */}
      <div
        className={`grid gap-4 ${
          analysisMode === "single"
            ? "grid-cols-1 lg:grid-cols-[1fr_280px]"
            : "grid-cols-1"
        }`}
      >
        {/* Left/Main: Video area */}
        <div className="space-y-3">
          {/* ── SINGLE MODE ────────────────────────────────────────── */}
          {analysisMode === "single" && (
            <VideoPlayer
              ref={playerRef}
              src={video.url}
              poster={video.thumbnailUrl ?? undefined}
              onTimeUpdate={setCurrentTime}
              onReady={setDuration}
              onPlay={handlePrimaryPlay}
              onPause={handlePrimaryPause}
              overlay={annotationCanvas}
              className="aspect-video"
            />
          )}

          {/* ── SPLIT MODE ─────────────────────────────────────────── */}
          {analysisMode === "split" && (
            <div className="grid grid-cols-2 gap-2">
              {/* Video A — primary with annotations */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-1">
                  <span className="w-5 h-5 rounded bg-primary-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    A
                  </span>
                  <span className="text-xs font-medium text-[var(--foreground)] truncate">
                    {video.title ?? "Untitled"}
                  </span>
                </div>
                <VideoPlayer
                  ref={playerRef}
                  src={video.url}
                  poster={video.thumbnailUrl ?? undefined}
                  onTimeUpdate={handlePrimaryTimeUpdate}
                  onReady={(d) => setDuration(d)}
                  onPlay={handlePrimaryPlay}
                  onPause={handlePrimaryPause}
                  showControls={false}
                  onVideoClick={toggleMasterPlay}
                  overlay={annotationCanvas}
                  className="aspect-video"
                />
              </div>

              {/* Video B — comparison */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-1">
                  <span className="w-5 h-5 rounded bg-surface-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    B
                  </span>
                  <span className="text-xs font-medium text-surface-500 truncate">
                    {compareVideo?.title ?? "Select video…"}
                  </span>
                </div>
                {compareVideo ? (
                  <VideoPlayer
                    ref={compareRef}
                    src={compareVideo.url}
                    showControls={false}
                    onVideoClick={toggleMasterPlay}
                    className="aspect-video"
                  />
                ) : (
                  <CompareVideoPicker
                    videos={compareVideos}
                    loading={loadingCompare}
                    onSelect={selectCompareVideo}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── GHOST MODE ─────────────────────────────────────────── */}
          {analysisMode === "ghost" && (
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
              {/* Primary video — no built-in controls */}
              <VideoPlayer
                ref={playerRef}
                src={video.url}
                poster={video.thumbnailUrl ?? undefined}
                onTimeUpdate={handlePrimaryTimeUpdate}
                onReady={(d) => setDuration(d)}
                onPlay={handlePrimaryPlay}
                onPause={handlePrimaryPause}
                showControls={false}
                onVideoClick={toggleMasterPlay}
                className="w-full h-full rounded-none"
              />

              {/* Ghost video overlay */}
              {compareVideo && (
                <video
                  ref={ghostVideoRef}
                  src={compareVideo.url}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{ opacity: ghostOpacity / 100 }}
                  playsInline
                  preload="metadata"
                  muted
                />
              )}

              {/* Annotation canvas — on top of both videos */}
              <div
                className="absolute inset-0"
                style={{ pointerEvents: isEditing ? "auto" : "none" }}
              >
                {annotationCanvas}
              </div>

              {/* Ghost video picker overlay (when no compare selected) */}
              {!compareVideo && (
                <div className="absolute inset-0 flex items-start justify-center pt-8">
                  <div className="bg-surface-900/95 rounded-xl p-4 w-72 shadow-2xl">
                    <p className="text-sm font-medium text-white mb-3 text-center">
                      Select ghost video
                    </p>
                    <CompareVideoPicker
                      videos={compareVideos}
                      loading={loadingCompare}
                      onSelect={selectCompareVideo}
                      dark
                    />
                  </div>
                </div>
              )}

              {/* Ghost labels */}
              {compareVideo && (
                <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-none">
                  <span className="text-[10px] bg-primary-500/80 text-white px-2 py-0.5 rounded font-medium">
                    A — {video.title ?? "Primary"}
                  </span>
                  <span
                    className="text-[10px] bg-surface-600/80 text-white px-2 py-0.5 rounded font-medium"
                    style={{ opacity: ghostOpacity / 100 + 0.4 }}
                  >
                    B — {compareVideo.title ?? "Ghost"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── MASTER CONTROL BAR (split + ghost modes) ───────────── */}
          {isMasterMode && (
            <MasterControls
              playing={masterPlaying}
              currentTime={masterTime}
              duration={duration}
              onTogglePlay={toggleMasterPlay}
              onSeek={handleMasterSeek}
              onFrameStep={frameMasterStep}
              onReSync={compareVideo ? reSync : undefined}
              analysisMode={analysisMode}
              ghostOpacity={ghostOpacity}
              onGhostOpacityChange={analysisMode === "ghost" ? setGhostOpacity : undefined}
              compareSpeed={compareSpeed}
              onCompareSpeedChange={setCompareSpeed}
              hasCompare={!!compareVideo}
              onChangeCompare={() => setCompareVideo(null)}
            />
          )}

          {/* ── Annotation toolbar (edit mode only) ────────────────── */}
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

          {/* ── Annotation timeline ─────────────────────────────────── */}
          <AnnotationTimeline
            annotations={annotations}
            duration={duration}
            currentTime={currentTime}
            onSeek={seekTo}
          />
        </div>

        {/* Right sidebar: shown only in single mode */}
        {analysisMode === "single" && (
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
                      {video.sharedWithAthletes.length} athlete
                      {video.sharedWithAthletes.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* In split/ghost mode: annotations shown below master bar */}
        {isMasterMode && (annotations.length > 0 || isEditing) && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            <div /> {/* spacer */}
            <div className="card p-3">
              <AnnotationList
                annotations={annotations}
                currentTime={currentTime}
                isEditing={isEditing}
                onSeek={seekTo}
                onDelete={isEditing ? deleteAnnotation : undefined}
              />
            </div>
          </div>
        )}
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
                <span className="text-sm text-[var(--foreground)]">
                  {a.name}
                </span>
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
            Are you sure you want to delete &ldquo;
            {video.title ?? "this video"}&rdquo;? This will permanently remove
            the video and all annotations. This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        variant="danger"
      />

      {/* ── Immersive Video Overlay ──────────────────────────────────── */}
      <ImmersiveVideoOverlay
        open={showImmersive}
        onClose={() => setShowImmersive(false)}
        videoSrc={video.url}
        poster={video.thumbnailUrl ?? undefined}
        title={video.title ?? "Untitled Video"}
        annotations={annotations}
        onAnnotationsChange={setAnnotations}
        isEditing={isEditing}
        onSave={saveAnnotations}
        isSaving={isSaving}
        initialTime={currentTime}
      />
    </div>
  );
}

/* ─── Master Control Bar ───────────────────────────────────────────────────── */

type MasterControlsProps = {
  playing: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onFrameStep: (dir: 1 | -1) => void;
  onReSync?: () => void;
  analysisMode: AnalysisMode;
  ghostOpacity: number;
  onGhostOpacityChange?: (v: number) => void;
  compareSpeed: number;
  onCompareSpeedChange: (v: number) => void;
  hasCompare: boolean;
  onChangeCompare: () => void;
};

const MASTER_SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2];

function MasterControls({
  playing,
  currentTime,
  duration,
  onTogglePlay,
  onSeek,
  onFrameStep,
  onReSync,
  analysisMode,
  ghostOpacity,
  onGhostOpacityChange,
  compareSpeed,
  onCompareSpeedChange,
  hasCompare,
  onChangeCompare,
}: MasterControlsProps) {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  useEffect(() => {
    if (!showSpeedMenu) return;
    const h = () => setShowSpeedMenu(false);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [showSpeedMenu]);

  // Keyboard shortcuts in master mode
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          onTogglePlay();
          break;
        case ",":
          e.preventDefault();
          onFrameStep(-1);
          break;
        case ".":
          e.preventDefault();
          onFrameStep(1);
          break;
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onTogglePlay, onFrameStep]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const modeLabel = analysisMode === "ghost" ? "Ghost" : "Split";

  return (
    <div className="bg-surface-900 dark:bg-surface-950 rounded-xl px-4 py-3 space-y-2.5">
      {/* Mode badge + change compare button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-400">
            {modeLabel} Analysis
          </span>
          {hasCompare && (
            <span className="text-[10px] text-surface-500">
              · Synchronized playback
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {analysisMode === "ghost" && onGhostOpacityChange && (
            <label className="flex items-center gap-1.5 text-[10px] text-surface-400">
              Ghost
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={ghostOpacity}
                onChange={(e) => onGhostOpacityChange(parseInt(e.target.value))}
                className="w-16 h-1 accent-primary-500 cursor-pointer"
              />
              {ghostOpacity}%
            </label>
          )}
          {hasCompare && (
            <button
              onClick={onChangeCompare}
              className="text-[10px] text-surface-400 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-surface-800"
            >
              Change B
            </button>
          )}
        </div>
      </div>

      {/* Precision scrub slider */}
      <div className="relative group/scrub">
        {/* Track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-white/10 rounded-full pointer-events-none" />
        {/* Filled */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-1.5 bg-primary-500 rounded-full pointer-events-none"
          style={{ width: `${progress}%` }}
        />
        {/* Range input */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.0333}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="relative w-full opacity-0 h-4 cursor-pointer"
          aria-label="Scrub both videos"
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2 text-white">
        {/* Frame back */}
        <button
          onClick={() => onFrameStep(-1)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          title="Previous frame (,)"
        >
          <MasterFrameBackIcon />
        </button>

        {/* Play / Pause */}
        <button
          onClick={onTogglePlay}
          className="w-8 h-8 rounded-full bg-primary-500 hover:bg-primary-400 flex items-center justify-center transition-colors shrink-0"
          title={playing ? "Pause (Space)" : "Play (Space)"}
        >
          {playing ? <SmallPauseIcon /> : <SmallPlayIcon />}
        </button>

        {/* Frame forward */}
        <button
          onClick={() => onFrameStep(1)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          title="Next frame (.)"
        >
          <MasterFrameFwdIcon />
        </button>

        {/* Time display */}
        <span className="font-mono text-xs tabular-nums text-surface-300 min-w-[110px]">
          {formatTimestamp(currentTime)}
          <span className="text-surface-600"> / </span>
          {formatTimestamp(duration)}
        </span>

        <div className="flex-1" />

        {/* Speed selector */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSpeedMenu((v) => !v);
            }}
            className="px-2 py-0.5 hover:bg-white/10 rounded transition-colors text-xs font-mono text-surface-300"
            title="Playback speed"
          >
            {compareSpeed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full right-0 mb-1 bg-surface-800 border border-surface-600 rounded-lg py-1 shadow-xl z-20">
              {MASTER_SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompareSpeedChange(s);
                    setShowSpeedMenu(false);
                  }}
                  className={`block w-full text-left px-3 py-1 text-xs hover:bg-white/10 ${
                    compareSpeed === s ? "text-primary-400" : "text-white"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Re-sync button */}
        {onReSync && (
          <button
            onClick={onReSync}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-surface-400 hover:text-white"
            title="Re-sync video B to current time"
          >
            <ReSyncIcon />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Compare Video Picker ─────────────────────────────────────────────────── */

type CompareVideoPickerProps = {
  videos: CompareVideo[] | null;
  loading: boolean;
  onSelect: (v: CompareVideo) => void;
  dark?: boolean;
};

function CompareVideoPicker({
  videos,
  loading,
  onSelect,
  dark = false,
}: CompareVideoPickerProps) {
  const [search, setSearch] = useState("");

  const filtered = videos
    ? videos.filter((v) =>
        (v.title ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const base = dark
    ? "bg-surface-900 rounded-xl overflow-hidden"
    : "aspect-video bg-surface-100 dark:bg-surface-900 rounded-xl flex flex-col overflow-hidden";

  return (
    <div className={base}>
      <div className={`flex flex-col h-full ${dark ? "" : "p-4 justify-center items-center"}`}>
        {loading ? (
          <div className="flex items-center justify-center h-full gap-2 text-surface-400 text-sm">
            <svg
              className="animate-spin w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Loading videos…
          </div>
        ) : filtered === null ? (
          <p className="text-surface-400 text-xs text-center">Loading…</p>
        ) : filtered.length === 0 && !search ? (
          <p className="text-surface-400 text-xs text-center">
            No other videos in your library.
          </p>
        ) : (
          <div className={`flex flex-col ${dark ? "p-3" : "w-full max-w-xs"} gap-2`}>
            <p className={`text-xs font-medium ${dark ? "text-surface-300" : "text-surface-500 dark:text-surface-400"} text-center`}>
              Select video to compare
            </p>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className={`input text-xs py-1.5 ${dark ? "bg-surface-800 border-surface-700 text-white placeholder-surface-500" : ""}`}
            />
            <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-0.5">
              {(filtered.length > 0 ? filtered : videos ?? []).map((v) => (
                <button
                  key={v.id}
                  onClick={() => onSelect(v)}
                  className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg text-left transition-colors ${
                    dark
                      ? "hover:bg-surface-800 text-surface-300 hover:text-white"
                      : "hover:bg-surface-200 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300"
                  }`}
                >
                  <div className="w-10 h-7 rounded overflow-hidden bg-surface-800 shrink-0">
                    {v.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-surface-600">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="23 7 16 12 23 17 23 7" />
                          <rect x="1" y="5" width="15" height="14" rx="2" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {v.title ?? "Untitled"}
                    </p>
                    {v.durationSec && (
                      <p className="text-[10px] text-surface-500 tabular-nums font-mono">
                        {formatTimestamp(v.durationSec)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
              {search && filtered?.length === 0 && (
                <p className="text-[10px] text-surface-500 text-center py-2">
                  No results
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Mode Button ──────────────────────────────────────────────────────────── */

function ModeButton({
  label,
  icon,
  active,
  onClick,
  title,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title ?? label}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
        active
          ? "bg-white dark:bg-surface-700 text-[var(--foreground)] shadow-sm"
          : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */

const ico = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

function SingleIcon() {
  return (
    <svg {...ico}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg {...ico}>
      <rect x="2" y="3" width="9" height="18" rx="2" />
      <rect x="13" y="3" width="9" height="18" rx="2" />
    </svg>
  );
}

function GhostIcon() {
  return (
    <svg {...ico}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <rect x="3" y="3" width="18" height="18" rx="2" opacity="0.4" />
      <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="3 2" />
    </svg>
  );
}

function SmallPlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21" />
    </svg>
  );
}

function SmallPauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function MasterFrameBackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="11 19 2 12 11 5" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function MasterFrameFwdIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 5 22 12 13 19" />
      <line x1="22" y1="12" x2="2" y2="12" />
    </svg>
  );
}

function ReSyncIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <polyline points="23 20 23 14 17 14" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  );
}

