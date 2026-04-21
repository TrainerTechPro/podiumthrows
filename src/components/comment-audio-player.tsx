"use client";

/**
 * CommentAudioPlayer — minimal inline player for 30-second voice notes
 * embedded in a CommentThread bubble. Play/pause, progress bar, elapsed/
 * total time. Uses a single shared <audio> under the hood so tapping a new
 * clip pauses the previous one naturally (browser default).
 */

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

interface Props {
  src: string;
  /** Known duration in seconds. If omitted, read from loadedmetadata. */
  durationSec?: number;
}

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function CommentAudioPlayer({ src, durationSec }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState<number>(durationSec ?? 0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setElapsed(el.currentTime);
    const onLoaded = () => {
      if (!durationSec && Number.isFinite(el.duration)) setTotal(el.duration);
    };
    const onEnded = () => {
      setPlaying(false);
      setElapsed(0);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("ended", onEnded);
    };
  }, [durationSec]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  const pct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;

  return (
    <div className="inline-flex items-center gap-2 bg-surface-200/50 dark:bg-surface-900/50 rounded-full pl-1 pr-3 py-1 min-w-[180px]">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-500 text-black flex items-center justify-center hover:bg-primary-400 transition-colors"
      >
        {playing ? (
          <Pause size={14} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Play size={14} strokeWidth={1.75} aria-hidden="true" className="ml-0.5" />
        )}
      </button>
      <div className="flex-1 h-1 bg-surface-300 dark:bg-surface-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono tabular-nums text-muted flex-shrink-0">
        {fmt(playing || elapsed > 0 ? elapsed : total)}
      </span>
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}
