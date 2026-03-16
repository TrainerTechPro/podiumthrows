"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Select, type SelectOption } from "@/components/ui/Select";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatEventType } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  athleteOptions: SelectOption<string>[];
};

type UploadPhase =
  | "idle"
  | "trimming"   // user selects trim window + thumbnail
  | "selected"   // trim confirmed, showing metadata form
  | "uploading"
  | "creating"
  | "done"
  | "error";

const MAX_CLIP_SEC = 10;

const EVENT_OPTIONS: SelectOption<string>[] = [
  { value: "SHOT_PUT", label: formatEventType("SHOT_PUT") },
  { value: "DISCUS", label: formatEventType("DISCUS") },
  { value: "HAMMER", label: formatEventType("HAMMER") },
  { value: "JAVELIN", label: formatEventType("JAVELIN") },
];

const CATEGORY_OPTIONS: SelectOption<string>[] = [
  { value: "training", label: "Training" },
  { value: "competition", label: "Competition" },
  { value: "drill", label: "Drill" },
  { value: "analysis", label: "Analysis" },
];

const ALLOWED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/hevc",
  "video/x-m4v",
  "video/3gpp",
];
const ALLOWED_EXTS = ["mp4", "mov", "webm", "m4v", "3gp"];
const MAX_SIZE_MB = 500;

/* ─── Trim Range Slider ───────────────────────────────────────────────────── */

function TrimRangeSlider({
  duration,
  trimStart,
  onStartChange,
}: {
  duration: number;
  trimStart: number;
  onStartChange: (val: number) => void;
}) {
  const maxStart = Math.max(0, duration - MAX_CLIP_SEC);
  const trimEnd = Math.min(trimStart + MAX_CLIP_SEC, duration);
  const startPct = (trimStart / duration) * 100;
  const endPct = (trimEnd / duration) * 100;

  return (
    <div className="space-y-1">
      <div className="relative h-6 flex items-center">
        {/* Track background */}
        <div className="absolute w-full h-2 rounded-full bg-surface-200 dark:bg-surface-700" />
        {/* Selected window */}
        <div
          className="absolute h-2 rounded-full bg-primary-500/50"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />
        {/* Range input — invisible but handles interaction */}
        <input
          type="range"
          min={0}
          max={maxStart}
          step={0.1}
          value={trimStart}
          onChange={(e) => onStartChange(Number(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer h-full"
        />
        {/* Start thumb visual */}
        <div
          className="absolute w-4 h-4 rounded-full bg-primary-500 border-2 border-white shadow pointer-events-none -translate-x-1/2"
          style={{ left: `${startPct}%` }}
        />
        {/* End thumb visual */}
        <div
          className="absolute w-4 h-4 rounded-full bg-primary-400 border-2 border-white shadow pointer-events-none -translate-x-1/2"
          style={{ left: `${endPct}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function UploadForm({ athleteOptions }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  // Trim state
  const [videoDuration, setVideoDuration] = useState(0);
  const [needsTrim, setNeedsTrim] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [trimmedBlob, setTrimmedBlob] = useState<Blob | File | null>(null);
  const [trimProgress, setTrimProgress] = useState(0);
  const [isTrimming, setIsTrimming] = useState(false);
  const [mediaRecorderSupported, setMediaRecorderSupported] = useState(true);

  // Thumbnail state
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string>("");

  // Metadata
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [event, setEvent] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  /* ── Cleanup object URLs on unmount ──────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── File selection ──────────────────────────────────────────────────── */

  const handleFileSelect = useCallback((selectedFile: File) => {
    const ext = selectedFile.name.split(".").pop()?.toLowerCase() ?? "";
    if (selectedFile.type && !ALLOWED_TYPES.includes(selectedFile.type) && !ALLOWED_EXTS.includes(ext)) {
      setErrorMsg("Invalid file type. Please use MP4, MOV, or WebM.");
      return;
    }
    if (!selectedFile.type && !ALLOWED_EXTS.includes(ext)) {
      setErrorMsg("Invalid file type. Please use MP4, MOV, or WebM.");
      return;
    }
    if (selectedFile.size / (1024 * 1024) > MAX_SIZE_MB) {
      setErrorMsg(`File too large. Maximum is ${MAX_SIZE_MB}MB.`);
      return;
    }

    // Check MediaRecorder + captureStream support (captureStream not available on iOS Safari)
    const supported =
      typeof MediaRecorder !== "undefined" &&
      "captureStream" in document.createElement("video") &&
      (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ||
        MediaRecorder.isTypeSupported("video/webm") ||
        MediaRecorder.isTypeSupported("video/mp4"));
    setMediaRecorderSupported(supported);

    // Revoke previous object URL
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const url = URL.createObjectURL(selectedFile);

    setFile(selectedFile);
    setObjectUrl(url);
    setErrorMsg("");
    setTrimStart(0);
    setTrimEnd(0);
    setTrimmedBlob(null);
    setThumbnailBlob(null);
    if (thumbnailPreviewUrl) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
      setThumbnailPreviewUrl("");
    }
    setPhase("trimming");

    if (!title) {
      const name = selectedFile.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      setTitle(name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, objectUrl, thumbnailPreviewUrl]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFileSelect(dropped);
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) handleFileSelect(selected);
    },
    [handleFileSelect]
  );

  /* ── Video metadata loaded ───────────────────────────────────────────── */

  const handleVideoMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const dur = video.duration;
    if (!isFinite(dur)) return;
    setVideoDuration(dur);
    const shouldTrim = dur > MAX_CLIP_SEC;
    setNeedsTrim(shouldTrim);
    setTrimStart(0);
    setTrimEnd(shouldTrim ? MAX_CLIP_SEC : dur);
  }, []);

  /* ── Trim start change ───────────────────────────────────────────────── */

  const handleTrimStartChange = useCallback((val: number) => {
    const start = Math.max(0, Math.min(val, videoDuration - MAX_CLIP_SEC));
    const end = Math.min(start + MAX_CLIP_SEC, videoDuration);
    setTrimStart(start);
    setTrimEnd(end);
    if (videoRef.current) videoRef.current.currentTime = start;
  }, [videoDuration]);

  /* ── Thumbnail capture ───────────────────────────────────────────────── */

  const captureThumbnail = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
      const url = URL.createObjectURL(blob);
      setThumbnailBlob(blob);
      setThumbnailPreviewUrl(url);
    }, "image/jpeg", 0.85);
  }, [thumbnailPreviewUrl]);

  /* ── Trim confirm ────────────────────────────────────────────────────── */

  async function handleTrimConfirm() {
    if (!file) return;

    if (!needsTrim || !mediaRecorderSupported) {
      // No trim needed or can't trim — upload original
      setTrimmedBlob(file);
      setPhase("selected");
      return;
    }

    setIsTrimming(true);
    setTrimProgress(0);

    try {
      const blob = await trimVideo(file, trimStart, trimEnd, setTrimProgress);
      setTrimmedBlob(blob);
      setIsTrimming(false);
      setPhase("selected");
    } catch (err) {
      setIsTrimming(false);
      // If the browser doesn't support captureStream, fall back to uploading the original
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("captureStream") || msg.includes("not supported")) {
        setTrimmedBlob(file);
        setPhase("selected");
      } else {
        setErrorMsg(msg || "Trim failed");
        setPhase("error");
      }
    }
  }

  /* ── Upload ──────────────────────────────────────────────────────────── */

  async function handleUpload() {
    if (!trimmedBlob || !file || !title.trim()) return;
    setPhase("uploading");
    setProgress(0);
    setErrorMsg("");

    let videoId: string | null = null;

    try {
      // 1. Request presigned URLs for video + thumbnail in parallel
      const [urlRes, thumbRes] = await Promise.all([
        fetch("/api/coach/videos/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || "video/mp4",
            fileSizeMb: trimmedBlob.size / (1024 * 1024),
          }),
        }),
        thumbnailBlob
          ? fetch("/api/coach/videos/upload-thumbnail-url", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...csrfHeaders() },
              body: JSON.stringify({ fileName: "thumbnail.jpg", contentType: "image/jpeg" }),
            })
          : Promise.resolve(null),
      ]);

      if (!urlRes.ok) {
        const data = await urlRes.json();
        throw new Error(data.error ?? "Failed to get upload URL");
      }

      const { uploadUrl, key, publicUrl, mode } = await urlRes.json();

      // 2. Upload thumbnail (non-blocking, non-fatal)
      let thumbnailPublicUrl: string | undefined;
      if (thumbRes?.ok && thumbnailBlob) {
        try {
          const thumbData = await thumbRes.json();
          const { uploadUrl: thumbUrl, key: thumbKey, publicUrl: thumbPublicUrl, mode: thumbMode } = thumbData;

          if (thumbMode === "local") {
            const fd = new FormData();
            fd.append("file", thumbnailBlob, "thumbnail.jpg");
            fd.append("key", thumbKey);
            await fetch("/api/coach/videos/upload-thumbnail-local", { method: "POST", headers: csrfHeaders(), body: fd });
            thumbnailPublicUrl = thumbPublicUrl;
          } else {
            const thumbXhrOk = await new Promise<boolean>((resolve) => {
              const xhr = new XMLHttpRequest();
              xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
              xhr.onerror = () => resolve(false);
              xhr.open("PUT", thumbUrl);
              xhr.send(thumbnailBlob);
            });
            if (thumbXhrOk) thumbnailPublicUrl = thumbPublicUrl;
          }
        } catch {
          console.warn("[Upload] Thumbnail upload failed — continuing without thumbnail");
        }
      }

      // 3. Create DB record BEFORE uploading — status: "uploading"
      //    This gives us a video ID to track and lets the UI show progress.
      setPhase("creating");
      const durationSec = needsTrim ? trimEnd - trimStart : videoDuration || undefined;

      const createRes = await fetch("/api/coach/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          url: publicUrl,
          storageKey: key,
          title: title.trim(),
          description: description.trim() || undefined,
          athleteId: athleteId || undefined,
          event: event || undefined,
          category: category || undefined,
          durationSec,
          fileSizeMb: trimmedBlob.size / (1024 * 1024),
          thumbnailUrl: thumbnailPublicUrl,
          status: "uploading",
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error ?? "Failed to create video record");
      }

      const { video } = await createRes.json();
      videoId = video.id;

      // 4. Upload video blob directly to R2 (or local)
      setPhase("uploading");
      abortRef.current = new AbortController();

      if (mode === "local") {
        const ext = file.name.split(".").pop() ?? "mp4";
        const formData = new FormData();
        formData.append("file", trimmedBlob, `trimmed.${ext}`);
        formData.append("key", key);

        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else {
              let msg = `Upload failed (${xhr.status})`;
              try { msg = JSON.parse(xhr.responseText)?.error ?? msg; } catch { /* ignore */ }
              reject(new Error(msg));
            }
          };
          xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
          xhr.open("POST", uploadUrl);
          xhr.send(formData);
        });
      } else {
        // R2 presigned PUT — no Content-Type header (iOS-safe)
        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed (${xhr.status})`));
          };
          xhr.onerror = () => {
            console.error("[Upload] XHR onerror — uploadUrl:", uploadUrl);
            reject(new Error("Upload failed — CORS or network error. Check browser console."));
          };
          xhr.open("PUT", uploadUrl);
          xhr.send(trimmedBlob);
        });
      }

      // 5. Upload complete → transition to "processing"
      //    External services (Inngest, Trigger.dev, etc.) can pick up
      //    videos with status "processing" for transcoding, thumbnail
      //    generation, or other post-processing work.
      await fetch(`/api/coach/videos/${videoId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ status: "processing" }),
      });

      setPhase("done");
      setTimeout(() => router.push(`/coach/videos/${videoId}`), 500);
    } catch (err) {
      // If we created a record, mark it as failed
      if (videoId) {
        fetch(`/api/coach/videos/${videoId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ status: "failed" }),
        }).catch(() => {/* best-effort */});
      }
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  }

  /* ── Cancel ──────────────────────────────────────────────────────────── */

  function handleCancel() {
    abortRef.current?.abort();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    setPhase("idle");
    setFile(null);
    setObjectUrl("");
    setTrimmedBlob(null);
    setThumbnailBlob(null);
    setThumbnailPreviewUrl("");
    setProgress(0);
    setTrimProgress(0);
    setIsTrimming(false);
    setErrorMsg("");
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  const isUploading = phase === "uploading" || phase === "creating";
  const showMetadata = phase === "selected" || isUploading || phase === "done" || phase === "error";

  return (
    <div className="space-y-6">
      {/* ── Drop zone ─────────────────────────────────────────────────── */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !file && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl transition-colors ${
          file
            ? "border-primary-300 dark:border-primary-600 bg-primary-50/50 dark:bg-primary-500/5"
            : "border-surface-300 dark:border-surface-600 hover:border-primary-400 dark:hover:border-primary-500 bg-surface-50 dark:bg-surface-900 cursor-pointer"
        } ${isUploading ? "pointer-events-none" : ""}`}
      >
        <div className="flex flex-col items-center py-10 px-6">
          {file ? (
            <>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500 mb-3">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <p className="text-sm font-medium text-[var(--foreground)]">{file.name}</p>
              <p className="text-xs text-muted mt-1">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
              {!isUploading && phase !== "trimming" && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleCancel(); }}
                  className="mt-2 text-xs text-red-500 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </>
          ) : (
            <>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-surface-400 dark:text-surface-500 mb-3">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Drop a video here or click to browse
              </p>
              <p className="text-xs text-muted mt-1">
                MP4, MOV, or WebM · Max {MAX_SIZE_MB}MB · 10 second clips
              </p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {/* ── Trim + Thumbnail panel ─────────────────────────────────────── */}
      {phase === "trimming" && objectUrl && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Clip &amp; Thumbnail
            </h2>
            {videoDuration > 0 && (
              <span className="text-xs text-muted tabular-nums">
                {videoDuration.toFixed(1)}s total
              </span>
            )}
          </div>

          {/* Video preview */}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={objectUrl}
              onLoadedMetadata={handleVideoMetadata}
              className="w-full h-full object-contain"
              playsInline
              controls
              preload="metadata"
            />
          </div>

          {/* Hidden canvas for thumbnail capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Trim slider — only if video needs trimming */}
          {needsTrim && !isTrimming && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--foreground)]">
                  Select 10-second clip
                </label>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Max 10s required
                </span>
              </div>
              <TrimRangeSlider
                duration={videoDuration}
                trimStart={trimStart}
                onStartChange={handleTrimStartChange}
              />
              <div className="flex justify-between text-xs text-muted tabular-nums">
                <span>Start: {trimStart.toFixed(1)}s</span>
                <span>End: {trimEnd.toFixed(1)}s</span>
                <span className="text-primary-600 dark:text-primary-400 font-medium">
                  {(trimEnd - trimStart).toFixed(1)}s clip
                </span>
              </div>
            </div>
          )}

          {/* Trim progress */}
          {isTrimming && (
            <ProgressBar
              value={trimProgress}
              variant="primary"
              showLabel
              label={`Trimming clip… ${Math.round(trimProgress)}%`}
              size="md"
              animate
            />
          )}

          {/* MediaRecorder not supported warning */}
          {needsTrim && !mediaRecorderSupported && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Your browser does not support video trimming. The full video will be uploaded.
              </p>
            </div>
          )}

          {/* Thumbnail capture */}
          {!isTrimming && (
            <div className="flex items-center gap-3 pt-1 border-t border-surface-100 dark:border-surface-800">
              <p className="text-xs text-muted flex-1">
                Scrub the video to any frame, then capture it as the thumbnail.
              </p>
              <button
                type="button"
                onClick={captureThumbnail}
                className="btn-secondary text-xs py-1.5 px-3 shrink-0"
              >
                Capture Thumbnail
              </button>
              {thumbnailPreviewUrl && (
                <div className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbnailPreviewUrl}
                    alt="Thumbnail preview"
                    className="w-16 h-10 object-cover rounded border border-surface-200 dark:border-surface-700"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(thumbnailPreviewUrl);
                      setThumbnailPreviewUrl("");
                      setThumbnailBlob(null);
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"
                    aria-label="Remove thumbnail"
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {!isTrimming && (
            <div className="flex items-center gap-3 pt-2 border-t border-surface-100 dark:border-surface-800">
              <button
                type="button"
                onClick={handleTrimConfirm}
                className="btn-primary"
              >
                {needsTrim ? "Trim & Continue" : "Continue"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
              {!needsTrim && (
                <span className="text-xs text-muted ml-auto">
                  Video is already ≤ 10s — no trim needed
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Upload progress ───────────────────────────────────────────── */}
      {isUploading && (
        <div className="space-y-2">
          <ProgressBar
            value={phase === "creating" ? 100 : progress}
            variant="primary"
            showLabel
            label={phase === "creating" ? "Saving video…" : `Uploading… ${progress}%`}
            size="md"
            animate
          />
          <button
            onClick={handleCancel}
            className="text-xs text-muted hover:text-red-500 transition-colors"
          >
            Cancel upload
          </button>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 shrink-0 mt-0.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="text-sm text-red-700 dark:text-red-300">{errorMsg}</p>
            {phase === "error" && (
              <button
                onClick={() => { setPhase("selected"); setErrorMsg(""); }}
                className="text-xs text-red-500 hover:underline mt-1"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Metadata form — shown after trim is confirmed ─────────────── */}
      {showMetadata && (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Video Details</h2>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[var(--foreground)] mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. John — Shot Put Full Turn Analysis"
              className="input w-full"
              disabled={isUploading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[var(--foreground)] mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this video…"
              rows={3}
              className="input w-full resize-none"
              disabled={isUploading}
            />
          </div>

          {/* Athlete + Event */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Athlete"
              options={athleteOptions}
              value={athleteId}
              onChange={setAthleteId}
              placeholder="Select athlete…"
              searchable
              clearable
              disabled={isUploading}
            />
            <Select
              label="Event"
              options={EVENT_OPTIONS}
              value={event}
              onChange={setEvent}
              placeholder="Select event…"
              clearable
              disabled={isUploading}
            />
          </div>

          {/* Category */}
          <Select
            label="Category"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={setCategory}
            placeholder="Select category…"
            clearable
            disabled={isUploading}
          />
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────────────── */}
      {showMetadata && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleUpload}
            disabled={!trimmedBlob || !title.trim() || isUploading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? "Uploading…" : "Upload & Continue"}
          </button>
          <a href="/coach/videos" className="btn-ghost text-sm">
            Cancel
          </a>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

/**
 * Trim a video file client-side using MediaRecorder + captureStream.
 * Works on iOS 14.3+ (outputs video/mp4) and desktop (outputs video/webm).
 * The video plays in real time during recording (~10s for a 10s clip).
 */
function trimVideo(
  file: File,
  startSec: number,
  endSec: number,
  onProgress: (pct: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const clipDuration = endSec - startSec;
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const srcUrl = URL.createObjectURL(file);

    // Pick best supported MIME type
    const mimeType =
      MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"
        : "";

    if (!mimeType) {
      URL.revokeObjectURL(srcUrl);
      reject(new Error("No supported MediaRecorder format found in this browser"));
      return;
    }

    const chunks: BlobPart[] = [];
    let recorder: MediaRecorder;
    let startedAt = 0;
    let stopTimeout: ReturnType<typeof setTimeout>;

    video.oncanplay = () => {
      video.currentTime = startSec;
    };

    video.onseeked = () => {
      if (recorder) return; // Already started — ignore duplicate seeks
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stream: MediaStream = (video as any).captureStream?.() ?? (video as any).mozCaptureStream?.();
        if (!stream) {
          URL.revokeObjectURL(srcUrl);
          reject(new Error("captureStream() not supported in this browser"));
          return;
        }

        recorder = new MediaRecorder(stream, { mimeType });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
          const elapsed = performance.now() - startedAt;
          onProgress(Math.min(95, (elapsed / (clipDuration * 1000)) * 100));
        };

        recorder.onstop = () => {
          clearTimeout(stopTimeout);
          URL.revokeObjectURL(srcUrl);
          onProgress(100);
          resolve(new Blob(chunks, { type: mimeType }));
        };

        recorder.onerror = () => {
          clearTimeout(stopTimeout);
          URL.revokeObjectURL(srcUrl);
          reject(new Error("MediaRecorder error during trim"));
        };

        recorder.start(200); // chunk every 200ms
        startedAt = performance.now();

        video.play().catch((err) => {
          recorder.stop();
          URL.revokeObjectURL(srcUrl);
          reject(err);
        });

        // Stop recording after clipDuration + small buffer
        stopTimeout = setTimeout(() => {
          if (recorder.state !== "inactive") {
            video.pause();
            recorder.stop();
          }
        }, clipDuration * 1000 + 200);
      } catch (err) {
        URL.revokeObjectURL(srcUrl);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(srcUrl);
      reject(new Error("Could not load video for trimming"));
    };

    video.src = srcUrl;
    video.load();
  });
}
