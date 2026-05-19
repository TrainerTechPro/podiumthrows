"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const SPEEDS = [1, 0.5, 0.25] as const;
type Speed = (typeof SPEEDS)[number];

interface DrillVideoPlayerProps {
  src: string;
  /** Fires when playback ends — drives the WatchNextOverlay handoff. */
  onEnded?: () => void;
  /** Fires on first play, for view-tracking. */
  onPlay?: () => void;
  /** Autoplay the first time it mounts. The card swaps to this player from a
   *  poster-style play button, so autoplay is the user's intent. */
  autoPlay?: boolean;
}

/**
 * Athlete-facing drill-video player.
 *
 * Native browser `controls` carry scrub + play/pause + volume — they sit at
 * the bottom of the frame, which is the thumb-zone on a phone. Slow-mo is
 * the only thing native controls hide behind a long-press menu most users
 * never find, so we surface it as a single tap target at the top of the
 * frame. Top placement is the only safe spot: it never overlaps the native
 * control bar at the bottom, and it doesn't compete with any future
 * caption / annotation overlay (which by convention lives along the bottom
 * third of the player).
 *
 * Drill clips are capped at 10s, so fast-forward isn't meaningful — only
 * slow-mo (1× → 0.5× → 0.25×) is exposed.
 */
export const DrillVideoPlayer = forwardRef<HTMLVideoElement, DrillVideoPlayerProps>(
  function DrillVideoPlayer({ src, onEnded, onPlay, autoPlay = false }, externalRef) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [speed, setSpeed] = useState<Speed>(1);

    // Forward the underlying <video> element to any parent that needs it.
    useImperativeHandle(externalRef, () => videoRef.current as HTMLVideoElement);

    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.playbackRate = speed;
      }
    }, [speed]);

    function cycleSpeed() {
      const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
      setSpeed(next);
    }

    const speedLabel = speed === 1 ? "1×" : `${speed}×`;
    const ariaLabel =
      speed === 1
        ? "Slow-motion off. Tap to play at half speed."
        : `Slow-motion ${speedLabel}. Tap to cycle.`;

    return (
      <>
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          autoPlay={autoPlay}
          controls
          controlsList="nodownload"
          playsInline
          onPlay={onPlay}
          onEnded={onEnded}
        />
        <button
          type="button"
          onClick={cycleSpeed}
          aria-label={ariaLabel}
          aria-pressed={speed !== 1}
          // Top-right, 44×44 hit target. Translucent backdrop so it reads on
          // both bright and dark frames. Highlighted amber when active so
          // athletes can see at a glance that slow-mo is engaged.
          className={
            "absolute top-2 right-2 flex items-center justify-center " +
            "min-w-[44px] min-h-[44px] px-2 rounded-full " +
            "text-xs font-mono font-semibold tabular-nums " +
            "transition-colors ring-1 ring-white/20 " +
            (speed === 1
              ? "bg-black/85 text-white hover:bg-black/95"
              : "bg-primary-500 text-surface-950 shadow-[0_2px_10px_rgba(255,200,0,0.45)] ring-0")
          }
        >
          {speedLabel}
        </button>
      </>
    );
  }
);
