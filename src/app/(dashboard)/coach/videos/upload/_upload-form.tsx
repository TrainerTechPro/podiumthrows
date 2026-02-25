"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Select, type SelectOption } from "@/components/ui/Select";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatEventType } from "@/lib/utils";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  athleteOptions: SelectOption<string>[];
};

type UploadPhase =
  | "idle"
  | "selected"
  | "uploading"
  | "creating"
  | "done"
  | "error";

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

const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_SIZE_MB = 500;

/* ─── Component ───────────────────────────────────────────────────────────── */

export function UploadForm({ athleteOptions }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  // Metadata
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [event, setEvent] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  /* ── File selection ──────────────────────────────────────────────────── */

  const handleFileSelect = useCallback((selectedFile: File) => {
    // Validate type
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setErrorMsg("Invalid file type. Please use MP4, MOV, or WebM.");
      return;
    }
    // Validate size
    const sizeMb = selectedFile.size / (1024 * 1024);
    if (sizeMb > MAX_SIZE_MB) {
      setErrorMsg(`File too large (${sizeMb.toFixed(0)}MB). Maximum is ${MAX_SIZE_MB}MB.`);
      return;
    }

    setFile(selectedFile);
    setErrorMsg("");
    setPhase("selected");

    // Auto-fill title from filename
    if (!title) {
      const name = selectedFile.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      setTitle(name);
    }
  }, [title]);

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

  /* ── Upload ──────────────────────────────────────────────────────────── */

  async function handleUpload() {
    if (!file || !title.trim()) return;
    setPhase("uploading");
    setProgress(0);
    setErrorMsg("");

    try {
      // 1. Get upload URL
      const urlRes = await fetch("/api/coach/videos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSizeMb: file.size / (1024 * 1024),
        }),
      });

      if (!urlRes.ok) {
        const data = await urlRes.json();
        throw new Error(data.error ?? "Failed to get upload URL");
      }

      const { uploadUrl, key, publicUrl, mode } = await urlRes.json();

      // 2. Upload file
      abortRef.current = new AbortController();

      if (mode === "local") {
        // Local multipart upload
        const formData = new FormData();
        formData.append("file", file);
        formData.append("key", key);

        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error("Upload failed"));
          };
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.open("POST", uploadUrl);
          xhr.send(formData);
        });
      } else {
        // R2 presigned PUT
        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error("Upload failed"));
          };
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
        });
      }

      // 3. Create video record
      setPhase("creating");

      // Try to get video duration
      let durationSec: number | undefined;
      try {
        durationSec = await getVideoDuration(file);
      } catch {
        // Duration is optional
      }

      const createRes = await fetch("/api/coach/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: publicUrl,
          storageKey: key,
          title: title.trim(),
          description: description.trim() || undefined,
          athleteId: athleteId || undefined,
          event: event || undefined,
          category: category || undefined,
          durationSec,
          fileSizeMb: file.size / (1024 * 1024),
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error ?? "Failed to create video");
      }

      const { video } = await createRes.json();
      setPhase("done");

      // Navigate to the video editor
      setTimeout(() => {
        router.push(`/coach/videos/${video.id}`);
      }, 500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  }

  /* ── Cancel ──────────────────────────────────────────────────────────── */

  function handleCancel() {
    abortRef.current?.abort();
    setPhase("idle");
    setFile(null);
    setProgress(0);
    setErrorMsg("");
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  const isUploading = phase === "uploading" || phase === "creating";
  const fileSizeMb = file ? (file.size / (1024 * 1024)).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* ── Drop zone ─────────────────────────────────────────────────── */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
          file
            ? "border-primary-300 dark:border-primary-600 bg-primary-50/50 dark:bg-primary-500/5"
            : "border-surface-300 dark:border-surface-600 hover:border-primary-400 dark:hover:border-primary-500 bg-surface-50 dark:bg-surface-900"
        } ${isUploading ? "pointer-events-none" : ""}`}
      >
        <div className="flex flex-col items-center py-12 px-6">
          {file ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {file.name}
              </p>
              <p className="text-xs text-muted mt-1">{fileSizeMb} MB</p>
              {!isUploading && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPhase("idle");
                  }}
                  className="mt-2 text-xs text-red-500 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-400 flex items-center justify-center mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Drop a video file here or click to browse
              </p>
              <p className="text-xs text-muted mt-1">
                MP4, MOV, or WebM · Max {MAX_SIZE_MB}MB
              </p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {/* ── Upload progress ───────────────────────────────────────────── */}
      {isUploading && (
        <div className="space-y-2">
          <ProgressBar
            value={phase === "creating" ? 100 : progress}
            variant="primary"
            showLabel
            label={
              phase === "creating"
                ? "Creating video record…"
                : `Uploading… ${progress}%`
            }
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
                onClick={() => {
                  setPhase("selected");
                  setErrorMsg("");
                }}
                className="text-xs text-red-500 hover:underline mt-1"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Metadata form ─────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Video Details
        </h2>

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

        {/* Athlete + Event row */}
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

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleUpload}
          disabled={!file || !title.trim() || isUploading}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? "Uploading…" : "Upload & Continue"}
        </button>
        <a
          href="/coach/videos"
          className="btn-ghost text-sm"
        >
          Cancel
        </a>
      </div>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      if (isFinite(video.duration)) {
        resolve(video.duration);
      } else {
        reject(new Error("Could not determine duration"));
      }
    };
    video.onerror = () => reject(new Error("Could not load video"));
    video.src = URL.createObjectURL(file);
  });
}
