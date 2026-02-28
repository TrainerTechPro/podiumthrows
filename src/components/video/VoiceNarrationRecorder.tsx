"use client";

import { useRef, useState, useEffect, useCallback } from "react";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: (blob: Blob, durationSec: number) => void;
  className?: string;
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function VoiceNarrationRecorder({
  isRecording,
  onStartRecording,
  onStopRecording,
  className,
}: Props) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [supported, setSupported] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Feature detection ────────────────────────────────────────────── */

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
    }
  }, []);

  /* ── Start recording ──────────────────────────────────────────────── */

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const durationSec = (Date.now() - startTimeRef.current) / 1000;
        stream.getTracks().forEach((t) => t.stop());
        onStopRecording(blob, durationSec);
      };

      recorder.start(100); // collect chunks every 100ms
      onStartRecording();

      // Elapsed timer
      setElapsed(0);
      intervalRef.current = setInterval(() => {
        setElapsed((Date.now() - startTimeRef.current) / 1000);
      }, 200);
    } catch {
      setSupported(false);
    }
  }, [onStartRecording, onStopRecording]);

  /* ── Stop recording ───────────────────────────────────────────────── */

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /* ── Cleanup ──────────────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  /* ── Render ───────────────────────────────────────────────────────── */

  if (!supported) return null;

  const formatElapsed = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isRecording) {
    return (
      <div className={`flex items-center gap-2 ${className ?? ""}`}>
        {/* Pulsing red dot */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-4 h-4 rounded-full bg-red-500/30 animate-ping" />
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
        </div>

        {/* Timer */}
        <span className="text-xs font-mono tabular-nums text-red-400">
          {formatElapsed(elapsed)}
        </span>

        {/* Stop button */}
        <button
          onClick={stopRecording}
          className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          title="Stop recording"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      className={`p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors ${className ?? ""}`}
      title="Record voice narration"
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
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  );
}
