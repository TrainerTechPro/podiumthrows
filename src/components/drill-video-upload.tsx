"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface DrillVideoData {
  title: string;
  drillType: string;
  event: string;
  notes: string;
}

interface DrillVideoUploadProps {
  onClose: () => void;
  onUploadComplete: () => void;
  /** Optional athleteId — when set, coach is uploading on behalf of an athlete */
  athleteId?: string;
}

const MAX_TRIM_SECONDS = 10;

const DRILL_TYPES = [
  { value: "STANDING", label: "Standing Throw" },
  { value: "POWER_POSITION", label: "Power Position" },
  { value: "HALF_TURN", label: "Half Turn" },
  { value: "SOUTH_AFRICAN", label: "South African Drill" },
  { value: "GLIDE", label: "Glide" },
  { value: "SPIN", label: "Spin / Rotational" },
  { value: "FULL_THROW", label: "Full Throw" },
  { value: "OTHER", label: "Other" },
];

const EVENTS = [
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer Throw" },
  { value: "JAVELIN", label: "Javelin" },
  { value: "OTHER", label: "Other / General" },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

export default function DrillVideoUpload({
  onClose,
  onUploadComplete,
  athleteId,
}: DrillVideoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const [title, setTitle] = useState("");
  const [drillType, setDrillType] = useState("");
  const [event, setEvent] = useState("");
  const [notes, setNotes] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [trimError, setTrimError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const trimmedDuration = trimEnd - trimStart;
  const trimExceedsMax = trimmedDuration > MAX_TRIM_SECONDS + 0.05;

  // Validate trim whenever it changes
  useEffect(() => {
    if (duration !== null && trimmedDuration > MAX_TRIM_SECONDS + 0.05) {
      setTrimError(`Clip must be ${MAX_TRIM_SECONDS} seconds or less. Currently ${trimmedDuration.toFixed(1)}s — adjust the handles.`);
    } else {
      setTrimError("");
    }
  }, [trimStart, trimEnd, duration, trimmedDuration]);

  function handleFileSelect(selectedFile: File) {
    const validTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo", "video/x-matroska", "video/x-m4v", "video/3gpp"];
    const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "";
    const validExts = ["mp4", "mov", "webm", "avi", "mkv", "m4v", "3gp", "hevc"];
    if (!validTypes.includes(selectedFile.type) && !validExts.includes(ext)) {
      setError("Unsupported format. Use MP4, MOV, WebM, or AVI.");
      return;
    }
    if (selectedFile.size > 500 * 1024 * 1024) {
      setError("File size must be under 500MB.");
      return;
    }
    setError("");
    setFile(selectedFile);
    if (!title) setTitle(selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "));
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  function handleVideoMetadata() {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration;
    setDuration(d);
    const end = Math.min(d, MAX_TRIM_SECONDS);
    setTrimStart(0);
    setTrimEnd(end);
  }

  const startScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, handle: "start" | "end") => {
      e.preventDefault();
      if (!duration) return;
      setIsScrubbing(true);
      const bar = (e.currentTarget as HTMLDivElement).parentElement!;
      const rect = bar.getBoundingClientRect();

      const update = (clientX: number) => {
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const t = pct * duration;
        if (handle === "start") {
          const newStart = Math.max(0, Math.min(t, trimEnd - 0.5));
          setTrimStart(newStart);
          if (videoRef.current) videoRef.current.currentTime = newStart;
        } else {
          const newEnd = Math.max(trimStart + 0.5, Math.min(t, duration));
          setTrimEnd(newEnd);
          if (videoRef.current) videoRef.current.currentTime = newEnd;
        }
      };

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const x = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
        update(x);
      };
      const onUp = () => {
        setIsScrubbing(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove);
      window.addEventListener("touchend", onUp);
    },
    [duration, trimStart, trimEnd]
  );

  /**
   * Extract the selected segment using MediaRecorder (real-time capture).
   * Returns a Blob of the trimmed video.
   */
  function extractSegment(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video || !previewUrl) return reject(new Error("No video"));

      const stream = (video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }).captureStream?.() ||
        (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.();

      if (!stream) {
        // Fallback: just use the original file slice (no real trimming but preserves metadata)
        resolve(file!);
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
      recorder.onerror = (e) => reject(e);

      video.currentTime = trimStart;

      video.onseeked = () => {
        video.onseeked = null;
        recorder.start(100);
        video.play().catch(() => {});

        const stopAt = trimEnd;
        const checkTime = () => {
          if (video.currentTime >= stopAt) {
            video.pause();
            recorder.stop();
          } else {
            requestAnimationFrame(checkTime);
          }
        };
        checkTime();
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Please select a video file."); return; }
    if (!title.trim()) { setError("Please enter a title."); return; }
    if (!drillType) { setError("Please select a drill type."); return; }
    if (!event) { setError("Please select an event."); return; }
    if (trimExceedsMax) { setError(`Trim the clip to ${MAX_TRIM_SECONDS} seconds or less before uploading.`); return; }

    setUploading(true);
    setError("");
    setUploadProgress(5);

    try {
      // Extract the trimmed segment
      let uploadBlob: Blob = file;
      if (duration !== null && (trimStart > 0 || trimEnd < duration - 0.1)) {
        setUploadProgress(10);
        try {
          uploadBlob = await extractSegment();
        } catch {
          // If extraction fails, upload the original and let server handle it
          uploadBlob = file;
        }
      }

      setUploadProgress(20);

      // Build form data
      const formData = new FormData();
      formData.append("video", uploadBlob, file.name);
      formData.append("title", title.trim());
      formData.append("drillType", drillType);
      formData.append("event", event);
      formData.append("notes", notes.trim());
      formData.append("trimStart", String(trimStart));
      formData.append("trimEnd", String(trimEnd));
      formData.append("duration", String(trimmedDuration));
      if (athleteId) formData.append("athleteId", athleteId);

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = 20 + Math.round((ev.loaded / ev.total) * 75);
          setUploadProgress(pct);
        }
      };

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resp = JSON.parse(xhr.responseText);
              if (resp.success) resolve();
              else reject(new Error(resp.error || "Upload failed"));
            } catch {
              reject(new Error("Invalid server response"));
            }
          } else {
            reject(new Error(`Server error: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("POST", "/api/drill-videos");
        xhr.send(formData);
      });

      setUploadProgress(100);
      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // suppress unused warning for isScrubbing (used implicitly by pointer-events)
  void isScrubbing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-surface rounded-2xl shadow-2xl w-full max-w-lg my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Drill PR Video</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Max {MAX_TRIM_SECONDS} seconds · Trim required for longer clips</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* File drop zone */}
          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 h-36 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                dragOver
                  ? "border-primary-400 bg-primary-50 dark:bg-primary-900/10"
                  : "border-gray-300 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600"
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-surface-800 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.88v6.24a1 1 0 01-1.447.888L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop video here or click to browse</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">MP4, MOV, WebM — up to 500MB</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Video preview */}
              {previewUrl && (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  <video
                    ref={videoRef}
                    src={previewUrl}
                    className="w-full h-full object-contain"
                    onLoadedMetadata={handleVideoMetadata}
                    controls={false}
                    playsInline
                    muted
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    {duration !== null && (
                      <span className="px-2 py-0.5 rounded-md bg-black/60 text-white text-xs font-mono">
                        {formatTime(duration)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setFile(null); setPreviewUrl(null); setDuration(null); setTrimStart(0); setTrimEnd(0); }}
                      className="px-2 py-0.5 rounded-md bg-red-500/80 hover:bg-red-600/90 text-white text-xs font-medium transition-colors"
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}

              {/* Trim controls */}
              {duration !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Trim Clip</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-medium ${trimExceedsMax ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                        {trimmedDuration.toFixed(1)}s
                      </span>
                      <span className="text-xs text-gray-400">/ {MAX_TRIM_SECONDS}s max</span>
                    </div>
                  </div>

                  {/* Scrubber bar */}
                  <div className="relative h-10 bg-gray-200 dark:bg-surface-800 rounded-lg select-none overflow-visible">
                    {/* Active trim region */}
                    <div
                      className={`absolute top-0 h-full rounded-lg transition-colors ${trimExceedsMax ? "bg-red-200 dark:bg-red-900/40" : "bg-primary-200 dark:bg-primary-900/40"}`}
                      style={{
                        left: `${(trimStart / duration) * 100}%`,
                        width: `${((trimEnd - trimStart) / duration) * 100}%`,
                      }}
                    />

                    {/* Start handle */}
                    <div
                      className="absolute top-0 h-full w-4 -ml-2 flex items-center justify-center cursor-ew-resize z-10"
                      style={{ left: `${(trimStart / duration) * 100}%` }}
                      onMouseDown={(e) => startScrub(e, "start")}
                      onTouchStart={(e) => startScrub(e, "start")}
                    >
                      <div className="w-3 h-8 rounded bg-primary-500 dark:bg-primary-400 shadow flex items-center justify-center">
                        <div className="w-0.5 h-4 bg-white/70 rounded" />
                      </div>
                    </div>

                    {/* End handle */}
                    <div
                      className="absolute top-0 h-full w-4 -ml-2 flex items-center justify-center cursor-ew-resize z-10"
                      style={{ left: `${(trimEnd / duration) * 100}%` }}
                      onMouseDown={(e) => startScrub(e, "end")}
                      onTouchStart={(e) => startScrub(e, "end")}
                    >
                      <div className="w-3 h-8 rounded bg-primary-500 dark:bg-primary-400 shadow flex items-center justify-center">
                        <div className="w-0.5 h-4 bg-white/70 rounded" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-mono">
                    <span>IN {formatTime(trimStart)}</span>
                    <span>OUT {formatTime(trimEnd)}</span>
                  </div>

                  {trimError && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-xs text-red-600 dark:text-red-400">{trimError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Metadata fields */}
          <div>
            <label className="label">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Standing Throw PR — 18.2m"
              className="input"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Drill Type</label>
              <select value={drillType} onChange={(e) => setDrillType(e.target.value)} className="input" required>
                <option value="">Select drill...</option>
                {DRILL_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Event</label>
              <select value={event} onChange={(e) => setEvent(e.target.value)} className="input" required>
                <option value="">Select event...</option>
                {EVENTS.map((ev) => (
                  <option key={ev.value} value={ev.value}>{ev.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Distance, implement weight, technique cues..."
              rows={2}
              className="input resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Upload progress */}
          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-surface-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-surface-800 hover:bg-gray-200 dark:hover:bg-surface-700 text-gray-600 dark:text-gray-300 font-medium text-sm transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file || trimExceedsMax}
              className="flex-1 btn-primary disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Upload Video"}
            </button>
          </div>
        </form>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
