"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Video as VideoIcon,
  Square,
  Circle,
  RefreshCw,
  Eye,
  EyeOff,
  Ruler,
  MapPin,
  Trash2,
  Save,
  AlertCircle,
} from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { useToast } from "@/components/ui/Toast";
import { PoseOverlay } from "@/components/video/PoseOverlay";
import { usePoseDetection, type PoseResult } from "@/components/video/usePoseDetection";
import { calculateThrowAngles, type ThrowAngles } from "@/lib/pose-angles";
import { AngleIndicator } from "@/components/video-analysis/AngleIndicator";
import { getAnglesWithStatus } from "@/lib/pose-angles";

/* ─── Types ────────────────────────────────────────────────────────────────── */

type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
};

type Props = {
  athletes: Athlete[];
};

type CaptureMark = {
  id: string;
  timestamp: number; // ms since recording start
  label: string;
  angles: ThrowAngles;
};

type FacingMode = "user" | "environment";

const EVENT_OPTIONS = [
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
] as const;

const POSITION_LABELS = [
  "Power Position",
  "Release",
  "Block",
  "Entry",
  "Recovery",
  "Custom",
] as const;

/* ─── Component ────────────────────────────────────────────────────────────── */

export function LiveCapture({ athletes }: Props) {
  const router = useRouter();
  const { success, error: showError, info } = useToast();

  // Camera + stream
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<FacingMode>("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Pose detection
  const pose = usePoseDetection();
  const [showOverlay, setShowOverlay] = useState(true);
  const [showAngles, setShowAngles] = useState(true);
  const [currentPose, setCurrentPose] = useState<PoseResult | null>(null);
  const [throwAngles, setThrowAngles] = useState<ThrowAngles | null>(null);
  const detectingRef = useRef(false);

  // Recording
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Mark positions during live capture
  const [marks, setMarks] = useState<CaptureMark[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>("Power Position");

  // Save form state (shown after recording stops)
  const [athleteId, setAthleteId] = useState("");
  const [event, setEvent] = useState<string>("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  /* ── Camera lifecycle ───────────────────────────────────────────────── */

  const startCamera = useCallback(async (mode: FacingMode) => {
    setCameraError(null);
    setCameraReady(false);
    try {
      // Stop any existing stream first
      streamRef.current?.getTracks().forEach((t) => t.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;

      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.onloadedmetadata = () => {
          v.play().catch(() => {});
          setCameraReady(true);
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera unavailable";
      setCameraError(msg);
    }
  }, []);

  // Mount: start camera, init pose model
  useEffect(() => {
    startCamera(facing);
    pose.initialize();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flipCamera() {
    const next: FacingMode = facing === "user" ? "environment" : "user";
    setFacing(next);
    startCamera(next);
  }

  /* ── Pose detection loop (rAF, throttled to 15fps) ──────────────── */

  const detectFrame = useCallback(async () => {
    if (detectingRef.current || !cameraReady) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    detectingRef.current = true;
    try {
      const result = await pose.detectFrame(video);
      setCurrentPose(result);
      setThrowAngles(result?.landmarks ? calculateThrowAngles(result.landmarks) : null);
    } finally {
      detectingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraReady]);

  useEffect(() => {
    if (!cameraReady) return;
    let rafId: number;
    let last = 0;
    const minInterval = 1000 / 15;

    function tick(now: number) {
      if (now - last >= minInterval) {
        last = now;
        detectFrame();
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [cameraReady, detectFrame]);

  /* ── Elapsed timer during recording ─────────────────────────────────── */

  useEffect(() => {
    if (!isRecording) {
      setElapsedSec(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - recordStartRef.current) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [isRecording]);

  /* ── Recording controls ─────────────────────────────────────────────── */

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) {
      showError("No camera stream available");
      return;
    }

    // Pick a supported codec — prefer mp4 (iOS Safari), fall back to webm
    const candidates = [
      "video/mp4;codecs=avc1",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const mimeType = candidates.find(
      (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)
    );
    if (!mimeType) {
      showError("Recording not supported on this browser");
      return;
    }

    try {
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
      };

      recorder.start(1000); // chunk every 1s
      recorderRef.current = recorder;
      recordStartRef.current = Date.now();
      setIsRecording(true);
      setMarks([]);
      info("Recording started");
    } catch (err) {
      showError("Could not start recording", err instanceof Error ? err.message : undefined);
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setIsRecording(false);
  }

  /* ── Mark current position ──────────────────────────────────────────── */

  function markPosition() {
    if (!throwAngles) {
      showError("No pose detected", "Make sure the athlete is in frame");
      return;
    }
    const ts = isRecording ? Date.now() - recordStartRef.current : 0;
    const newMark: CaptureMark = {
      id: `mk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: ts,
      label: selectedLabel,
      angles: throwAngles,
    };
    setMarks((prev) => [...prev, newMark]);
  }

  function deleteMark(id: string) {
    setMarks((prev) => prev.filter((m) => m.id !== id));
  }

  /* ── Save recorded clip as VideoAnalysis ────────────────────────────── */

  async function handleSave() {
    if (!recordedBlob || !athleteId || !event || !title.trim()) {
      showError("Missing fields", "Athlete, event, and title are required");
      return;
    }

    setSaving(true);
    try {
      // Build a File from the blob with the right extension
      const ext = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
      const filename = `live-${Date.now()}.${ext}`;
      const file = new File([recordedBlob], filename, { type: recordedBlob.type });

      const formData = new FormData();
      formData.append("video", file);
      formData.append("athleteId", athleteId);
      formData.append("event", event);
      formData.append("title", title.trim());
      formData.append("description", "Captured live");

      const res = await fetch("/api/video-analysis/upload", {
        method: "POST",
        headers: csrfHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      // Convert ms timestamps to seconds for the saved key positions
      const positions = marks.map((m) => ({
        id: m.id,
        timestamp: m.timestamp / 1000,
        label: m.label,
        angles: m.angles,
        notes: "",
      }));

      // Save the marks via PATCH
      if (positions.length > 0) {
        await fetch(`/api/video-analysis/${data.data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ keyPositions: { positions }, status: "COMPLETED" }),
        });
      }

      success("Live capture saved");
      router.push(`/coach/video-analysis/${data.data.id}`);
    } catch (err) {
      showError("Failed to save", err instanceof Error ? err.message : "Please try again");
      setSaving(false);
    }
  }

  function discardRecording() {
    setRecordedBlob(null);
    setMarks([]);
    setTitle("");
    setEvent("");
    setAthleteId("");
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  // POST-RECORDING SAVE FORM
  if (recordedBlob) {
    const sizeMb = (recordedBlob.size / 1024 / 1024).toFixed(1);
    return (
      <div className="space-y-4 animate-spring-up max-w-2xl mx-auto">
        <nav className="flex items-center gap-1.5 text-sm text-muted">
          <Link
            href="/coach/video-analysis"
            className="hover:text-[var(--foreground)] transition-colors"
          >
            Pose Analysis
          </Link>
          <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
          <span className="text-[var(--foreground)]">Save Live Capture</span>
        </nav>

        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Save Live Capture</h1>
          <p className="text-sm text-muted mt-0.5">
            {sizeMb} MB · {marks.length} key position{marks.length !== 1 ? "s" : ""} marked
          </p>
        </div>

        {/* Preview */}
        <div className="rounded-xl overflow-hidden bg-black border border-surface-200 dark:border-surface-700">
          <video
            src={URL.createObjectURL(recordedBlob)}
            controls
            playsInline
            className="w-full max-h-80 object-contain"
          />
        </div>

        {/* Form */}
        <div className="card p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Athlete *</label>
              <select
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
                className="input mt-1"
                disabled={saving}
              >
                <option value="">Select athlete…</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.firstName} {a.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Event *</label>
              <select
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                className="input mt-1"
                disabled={saving}
              >
                <option value="">Select event…</option>
                {EVENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Practice — heavy implement set"
              className="input mt-1"
              disabled={saving}
              maxLength={200}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={discardRecording}
              disabled={saving}
              className="btn-secondary"
            >
              Discard & Re-record
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !athleteId || !event || !title.trim()}
              className="btn-primary disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={16} strokeWidth={1.75} aria-hidden="true" />
              {saving ? "Saving…" : "Save Analysis"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // LIVE CAPTURE VIEW
  return (
    <div className="space-y-4 animate-spring-up">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-muted">
        <Link
          href="/coach/video-analysis"
          className="hover:text-[var(--foreground)] transition-colors"
        >
          Pose Analysis
        </Link>
        <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
        <span className="text-[var(--foreground)]">Live Capture</span>
      </nav>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Live Capture</h1>
          <p className="text-sm text-muted mt-0.5">Real-time pose analysis from your camera</p>
        </div>
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-danger-500/15 border border-danger-500/30">
            <span className="w-2 h-2 rounded-full bg-danger-500 animate-pulse" aria-hidden="true" />
            <span className="text-sm font-mono tabular-nums text-danger-500 font-bold">
              REC {Math.floor(elapsedSec / 60)}:{(elapsedSec % 60).toString().padStart(2, "0")}
            </span>
          </div>
        )}
      </div>

      {/* Camera permission error */}
      {cameraError && (
        <div className="card p-6 border-danger-500/30 bg-danger-50">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              strokeWidth={1.75}
              className="text-danger-500 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-danger-500">Camera unavailable</p>
              <p className="text-xs text-muted">{cameraError}</p>
              <p className="text-xs text-muted">
                Make sure your browser has camera permission. On iOS, this requires HTTPS and Safari
                14+.
              </p>
              <button
                type="button"
                onClick={() => startCamera(facing)}
                className="btn-secondary text-xs mt-2"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main split: video + side panel */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Camera feed (60%) */}
        <div className="lg:w-[60%] space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-black border border-surface-200 dark:border-surface-700 aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />

            {/* Pose overlay */}
            {showOverlay && cameraReady && (
              <PoseOverlay pose={currentPose} showAngles={showAngles} />
            )}

            {/* Camera loading */}
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-white">Starting camera…</p>
                </div>
              </div>
            )}

            {/* Pose model loading */}
            {pose.loading && cameraReady && (
              <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black">
                <span className="text-xs text-white">Loading pose model…</span>
              </div>
            )}
          </div>

          {/* Controls bar */}
          <div className="card p-3">
            <div className="flex items-center justify-between gap-2">
              {/* Record / Stop */}
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={!cameraReady}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-danger-500 text-white font-semibold text-sm hover:bg-danger-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Circle size={16} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
                  Record
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-[var(--foreground)] font-semibold text-sm hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                >
                  <Square size={16} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
                  Stop
                </button>
              )}

              {/* Right-side toggles */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={flipCamera}
                  disabled={!cameraReady}
                  className="p-2.5 rounded-lg text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-40"
                  aria-label="Flip camera"
                >
                  <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>

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
                  <Ruler size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>

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
                    <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {pose.error && (
            <div className="bg-danger-50 border border-danger-500/30 rounded-lg p-3">
              <p className="text-sm text-danger-500">Pose detection error: {pose.error}</p>
            </div>
          )}
        </div>

        {/* Side panel (40%) */}
        <div className="lg:w-[40%] space-y-3">
          {/* Live angles */}
          <div className="card p-4">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">
              Live Angles
            </p>
            {!cameraReady ? (
              <p className="text-sm text-muted text-center py-6">Waiting for camera…</p>
            ) : !throwAngles ? (
              <p className="text-sm text-muted text-center py-6">
                Position the athlete in frame to see angles
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {getAnglesWithStatus(throwAngles)
                  .filter((a) =>
                    [
                      "shoulderSeparation",
                      "hipShoulderDifferential",
                      "blockLegKnee",
                      "rearLegKnee",
                      "trunkLean",
                    ].includes(a.key)
                  )
                  .map((angle) => (
                    <AngleIndicator
                      key={angle.key}
                      label={angle.label}
                      degrees={angle.degrees}
                      status={angle.status}
                    />
                  ))}
              </div>
            )}
          </div>

          {/* Mark positions */}
          <div className="card p-4 space-y-3">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
              Mark Position
            </p>
            <div className="flex flex-wrap gap-1.5">
              {POSITION_LABELS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSelectedLabel(label)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedLabel === label
                      ? "bg-primary-500/20 text-primary-500 border border-primary-500/30"
                      : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 border border-transparent"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={markPosition}
              disabled={!throwAngles}
              className="btn-primary w-full text-sm disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <MapPin size={14} strokeWidth={1.75} aria-hidden="true" />
              Mark &ldquo;{selectedLabel}&rdquo;
              {isRecording && (
                <span className="font-mono tabular-nums text-xs">
                  @ {Math.floor(elapsedSec / 60)}:{(elapsedSec % 60).toString().padStart(2, "0")}
                </span>
              )}
            </button>
            {!isRecording && marks.length === 0 && (
              <p className="text-xs text-muted text-center">
                Marks made before recording will be discarded. Hit Record first.
              </p>
            )}

            {/* Saved marks */}
            {marks.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-surface-200 dark:border-surface-700">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                  Marked ({marks.length})
                </p>
                {marks.map((m) => {
                  const sec = Math.floor(m.timestamp / 1000);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700"
                    >
                      <MapPin
                        size={12}
                        strokeWidth={1.75}
                        className="text-primary-500 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium text-[var(--foreground)] flex-1 truncate">
                        {m.label}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-muted">
                        {Math.floor(sec / 60)}:{(sec % 60).toString().padStart(2, "0")}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteMark(m.id)}
                        className="p-1 rounded hover:bg-danger-500/10 text-surface-400 hover:text-danger-500 transition-colors"
                        aria-label={`Delete ${m.label} mark`}
                      >
                        <Trash2 size={12} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="card p-4 space-y-2">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
              <VideoIcon size={10} strokeWidth={1.75} aria-hidden="true" />
              Tips
            </p>
            <ul className="text-xs text-muted space-y-1 list-disc pl-4">
              <li>Frame the athlete from the side for best biomechanics</li>
              <li>Keep the camera stable — use a tripod if possible</li>
              <li>Recording uses ~10–15% battery per 10 minutes</li>
              <li>Hit Record before marking positions to capture timestamps</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
