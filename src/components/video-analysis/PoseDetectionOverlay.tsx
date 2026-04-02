"use client";

import { useState, useCallback } from "react";
import { Scan } from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────────────── */

type Props = {
  onEnable: () => void;
  onSkip: () => void;
};

/* ─── Component ────────────────────────────────────────────────────────────── */

/**
 * First-time overlay shown on the video when pose detection hasn't been
 * activated yet. Features a scanning-line animation, skeleton preview SVG,
 * and a prominent gold CTA. Fades out on enable/skip.
 */
export function PoseDetectionOverlay({ onEnable, onSkip }: Props) {
  const [exiting, setExiting] = useState(false);

  const handleEnable = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onEnable, 350);
  }, [exiting, onEnable]);

  const handleSkip = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onSkip, 350);
  }, [exiting, onSkip]);

  return (
    <>
      {/* Scoped keyframes — only used by this overlay */}
      <style>{`
        @keyframes pose-scan-sweep {
          0% { transform: translateY(-5%); opacity: 0; }
          8% { opacity: 1; }
          92% { opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        @keyframes pose-joint-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
        @keyframes pose-content-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pose-scan-line { animation: none !important; opacity: 0 !important; }
          .pose-joint { animation: none !important; opacity: 0.8 !important; }
          .pose-content { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      <div
        className={`absolute inset-0 z-10 flex items-center justify-center cursor-default
          transition-opacity duration-300 ease-out
          ${exiting ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        role="region"
        aria-label="Enable pose detection"
      >
        {/* Dark backdrop with vignette */}
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.25)_100%)]" />

        {/* Scanning line + glow trail */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="pose-scan-line absolute inset-x-0 top-0 h-full"
            style={{ animation: "pose-scan-sweep 3.5s ease-in-out infinite" }}
          >
            <div className="h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent" />
            <div className="h-8 bg-gradient-to-b from-primary-500/10 to-transparent" />
          </div>
        </div>

        {/* Corner targeting brackets */}
        <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-primary-500/30 sm:w-5 sm:h-5 sm:top-4 sm:left-4" />
        <div className="absolute top-3 right-3 w-4 h-4 border-t border-r border-primary-500/30 sm:w-5 sm:h-5 sm:top-4 sm:right-4" />
        <div className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-primary-500/30 sm:w-5 sm:h-5 sm:bottom-4 sm:left-4" />
        <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-primary-500/30 sm:w-5 sm:h-5 sm:bottom-4 sm:right-4" />

        {/* Center content */}
        <div
          className="pose-content relative text-center px-6 max-w-xs"
          style={{ animation: "pose-content-in 500ms ease-out 150ms both" }}
        >
          {/* Skeleton preview */}
          <div className="mx-auto w-14 h-20 text-primary-500/60 mb-4" aria-hidden="true">
            <SkeletonPreview />
          </div>

          <h3 className="text-base font-heading font-bold text-white tracking-wide">
            Pose Detection
          </h3>
          <p className="text-[13px] text-white/60 leading-relaxed mt-1.5 mb-5">
            Detect joint positions and measure biomechanical angles in real-time
          </p>

          {/* Primary CTA */}
          <button
            type="button"
            onClick={handleEnable}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
              bg-primary-500 text-black font-heading font-bold text-sm tracking-wide
              shadow-[0_0_24px_rgba(255,200,0,0.25)]
              hover:shadow-[0_0_32px_rgba(255,200,0,0.4)] hover:bg-primary-400
              active:scale-[0.97] transition-all duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <Scan size={16} strokeWidth={1.75} aria-hidden="true" />
            Enable Pose Detection
          </button>

          {/* Dismiss */}
          <button
            type="button"
            onClick={handleSkip}
            className="block mx-auto text-[11px] text-white/35 hover:text-white/55
              transition-colors duration-200 mt-3 py-1.5 rounded
              focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          >
            Skip for now
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Skeleton SVG Preview ─────────────────────────────────────────────────── */

/** Simplified skeleton figure that previews what pose detection reveals.
 *  Joints pulse with staggered delays; a dashed angle-arc hints at measurement. */
function SkeletonPreview() {
  const joints = [
    { cx: 22, cy: 30, d: 0 },
    { cx: 58, cy: 30, d: 0.2 },
    { cx: 14, cy: 48, d: 0.4 },
    { cx: 66, cy: 48, d: 0.6 },
    { cx: 30, cy: 62, d: 0.8 },
    { cx: 50, cy: 62, d: 1.0 },
    { cx: 26, cy: 86, d: 1.2 },
    { cx: 54, cy: 86, d: 1.4 },
  ];

  return (
    <svg viewBox="0 0 80 120" fill="none" className="w-full h-full">
      {/* Bones */}
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
        {/* Neck */}
        <line x1="40" y1="16" x2="40" y2="26" />
        {/* Shoulders */}
        <line x1="22" y1="30" x2="58" y2="30" />
        {/* Spine */}
        <line x1="40" y1="30" x2="40" y2="62" />
        {/* Left arm */}
        <line x1="22" y1="30" x2="14" y2="48" />
        <line x1="14" y1="48" x2="10" y2="66" />
        {/* Right arm */}
        <line x1="58" y1="30" x2="66" y2="48" />
        <line x1="66" y1="48" x2="70" y2="66" />
        {/* Hips */}
        <line x1="30" y1="62" x2="50" y2="62" />
        {/* Left leg */}
        <line x1="30" y1="62" x2="26" y2="86" />
        <line x1="26" y1="86" x2="22" y2="110" />
        {/* Right leg */}
        <line x1="50" y1="62" x2="54" y2="86" />
        <line x1="54" y1="86" x2="58" y2="110" />
      </g>

      {/* Head */}
      <circle cx="40" cy="10" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />

      {/* Joints — staggered pulse */}
      <g fill="currentColor">
        {joints.map(({ cx, cy, d }) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={2.5}
            className="pose-joint"
            style={{ animation: `pose-joint-pulse 2.5s ease-in-out infinite ${d}s` }}
          />
        ))}
      </g>

      {/* Angle-arc hint at right elbow */}
      <path
        d="M 62 43 A 6 6 0 0 1 69 53"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 2"
        opacity="0.4"
      />
    </svg>
  );
}
