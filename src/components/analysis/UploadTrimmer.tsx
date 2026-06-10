"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, UploadCloud } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { postForm, postJson } from "@/lib/api-client";
import type { AnalysisEvent } from "@/lib/contracts";

/**
 * F2 upload pipeline: validation (resolution ≥ 720p, duration, fps notes),
 * throw trim window (≤ 15 s — extraction happens server-side on the window),
 * resumable multipart upload (per-part retry; D3), then job registration.
 */

const MAX_TRIM_S = 15;
const PART_SIZE = 8 * 1024 * 1024;
const PART_RETRIES = 3;

interface AthleteOption {
  id: string;
  firstName: string;
  lastName: string;
}

type Phase = "idle" | "uploading" | "registering";

export function UploadTrimmer({
  athletes,
  calibrationSessionId,
}: {
  athletes: AthleteOption[];
  calibrationSessionId?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ duration: number; width: number; height: number } | null>(null);
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? "");
  const [event, setEvent] = useState<AnalysisEvent>("SHOT_PUT");
  const [trim, setTrim] = useState<[number, number]>([0, MAX_TRIM_S]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);

  const needsTrim = (meta?.duration ?? 0) > MAX_TRIM_S;
  const trimLen = trim[1] - trim[0];

  const validationError = useMemo(() => {
    if (!meta) return null;
    if (Math.min(meta.width, meta.height) < 720) {
      return "Resolution too low — film at 720p or higher.";
    }
    if (meta.duration < 1) return "Clip is too short.";
    if (needsTrim && trimLen > MAX_TRIM_S) {
      return `Select a single throw (max ${MAX_TRIM_S}s).`;
    }
    return null;
  }, [meta, needsTrim, trimLen]);

  const onFile = useCallback((f: File) => {
    setFile(f);
    setMeta(null);
    const url = URL.createObjectURL(f);
    setVideoUrl(url);
  }, []);

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setMeta({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
    setTrim([0, Math.min(v.duration, MAX_TRIM_S)]);
  }, []);

  const uploadClip = useCallback(async (): Promise<string | null> => {
    if (!file) return null;
    const init = await postJson("/api/analysis/uploads", {
      action: "init",
      fileName: file.name,
      contentType: file.type || "video/mp4",
    });
    // Dev fallback: storage not configured → single-shot form upload.
    if (init.res.status === 503) {
      const form = new FormData();
      form.append("file", file);
      const { res, payload } = await postForm("/api/analysis/uploads", form);
      if (!res.ok || !payload.success) throw new Error(payload.error || "Upload failed");
      return payload.data.key;
    }
    if (!init.res.ok || !init.payload.success) {
      throw new Error(init.payload.error || "Upload init failed");
    }
    const { key, uploadId } = init.payload.data;

    const partCount = Math.ceil(file.size / PART_SIZE);
    const parts: Array<{ PartNumber: number; ETag: string }> = [];
    try {
      for (let i = 0; i < partCount; i++) {
        const blob = file.slice(i * PART_SIZE, Math.min(file.size, (i + 1) * PART_SIZE));
        let lastError: unknown = null;
        let etag: string | null = null;
        // Resumable: each part retries independently; a flaky connection
        // re-sends one 8MB part, never the whole clip.
        for (let attempt = 0; attempt < PART_RETRIES && !etag; attempt++) {
          try {
            const sign = await postJson("/api/analysis/uploads", {
              action: "sign-part",
              key,
              uploadId,
              partNumber: i + 1,
            });
            if (!sign.res.ok || !sign.payload.success) throw new Error(sign.payload.error);
            const put = await fetch(sign.payload.data.url, { method: "PUT", body: blob });
            if (!put.ok) throw new Error(`part ${i + 1} failed (${put.status})`);
            etag = put.headers.get("ETag") ?? put.headers.get("etag");
            if (!etag) throw new Error("no ETag on part response");
          } catch (err) {
            lastError = err;
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          }
        }
        if (!etag) throw lastError instanceof Error ? lastError : new Error("part upload failed");
        parts.push({ PartNumber: i + 1, ETag: etag });
        setProgress(Math.round(((i + 1) / partCount) * 100));
      }
      const done = await postJson("/api/analysis/uploads", {
        action: "complete",
        key,
        uploadId,
        parts,
      });
      if (!done.res.ok || !done.payload.success) throw new Error(done.payload.error);
      return key;
    } catch (err) {
      await postJson("/api/analysis/uploads", { action: "abort", key, uploadId }).catch(() => {
        /* abort is best-effort; the bucket lifecycle reaps orphans */
      });
      throw err;
    }
  }, [file]);

  const submit = useCallback(async () => {
    if (!file || !athleteId || validationError) return;
    try {
      setPhase("uploading");
      setProgress(0);
      const clipPath = await uploadClip();
      if (!clipPath) throw new Error("Upload failed");

      setPhase("registering");
      const { res, payload } = await postJson("/api/analysis/jobs", {
        athleteId,
        event,
        clipPath,
        calibrationSessionId: calibrationSessionId ?? null,
        trimStartS: needsTrim ? trim[0] : null,
        trimEndS: needsTrim ? trim[1] : null,
      });
      if (!res.ok || !payload.success) {
        toast.error(payload.error || `Request failed (${res.status})`);
        setPhase("idle");
        return;
      }
      toast.success("Analysis started");
      router.push(`/coach/video-analysis-2/${payload.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed — please try again");
      setPhase("idle");
    }
  }, [file, athleteId, validationError, uploadClip, event, calibrationSessionId, needsTrim, trim, toast, router]);

  return (
    <div className="card max-w-xl space-y-4 p-5" data-testid="upload-trimmer">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-sm font-semibold uppercase tracking-wider text-muted">Athlete</span>
          <select
            className="input w-full"
            value={athleteId}
            onChange={(e) => setAthleteId(e.target.value)}
          >
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName} {a.lastName}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-semibold uppercase tracking-wider text-muted">Event</span>
          <select
            className="input w-full"
            value={event}
            onChange={(e) => setEvent(e.target.value as AnalysisEvent)}
          >
            <option value="SHOT_PUT">Shot put</option>
            <option value="DISCUS">Discus</option>
            <option value="HAMMER">Hammer</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-semibold uppercase tracking-wider text-muted">Clip</span>
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="mt-1 block w-full text-body"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </label>

      {videoUrl && (
        <div className="space-y-2">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full rounded-lg bg-surface-950"
            controls
            playsInline
            muted
            onLoadedMetadata={onLoadedMetadata}
          />
          {meta && (
            <p className="font-mono text-caption tabular-nums text-muted">
              {meta.width}×{meta.height} · {meta.duration.toFixed(1)}s
              {meta.duration > 0 && meta.duration < 60 ? "" : ""}
            </p>
          )}
          {meta && needsTrim && (
            <div className="space-y-1" data-testid="trim-controls">
              <p className="text-caption text-muted">
                Select the throw ({trimLen.toFixed(1)}s of max {MAX_TRIM_S}s):
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, meta.duration - 1)}
                  step={0.1}
                  value={trim[0]}
                  aria-label="Throw start"
                  onChange={(e) => {
                    const start = Number(e.target.value);
                    setTrim([start, Math.min(meta.duration, start + Math.min(trimLen, MAX_TRIM_S))]);
                    if (videoRef.current) videoRef.current.currentTime = start;
                  }}
                  className="w-full accent-primary-500"
                />
                <input
                  type="range"
                  min={trim[0] + 0.5}
                  max={Math.min(meta.duration, trim[0] + MAX_TRIM_S)}
                  step={0.1}
                  value={trim[1]}
                  aria-label="Throw end"
                  onChange={(e) => setTrim([trim[0], Number(e.target.value)])}
                  className="w-full accent-primary-500"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {validationError && (
        <p className="text-caption text-status-danger-fg" data-testid="upload-validation-error">
          {validationError}
        </p>
      )}
      {meta && !validationError && (
        <p className="text-caption text-muted">
          True frame rate is read from the file on the server — 240fps slo-mo
          is detected automatically. Below 60fps release timing gets coarser.
        </p>
      )}

      <button
        type="button"
        className="btn-primary w-full"
        disabled={!file || !meta || !!validationError || phase !== "idle" || !athleteId}
        onClick={submit}
        data-testid="start-analysis"
      >
        {phase === "idle" && (
          <>
            <UploadCloud className="mr-1 inline h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Upload & analyze
          </>
        )}
        {phase === "uploading" && (
          <>
            <Film className="mr-1 inline h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Uploading… {progress}%
          </>
        )}
        {phase === "registering" && "Starting analysis…"}
      </button>
    </div>
  );
}
