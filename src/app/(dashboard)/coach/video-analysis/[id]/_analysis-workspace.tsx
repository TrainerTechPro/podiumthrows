"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Eye,
  EyeOff,
  Ruler,
  Trash2,
  Save,
} from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/video/VideoPlayer";
import { PoseOverlay } from "@/components/video/PoseOverlay";
import { usePoseDetection, type PoseResult } from "@/components/video/usePoseDetection";
import { PLAYBACK_SPEEDS, formatTimestamp } from "@/components/video/types";
import { calculateThrowAngles, type ThrowAngles } from "@/lib/pose-angles";
import { AnglesPanel } from "@/components/video-analysis/AnglesPanel";
import { KeyPositionsPanel, type KeyPosition } from "@/components/video-analysis/KeyPositionsPanel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/* ─── Types ────────────────────────────────────────────────────────────────── */

type Analysis = {
  id: string;
  title: string;
  description: string | null;
  event: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number | null;
  fps: number | null;
  status: string;
  annotations: unknown;
  keyPositions: unknown;
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
};

type Props = {
  analysis: Analysis;
};

/* ─── Event Labels ─────────────────────────────────────────────────────────── */

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

/* ─── Tabs ─────────────────────────────────────────────────────────────────── */

type TabId = "angles" | "positions";

const TABS: { id: TabId; label: string }[] = [
  { id: "angles", label: "Angles" },
  { id: "positions", label: "Key Positions" },
];

/* ─── Component ────────────────────────────────────────────────────────────── */

export function AnalysisWorkspace({ analysis }: Props) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const videoRef = useRef<VideoPlayerHandle>(null);

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(analysis.duration || 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Pose detection
  const pose = usePoseDetection();
  const [showOverlay, setShowOverlay] = useState(true);
  const [showAngles, setShowAngles] = useState(true);
  const [currentPose, setCurrentPose] = useState<PoseResult | null>(null);
  const [throwAngles, setThrowAngles] = useState<ThrowAngles | null>(null);
  const detectingRef = useRef(false);

  // Panel state
  const [activeTab, setActiveTab] = useState<TabId>("angles");
  const [positions, setPositions] = useState<KeyPosition[]>(() => {
    const kp = analysis.keyPositions as { positions?: KeyPosition[] } | null;
    return kp?.positions || [];
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Frame step size
  const fps = analysis.fps || 30;
  const frameStep = 1 / fps;

  /* ── Pose detection on frame change ──────────────────────────────────── */

  const detectCurrentFrame = useCallback(async () => {
    if (!pose.active || detectingRef.current) return;
    const video = videoRef.current?.getVideoElement();
    if (!video || video.readyState < 2) return;

    detectingRef.current = true;
    try {
      const result = await pose.detectFrame(video);
      setCurrentPose(result);
      if (result?.landmarks) {
        setThrowAngles(calculateThrowAngles(result.landmarks));
      } else {
        setThrowAngles(null);
      }
    } finally {
      detectingRef.current = false;
    }
  }, [pose]);

  // Detect pose when time changes (scrubbing or stepping)
  useEffect(() => {
    if (pose.active && !isPlaying) {
      detectCurrentFrame();
    }
  }, [currentTime, pose.active, isPlaying, detectCurrentFrame]);

  // Detect pose during playback at frame rate
  useEffect(() => {
    if (!pose.active || !isPlaying) return;

    const interval = setInterval(() => {
      detectCurrentFrame();
    }, 1000 / Math.min(fps, 15)); // Cap at 15fps for performance

    return () => clearInterval(interval);
  }, [pose.active, isPlaying, fps, detectCurrentFrame]);

  /* ── Initialize pose detection on toggle ──────────────────────────── */

  async function handleTogglePose() {
    if (!pose.active && !pose.loading) {
      await pose.initialize();
      pose.toggle();
      // Detect immediately on the current frame
      setTimeout(detectCurrentFrame, 500);
    } else {
      pose.toggle();
      if (pose.active) {
        setCurrentPose(null);
        setThrowAngles(null);
      }
    }
  }

  /* ── Playback controls ──────────────────────────────────────────────── */

  function handlePlayPause() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  function handleStepForward() {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    video.seekTo(Math.min(currentTime + frameStep, duration));
  }

  function handleStepBackward() {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    video.seekTo(Math.max(currentTime - frameStep, 0));
  }

  function handleSeek(time: number) {
    videoRef.current?.seekTo(time);
  }

  function handleSpeedChange(s: number) {
    setSpeed(s);
    setShowSpeedMenu(false);
    const video = videoRef.current?.getVideoElement();
    if (video) video.playbackRate = s;
  }

  /* ── Key Positions ──────────────────────────────────────────────────── */

  function handleMarkPosition(label: string) {
    if (!throwAngles) return;
    const newPos: KeyPosition = {
      id: `kp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: currentTime,
      label,
      angles: throwAngles,
      notes: "",
    };
    setPositions((prev) => [...prev, newPos].sort((a, b) => a.timestamp - b.timestamp));
  }

  function handleDeletePosition(id: string) {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }

  function handleUpdateNotes(id: string, notes: string) {
    setPositions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, notes } : p))
    );
  }

  /* ── Save to API ────────────────────────────────────────────────────── */

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/video-analysis/${analysis.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          keyPositions: { positions },
          status: "COMPLETED",
          duration,
          fps,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Save failed");
      }
      success("Analysis saved");
    } catch (err) {
      showError("Failed to save", err instanceof Error ? err.message : "Please try again");
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete analysis ────────────────────────────────────────────────── */

  async function handleDelete() {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/video-analysis/${analysis.id}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Delete failed");
      }
      success("Analysis deleted");
      router.push("/coach/video-analysis");
    } catch (err) {
      showError("Failed to delete", err instanceof Error ? err.message : "Please try again");
      setDeleting(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-4 animate-spring-up">
      {/* Breadcrumbs + Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <nav className="flex items-center gap-1.5 text-sm text-muted">
          <Link href="/coach/video-analysis" className="hover:text-[var(--foreground)] transition-colors">
            Pose Analysis
          </Link>
          <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
          <span className="text-[var(--foreground)] truncate max-w-[200px]">
            {analysis.title}
          </span>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Save size={14} strokeWidth={2} aria-hidden="true" />
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="btn-secondary text-sm text-danger-500 hover:text-danger-600 flex items-center gap-1.5"
            aria-label="Delete analysis"
          >
            <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
          </button>
          <ConfirmDialog
            open={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={handleDelete}
            title="Delete Video Analysis"
            description="This will permanently delete the analysis, annotations, and key positions. This cannot be undone."
            confirmLabel="Delete"
            variant="danger"
            loading={deleting}
          />
        </div>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">{analysis.title}</h1>
        <p className="text-sm text-muted mt-0.5">
          {analysis.athlete.firstName} {analysis.athlete.lastName} · {EVENT_LABELS[analysis.event] || analysis.event}
          {analysis.description && ` · ${analysis.description}`}
        </p>
      </div>

      {/* Main Layout: Video + Panel */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Video Section (60%) */}
        <div className="lg:w-[60%] space-y-3">
          {/* Video with Pose Overlay */}
          <div className="relative rounded-xl overflow-hidden bg-black border border-surface-200 dark:border-surface-700">
            <VideoPlayer
              ref={videoRef}
              src={analysis.videoUrl}
              poster={analysis.thumbnailUrl || undefined}
              onTimeUpdate={setCurrentTime}
              onReady={(d) => setDuration(d)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              showControls={false}
              onVideoClick={handlePlayPause}
            />

            {/* Pose skeleton overlay */}
            {showOverlay && pose.active && (
              <PoseOverlay
                pose={currentPose}
                showAngles={showAngles}
              />
            )}

            {/* Pose loading indicator */}
            {pose.loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-white">Loading pose model…</p>
                </div>
              </div>
            )}
          </div>

          {/* Custom Controls */}
          <div className="card p-3 space-y-2">
            {/* Scrubber */}
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={frameStep}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full h-2 rounded-full appearance-none bg-surface-200 dark:bg-surface-700 cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:shadow-glow
                [&::-webkit-slider-thumb]:cursor-pointer"
            />

            {/* Transport */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {/* Step back */}
                <button
                  type="button"
                  onClick={handleStepBackward}
                  className="p-2.5 rounded-lg text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                  aria-label="Previous frame"
                >
                  <SkipBack size={16} strokeWidth={2} aria-hidden="true" />
                </button>

                {/* Play/Pause */}
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="p-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                >
                  {isPlaying ? (
                    <Pause size={18} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <Play size={18} strokeWidth={2} aria-hidden="true" />
                  )}
                </button>

                {/* Step forward */}
                <button
                  type="button"
                  onClick={handleStepForward}
                  className="p-2.5 rounded-lg text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                  aria-label="Next frame"
                >
                  <SkipForward size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>

              {/* Timestamp */}
              <span className="text-xs font-mono tabular-nums text-muted">
                {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
              </span>

              {/* Right-side controls */}
              <div className="flex items-center gap-1">
                {/* Speed selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="px-2 py-1 rounded-lg text-xs font-mono tabular-nums text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                  >
                    {speed}x
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-1 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-lg py-1 z-10">
                      {PLAYBACK_SPEEDS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleSpeedChange(s)}
                          className={`block w-full px-3 py-1 text-xs text-left font-mono transition-colors ${
                            speed === s
                              ? "text-primary-500 bg-primary-500/10"
                              : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Toggle pose overlay */}
                <button
                  type="button"
                  onClick={handleTogglePose}
                  className={`p-2.5 rounded-lg transition-colors ${
                    pose.active
                      ? "text-primary-500 bg-primary-500/10"
                      : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
                  }`}
                  aria-label={pose.active ? "Disable pose detection" : "Enable pose detection"}
                >
                  {showOverlay ? (
                    <Eye size={16} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
                  )}
                </button>

                {/* Toggle angle labels */}
                {pose.active && (
                  <button
                    type="button"
                    onClick={() => setShowAngles(!showAngles)}
                    className={`p-2.5 rounded-lg transition-colors ${
                      showAngles
                        ? "text-primary-500 bg-primary-500/10"
                        : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
                    }`}
                    aria-label={showAngles ? "Hide angle labels" : "Show angle labels"}
                  >
                    <Ruler size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}

                {/* Toggle overlay visibility */}
                {pose.active && (
                  <button
                    type="button"
                    onClick={() => setShowOverlay(!showOverlay)}
                    className={`p-2.5 rounded-lg transition-colors ${
                      showOverlay
                        ? "text-success-500 bg-success-500/10"
                        : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
                    }`}
                    aria-label={showOverlay ? "Hide skeleton" : "Show skeleton"}
                  >
                    {showOverlay ? (
                      <Eye size={16} strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Pose error */}
          {pose.error && (
            <div className="bg-danger-50 border border-danger-500/30 rounded-lg p-3">
              <p className="text-sm text-danger-500">Pose detection error: {pose.error}</p>
            </div>
          )}
        </div>

        {/* Analysis Panel (40%) */}
        <div className="lg:w-[40%]">
          <div className="card p-4 lg:sticky lg:top-20">
            {/* Tabs */}
            <div className="flex border-b border-surface-200 dark:border-surface-700 mb-4">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === tab.id
                      ? "border-primary-500 text-primary-500"
                      : "border-transparent text-muted hover:text-[var(--foreground)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === "angles" && (
              <AnglesPanel
                angles={throwAngles}
                isDetecting={pose.active}
              />
            )}

            {activeTab === "positions" && (
              <KeyPositionsPanel
                positions={positions}
                currentTime={currentTime}
                currentAngles={throwAngles}
                isDetecting={pose.active}
                onMark={handleMarkPosition}
                onDelete={handleDeletePosition}
                onUpdateNotes={handleUpdateNotes}
                onSeek={handleSeek}
              />
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
