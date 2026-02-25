"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
  type ReactNode,
} from "react";
import { PLAYBACK_SPEEDS, formatTimestamp } from "./types";

/* ─── Types ───────────────────────────────────────────────────────────────── */

export type VideoPlayerHandle = {
  readonly currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getVideoElement: () => HTMLVideoElement | null;
};

type Props = {
  src: string;
  poster?: string;
  onTimeUpdate?: (time: number) => void;
  onReady?: (duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  overlay?: ReactNode;
  className?: string;
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  function VideoPlayer(
    { src, poster, onTimeUpdate, onReady, onPlay, onPause, overlay, className },
    ref
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [speed, setSpeed] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    /* ── Expose handle ──────────────────────────────────────────────────── */

    useImperativeHandle(ref, () => ({
      get currentTime() {
        return videoRef.current?.currentTime ?? 0;
      },
      get duration() {
        return videoRef.current?.duration ?? 0;
      },
      get paused() {
        return videoRef.current?.paused ?? true;
      },
      play() {
        videoRef.current?.play();
      },
      pause() {
        videoRef.current?.pause();
      },
      seekTo(time: number) {
        if (videoRef.current) videoRef.current.currentTime = time;
      },
      getVideoElement() {
        return videoRef.current;
      },
    }));

    /* ── Events ─────────────────────────────────────────────────────────── */

    const handleTimeUpdate = useCallback(() => {
      const t = videoRef.current?.currentTime ?? 0;
      setCurrentTime(t);
      onTimeUpdate?.(t);
    }, [onTimeUpdate]);

    const handleLoadedMetadata = useCallback(() => {
      const d = videoRef.current?.duration ?? 0;
      setDuration(d);
      onReady?.(d);
    }, [onReady]);

    const handlePlay = useCallback(() => {
      setPlaying(true);
      onPlay?.();
    }, [onPlay]);

    const handlePause = useCallback(() => {
      setPlaying(false);
      onPause?.();
    }, [onPause]);

    /* ── Controls ───────────────────────────────────────────────────────── */

    function togglePlay() {
      if (!videoRef.current) return;
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }

    function frameStep(direction: 1 | -1) {
      if (!videoRef.current) return;
      videoRef.current.pause();
      videoRef.current.currentTime += direction * (1 / 30);
    }

    function changeSpeed(s: number) {
      setSpeed(s);
      if (videoRef.current) videoRef.current.playbackRate = s;
      setShowSpeedMenu(false);
    }

    function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
      if (!progressRef.current || !videoRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      videoRef.current.currentTime = frac * duration;
    }

    function toggleMute() {
      if (!videoRef.current) return;
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }

    function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
      const v = parseFloat(e.target.value);
      setVolume(v);
      if (videoRef.current) {
        videoRef.current.volume = v;
        videoRef.current.muted = v === 0;
        setMuted(v === 0);
      }
    }

    function toggleFullscreen() {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }

    useEffect(() => {
      function handleFsChange() {
        setIsFullscreen(!!document.fullscreenElement);
      }
      document.addEventListener("fullscreenchange", handleFsChange);
      return () =>
        document.removeEventListener("fullscreenchange", handleFsChange);
    }, []);

    // Close speed menu on outside click
    useEffect(() => {
      if (!showSpeedMenu) return;
      const handler = () => setShowSpeedMenu(false);
      document.addEventListener("click", handler);
      return () => document.removeEventListener("click", handler);
    }, [showSpeedMenu]);

    /* ── Keyboard shortcuts ─────────────────────────────────────────────── */

    useEffect(() => {
      function handleKey(e: KeyboardEvent) {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
          return;

        switch (e.key) {
          case " ":
          case "k":
            e.preventDefault();
            togglePlay();
            break;
          case "ArrowLeft":
            e.preventDefault();
            if (videoRef.current)
              videoRef.current.currentTime = Math.max(
                0,
                videoRef.current.currentTime - 5
              );
            break;
          case "ArrowRight":
            e.preventDefault();
            if (videoRef.current)
              videoRef.current.currentTime = Math.min(
                duration,
                videoRef.current.currentTime + 5
              );
            break;
          case ",":
            e.preventDefault();
            frameStep(-1);
            break;
          case ".":
            e.preventDefault();
            frameStep(1);
            break;
          case "f":
            e.preventDefault();
            toggleFullscreen();
            break;
          case "m":
            e.preventDefault();
            toggleMute();
            break;
        }
      }

      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [duration, muted]);

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div
        ref={containerRef}
        className={`relative bg-black rounded-xl overflow-hidden group ${className ?? ""}`}
      >
        {/* Video */}
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onClick={togglePlay}
          playsInline
          preload="metadata"
        />

        {/* Overlay (annotation canvas goes here) */}
        {overlay && (
          <div className="absolute inset-0 pointer-events-none [&>*]:pointer-events-auto">
            {overlay}
          </div>
        )}

        {/* Play button overlay (when paused, no overlay interaction) */}
        {!playing && !overlay && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20"
          >
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-surface-900 ml-1"
              >
                <polygon points="5 3 19 12 5 21" />
              </svg>
            </div>
          </button>
        )}

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Progress bar */}
          <div
            ref={progressRef}
            className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-2 group/prog hover:h-2.5 transition-all"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-primary-500 rounded-full relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary-400 shadow opacity-0 group-hover/prog:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-white text-xs">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title={playing ? "Pause (Space)" : "Play (Space)"}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>

            {/* Frame step */}
            <button
              onClick={() => frameStep(-1)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Previous frame (,)"
            >
              <FrameBackIcon />
            </button>
            <button
              onClick={() => frameStep(1)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Next frame (.)"
            >
              <FrameForwardIcon />
            </button>

            {/* Time */}
            <span className="font-mono tabular-nums min-w-[100px]">
              {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
            </span>

            <div className="flex-1" />

            {/* Speed */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSpeedMenu(!showSpeedMenu);
                }}
                className="px-2 py-0.5 hover:bg-white/10 rounded transition-colors font-mono"
                title="Playback speed"
              >
                {speed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-1 bg-surface-900 border border-surface-700 rounded-lg py-1 shadow-xl z-10">
                  {PLAYBACK_SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={(e) => {
                        e.stopPropagation();
                        changeSpeed(s);
                      }}
                      className={`block w-full text-left px-3 py-1 text-xs hover:bg-white/10 ${
                        speed === s ? "text-primary-400" : "text-white"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Volume */}
            <button
              onClick={toggleMute}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Mute (M)"
            >
              {muted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 accent-primary-500 cursor-pointer"
            />

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

/* ─── Icons ───────────────────────────────────────────────────────────────── */

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function PlayIcon() {
  return (
    <svg {...iconProps}>
      <polygon points="5 3 19 12 5 21" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg {...iconProps}>
      <rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FrameBackIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="11 19 2 12 11 5" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function FrameForwardIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="13 5 22 12 13 19" />
      <line x1="22" y1="12" x2="2" y2="12" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg {...iconProps}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg {...iconProps}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}
