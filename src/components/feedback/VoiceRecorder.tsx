"use client";

/**
 * VoiceRecorder — MediaRecorder-based voice note capture component.
 *
 * Records audio up to MAX_DURATION_SEC, shows a live countdown and
 * level meter while recording, lets the user preview/playback before
 * confirming, and on confirm uploads the blob to R2 via the presigned
 * URL flow. Calls onUploaded with the resulting publicUrl and duration.
 *
 * Intended for reuse by both the coach feedback composer and athlete
 * voice-comment controls.
 *
 * Lifecycle:
 *   idle → recording → recorded → [previewing ⇄] → uploading → done
 *                                      ↓ discard
 *                                     idle
 *
 * Platform notes:
 *   - MIME type: prefers audio/webm, falls back to audio/mp4 (Safari).
 *     The mime is picked from the first supported type in PREFERRED_MIMES.
 *   - Level meter uses Web Audio API's AnalyserNode. Stops cleanly
 *     on unmount even if the stream is still open.
 *   - prefers-reduced-motion disables the pulsing record ring.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Pause, Trash2, Check } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";

export type VoiceRecorderResult = {
  publicUrl: string;
  durationSec: number;
};

export type VoiceRecorderProps = {
  onUploaded: (result: VoiceRecorderResult) => void;
  onCancel?: () => void;
  maxDurationSec?: number;
  /** Class applied to the root card. */
  className?: string;
};

const DEFAULT_MAX_DURATION = 30;

const PREFERRED_MIMES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

type Phase = "idle" | "recording" | "recorded" | "uploading" | "done";

function pickSupportedMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const mime of PREFERRED_MIMES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function VoiceRecorder({
  onUploaded,
  onCancel,
  maxDurationSec = DEFAULT_MAX_DURATION,
  className,
}: VoiceRecorderProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [level, setLevel] = useState(0); // 0..1 RMS
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimestampRef = useRef<number>(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const recordedMimeRef = useRef<string>("");

  /* ─── Cleanup ─────────────────────────────────────────────────────── */

  const cleanupStreamAndAnalyser = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupStreamAndAnalyser();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // recordedUrl is intentionally not a dep — we only want final unmount cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupStreamAndAnalyser]);

  /* ─── Start recording ────────────────────────────────────────────── */

  async function startRecording() {
    setError(null);
    if (typeof MediaRecorder === "undefined") {
      setError("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Level meter via Web Audio API
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        // RMS — scale 0..1
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel(Math.min(1, rms * 3));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      // MediaRecorder
      const mimeType = pickSupportedMime();
      recordedMimeRef.current = mimeType || "audio/webm";
      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recordedMimeRef.current || "audio/webm",
        });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        setPhase("recorded");
        cleanupStreamAndAnalyser();
      };

      mr.start();
      startTimestampRef.current = Date.now();
      setPhase("recording");
      setElapsedSec(0);

      tickIntervalRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - startTimestampRef.current) / 1000);
        setElapsedSec(sec);
        if (sec >= maxDurationSec) {
          stopRecording();
        }
      }, 250);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Microphone access was denied.";
      setError(msg);
      setPhase("idle");
      cleanupStreamAndAnalyser();
    }
  }

  /* ─── Stop recording ─────────────────────────────────────────────── */

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  /* ─── Discard + restart ──────────────────────────────────────────── */

  function discard() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setPlaying(false);
    setElapsedSec(0);
    setPhase("idle");
  }

  /* ─── Playback ────────────────────────────────────────────────────── */

  function togglePlayback() {
    const el = audioElRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  }

  /* ─── Confirm + upload ───────────────────────────────────────────── */

  async function confirm() {
    if (!recordedBlob) return;
    setPhase("uploading");
    setError(null);
    try {
      // 1. Ask server for a presigned URL
      const prep = await fetch("/api/throws/comments/audio-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          contentType: recordedMimeRef.current || "audio/webm",
          sizeBytes: recordedBlob.size,
        }),
      });
      if (!prep.ok) {
        const data = await prep.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not start upload.");
      }
      const prepResponse = (await prep.json()) as {
        success: boolean;
        data: {
          uploadUrl: string;
          publicUrl: string;
          mode: "r2" | "local";
        };
      };
      const prepData = prepResponse.data;

      // 2. Upload the blob to R2 (PUT) or the local fallback (POST)
      const uploadRes =
        prepData.mode === "r2"
          ? await fetch(prepData.uploadUrl, {
              method: "PUT",
              body: recordedBlob,
            })
          : await fetch(prepData.uploadUrl, {
              method: "POST",
              headers: {
                "Content-Type": recordedMimeRef.current || "audio/webm",
                ...csrfHeaders(),
              },
              body: recordedBlob,
            });

      if (!uploadRes.ok) {
        throw new Error("Upload failed.");
      }

      // Local mode returns the public URL in its response body — prefer it
      // over the prep publicUrl which was precomputed.
      let publicUrl = prepData.publicUrl;
      if (prepData.mode === "local") {
        const localResponse = (await uploadRes.json().catch(() => ({}))) as {
          data?: { publicUrl?: string };
        };
        publicUrl = localResponse.data?.publicUrl ?? prepData.publicUrl;
      }

      setPhase("done");
      onUploaded({
        publicUrl,
        durationSec: Math.max(1, elapsedSec || 1),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setError(msg);
      setPhase("recorded");
    }
  }

  /* ─── Render ──────────────────────────────────────────────────────── */

  const remaining = Math.max(0, maxDurationSec - elapsedSec);

  return (
    <div
      className={`card p-4 space-y-3 ${className ?? ""}`.trim()}
      aria-label="Voice recorder"
    >
      {/* Hidden audio element for playback */}
      {recordedUrl && (
        <audio
          ref={audioElRef}
          src={recordedUrl}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}

      {phase === "idle" && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Voice note
            </p>
            <p className="text-xs text-muted">
              Up to {maxDurationSec} seconds.
            </p>
          </div>
          <div className="flex gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={startRecording}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs"
              aria-label="Start recording"
            >
              <Mic className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Record
            </button>
          </div>
        </div>
      )}

      {phase === "recording" && (
        <div>
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0 motion-safe:animate-pulse"
              aria-hidden="true"
            >
              <span className="h-3 w-3 rounded-full bg-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-500">
                Recording
              </p>
              <p className="text-lg font-bold font-mono tabular-nums text-[var(--foreground)]">
                {elapsedSec}s
                <span className="text-xs text-muted font-normal">
                  {" "}
                  / {maxDurationSec}s · {remaining}s left
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs"
              aria-label="Stop recording"
            >
              <Square className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Stop
            </button>
          </div>
          {/* Level meter */}
          <div
            className="mt-3 h-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden"
            aria-hidden="true"
          >
            <div
              className="h-full bg-red-500 transition-[width] duration-75"
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </div>
        </div>
      )}

      {phase === "recorded" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlayback}
              className="h-10 w-10 rounded-full bg-primary-500/15 flex items-center justify-center text-primary-500 shrink-0"
              aria-label={playing ? "Pause preview" : "Play preview"}
            >
              {playing ? (
                <Pause className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" strokeWidth={2} aria-hidden="true" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Preview
              </p>
              <p className="text-xs text-muted font-mono tabular-nums">
                {elapsedSec}s
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={discard}
              className="btn btn-secondary flex-1 text-xs inline-flex items-center justify-center gap-1.5"
              aria-label="Discard recording"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Discard
            </button>
            <button
              type="button"
              onClick={confirm}
              className="btn btn-primary flex-1 text-xs inline-flex items-center justify-center gap-1.5"
              aria-label="Send voice note"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Send
            </button>
          </div>
        </div>
      )}

      {phase === "uploading" && (
        <div className="text-sm text-muted flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary-500 animate-pulse" aria-hidden="true" />
          Uploading…
        </div>
      )}

      {phase === "done" && (
        <div className="text-sm text-emerald-500 flex items-center gap-2">
          <Check className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Sent
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
