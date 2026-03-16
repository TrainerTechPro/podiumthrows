"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { VideoDetail } from "@/lib/data/coach";
import { csrfHeaders } from "@/lib/csrf-client";
import { AnnotationToolbar } from "@/components/video/AnnotationToolbar";
import { AnnotationTimeline } from "@/components/video/AnnotationTimeline";
import { AnnotationList } from "@/components/video/AnnotationList";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { Annotation, AnnotationTool } from "@/components/video/types";

const ImmersiveVideoOverlay = dynamic(
  () => import("@/components/video/ImmersiveVideoOverlay").then((m) => m.ImmersiveVideoOverlay),
  { ssr: false }
);
import {
  VideoAnalysisWorkspace,
  type VideoAnalysisWorkspaceHandle,
} from "@/components/video/VideoAnalysisWorkspace";
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
  const workspaceRef = useRef<VideoAnalysisWorkspaceHandle>(null);

  // Primary video state (updated by VideoAnalysisWorkspace)
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSec ?? 0);

  // Analysis mode
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("single");
  const [compareVideo, setCompareVideo] = useState<CompareVideo | null>(null);
  const [compareVideos, setCompareVideos] = useState<CompareVideo[] | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [ghostOpacity, setGhostOpacity] = useState(50);

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
      return;
    }
    setAnalysisMode(mode);
    loadCompareVideos();
  }

  function selectCompareVideo(cv: CompareVideo) {
    setCompareVideo(cv);
  }

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
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
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
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
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
        headers: csrfHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/coach/videos");
    } catch (err) {
      console.error("Delete failed:", err);
      toastError("Delete failed", "Could not delete the video.");
    }
  }

  /* ── Seek helper (delegates to workspace) ────────────────────────────── */

  function seekTo(time: number) {
    workspaceRef.current?.seekTo(time);
  }

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
          {/* ── Video Analysis Workspace ───────────────────────────── */}
          {/* Compare video picker shown when in split/ghost mode without a selection */}
          {analysisMode !== "single" && !compareVideo && (
            <div className="mb-2">
              {analysisMode === "ghost" ? (
                <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
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
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="aspect-video bg-surface-100 dark:bg-surface-900 rounded-xl flex items-center justify-center text-surface-400 text-sm">
                    Primary video (A)
                  </div>
                  <CompareVideoPicker
                    videos={compareVideos}
                    loading={loadingCompare}
                    onSelect={selectCompareVideo}
                  />
                </div>
              )}
            </div>
          )}

          {/* The workspace handles all video rendering, controls, JogWheel, and sync */}
          {(analysisMode === "single" || compareVideo) && (
            <VideoAnalysisWorkspace
              ref={workspaceRef}
              videoA={{
                src: video.url,
                poster: video.thumbnailUrl ?? undefined,
                title: video.title ?? undefined,
                transcodedUrl: video.transcodedUrl ?? undefined,
              }}
              videoB={
                compareVideo
                  ? {
                      src: compareVideo.url,
                      title: compareVideo.title ?? undefined,
                    }
                  : undefined
              }
              mode={analysisMode}
              annotations={annotations}
              isEditing={isEditing}
              activeTool={activeTool}
              activeColor={activeColor}
              activeStrokeWidth={activeStrokeWidth}
              onAnnotationAdd={addAnnotation}
              onTimeUpdate={setCurrentTime}
              onDurationReady={setDuration}
              ghostOpacity={ghostOpacity}
              onGhostOpacityChange={setGhostOpacity}
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

      {/* ── Immersive Video Overlay (lazy-loaded) ─────────────────── */}
      {showImmersive && (
        <ImmersiveVideoOverlay
          open
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
      )}
    </div>
  );
}

/* ─── Master Control Bar: now handled by VideoAnalysisWorkspace ─────────── */

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

/* Master control icons removed — now in VideoAnalysisWorkspace */

