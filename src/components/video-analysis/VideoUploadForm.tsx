"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";
import { Upload, X, Video, Check } from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────────────── */

type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
};

export type SessionOption = {
  id: string;
  label: string;
  status: string;
};

type Props = {
  athletes: Athlete[];
  /**
   * Recent sessions keyed by athlete id. When an athlete is selected, the
   * picker filters down to that athlete's sessions. Anchoring a video to its
   * session is what makes this product throws-native rather than a generic
   * video tool.
   */
  sessionsByAthlete?: Record<string, SessionOption[]>;
};

const EVENT_OPTIONS = [
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
] as const;

/* ─── Thumbnail Generation ─────────────────────────────────────────────────── */

function generateThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, video.duration / 2);
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(video.src);
          resolve(blob);
        },
        "image/jpeg",
        0.85
      );
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(null);
    };

    video.src = URL.createObjectURL(file);
  });
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export function VideoUploadForm({ athletes, sessionsByAthlete = {} }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [athleteId, setAthleteId] = useState("");
  const [event, setEvent] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sessionId, setSessionId] = useState("");
  const sessionOptions = athleteId ? (sessionsByAthlete[athleteId] ?? []) : [];

  // File state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");

  // Drag state
  const [dragOver, setDragOver] = useState(false);

  // Track ObjectURLs for cleanup on unmount
  const videoPreviewRef = useRef(videoPreview);
  const thumbnailPreviewRef = useRef(thumbnailPreview);
  videoPreviewRef.current = videoPreview;
  thumbnailPreviewRef.current = thumbnailPreview;

  useEffect(() => {
    return () => {
      if (videoPreviewRef.current) URL.revokeObjectURL(videoPreviewRef.current);
      if (thumbnailPreviewRef.current) URL.revokeObjectURL(thumbnailPreviewRef.current);
    };
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    const validTypes = ["video/mp4", "video/quicktime", "video/webm"];
    const validExts = [".mp4", ".mov", ".webm"];
    const hasValidType = validTypes.includes(file.type);
    const hasValidExt = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!hasValidType && !hasValidExt) {
      setError("Please upload a video file (MP4, MOV, or WebM)");
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      setError("Video must be under 200MB");
      return;
    }

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setError("");

    // Generate thumbnail
    const thumb = await generateThumbnail(file);
    if (thumb) {
      setThumbnailBlob(thumb);
      setThumbnailPreview(URL.createObjectURL(thumb));
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function clearFile() {
    setVideoFile(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setVideoPreview("");
    setThumbnailPreview("");
    setThumbnailBlob(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!videoFile || !athleteId || !event || !title.trim()) {
      setError("Please fill in all required fields and select a video");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError("");

    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("athleteId", athleteId);
    formData.append("event", event);
    formData.append("title", title.trim());
    if (description.trim()) formData.append("description", description.trim());
    if (sessionId) formData.append("sessionId", sessionId);
    if (thumbnailBlob) formData.append("thumbnail", thumbnailBlob, "thumbnail.jpg");

    // Use XHR for real upload progress tracking
    const xhr = new XMLHttpRequest();
    const csrf = csrfHeaders();

    xhr.upload.addEventListener("progress", (ev) => {
      if (ev.lengthComputable) {
        // Reserve last 5% for server processing
        setUploadProgress(Math.round((ev.loaded / ev.total) * 95));
      }
    });

    xhr.addEventListener("load", () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.success) {
          setUploadProgress(100);
          router.push(`/coach/video-analysis/${data.data.id}`);
        } else {
          setError(data.error || "Upload failed");
          setUploading(false);
          setUploadProgress(0);
        }
      } catch {
        setError("Upload failed — invalid response");
        setUploading(false);
        setUploadProgress(0);
      }
    });

    xhr.addEventListener("error", () => {
      setError("Upload failed — network error");
      setUploading(false);
      setUploadProgress(0);
    });

    xhr.open("POST", "/api/video-analysis/upload");
    for (const [key, value] of Object.entries(csrf)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.send(formData);
  }

  const isValid = videoFile && athleteId && event && title.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-spring-up">
      {/* Athlete & Event */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Athlete *</label>
          <select
            value={athleteId}
            onChange={(e) => {
              setAthleteId(e.target.value);
              setSessionId("");
            }}
            className="input mt-1"
            disabled={uploading}
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
            disabled={uploading}
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

      {/* Session anchor — optional, narrows by selected athlete */}
      {athleteId && sessionOptions.length > 0 && (
        <div>
          <label className="label">
            Link to session{" "}
            <span className="text-caption font-normal text-muted">
              · ties the video to the work it captures
            </span>
          </label>
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="input mt-1"
            disabled={uploading}
          >
            <option value="">No session anchor</option>
            {sessionOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Title & Description */}
      <div>
        <label className="label">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Competition throw — State Championships"
          className="input mt-1"
          disabled={uploading}
          maxLength={200}
        />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes about the throw…"
          className="input mt-1 min-h-[80px] resize-y"
          disabled={uploading}
          maxLength={2000}
        />
      </div>

      {/* Video Dropzone */}
      <div>
        <label className="label">Video *</label>
        <div
          role={!videoFile && !uploading ? "button" : undefined}
          tabIndex={!videoFile && !uploading ? 0 : undefined}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && !videoFile && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !uploading && !videoFile) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label={
            videoFile ? `Selected: ${videoFile.name}` : "Drop a video file or press Enter to browse"
          }
          className={`mt-1 border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            videoFile
              ? "border-success-500/50 bg-success-50"
              : dragOver
                ? "border-primary-400 bg-primary-500/10"
                : "border-surface-300 dark:border-surface-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-500/5 cursor-pointer"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            onChange={handleInputChange}
            className="hidden"
            disabled={uploading}
          />

          {videoFile ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Check
                  size={20}
                  strokeWidth={1.75}
                  className="text-success-500"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {videoFile.name}
                </span>
              </div>
              <p className="text-xs text-muted">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
              {!uploading && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="inline-flex items-center gap-1 text-xs text-danger-500 hover:text-danger-600 transition-colors"
                >
                  <X size={14} strokeWidth={2} aria-hidden="true" />
                  Remove
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Upload
                size={32}
                strokeWidth={1.75}
                className="mx-auto text-muted"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-muted">
                Drag & drop a video, or click to browse
              </p>
              <p className="text-xs text-muted">MP4, MOV, or WebM — up to 200MB</p>
              <p className="text-xs text-surface-500 mt-0.5">
                Best results with 720p or 1080p at 30–60fps
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Thumbnail Preview */}
      {thumbnailPreview && (
        <div>
          <label className="label">Generated Thumbnail</label>
          <div className="mt-1 w-40 aspect-video rounded-lg overflow-hidden bg-surface-900 border border-surface-200 dark:border-surface-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailPreview}
              alt="Thumbnail preview"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Video Preview */}
      {videoPreview && (
        <div className="rounded-xl overflow-hidden bg-black border border-surface-200 dark:border-surface-700">
          <video
            src={videoPreview}
            controls
            playsInline
            className="w-full max-h-64 object-contain"
          />
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Uploading…</span>
            <span className="font-medium text-[var(--foreground)] tabular-nums">
              {uploadProgress}%
            </span>
          </div>
          <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-danger-50 border border-danger-500/30 rounded-lg p-3">
          <p className="text-sm text-danger-500">{error}</p>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
          disabled={uploading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!isValid || uploading}
          className="btn-primary disabled:opacity-50 flex items-center gap-2"
        >
          {uploading ? (
            <>
              <Video size={16} strokeWidth={1.75} className="animate-pulse" aria-hidden="true" />
              Uploading…
            </>
          ) : (
            <>
              <Upload size={16} strokeWidth={1.75} aria-hidden="true" />
              Upload & Analyze
            </>
          )}
        </button>
      </div>
    </form>
  );
}
