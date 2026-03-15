"use client";

import { useCallback, useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   HeroMask — Interactive hover reveal
   ─────────────────────────────────────
   Shows a shot putter silhouette by default. When the user hovers,
   a circular mask follows the cursor and reveals a discus thrower beneath.
   ═══════════════════════════════════════════════════════════════════════════ */

// --- Shot Putter silhouette (glide technique, right-to-left stance) ---
function ShotPutterSVG({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 500"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* Head */}
      <circle cx="280" cy="100" r="28" />
      {/* Neck */}
      <rect x="272" y="125" width="16" height="18" rx="4" />
      {/* Torso - leaning back in power position */}
      <path d="M240 140 L310 150 L320 260 L230 250 Z" />
      {/* Right arm - shot held at neck */}
      <path
        d="M310 155 Q340 140 345 110 Q348 95 340 90"
        fill="none"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinecap="round"
      />
      {/* Shot put ball */}
      <circle cx="338" cy="88" r="14" />
      {/* Left arm - extended for balance */}
      <path
        d="M245 160 Q200 145 170 165"
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
      />
      {/* Right leg - drive leg, bent */}
      <path
        d="M300 255 Q320 320 310 370 Q305 400 315 440"
        fill="none"
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="round"
      />
      {/* Right foot */}
      <path d="M310 438 Q325 445 335 440 Q340 435 330 430" />
      {/* Left leg - planted, bracing */}
      <path
        d="M245 250 Q220 310 210 370 Q205 410 195 445"
        fill="none"
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="round"
      />
      {/* Left foot */}
      <path d="M190 443 Q180 450 175 445 Q172 438 185 435" />
    </svg>
  );
}

// --- Discus Thrower silhouette (wind-up / release position) ---
function DiscusThrowerSVG({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 500"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* Head */}
      <circle cx="230" cy="95" r="26" />
      {/* Neck */}
      <rect x="222" y="118" width="16" height="16" rx="4" />
      {/* Torso - rotated/twisted for discus throw */}
      <path d="M200 130 L270 138 L285 260 L195 252 Z" />
      {/* Right arm - extended back with discus (wide sweep) */}
      <path
        d="M270 148 Q320 130 360 155 Q380 170 385 185"
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
      />
      {/* Discus - flat oval at hand */}
      <ellipse
        cx="388"
        cy="188"
        rx="16"
        ry="6"
        transform="rotate(25 388 188)"
      />
      {/* Left arm - tucked across body for rotation */}
      <path
        d="M205 148 Q175 170 165 200"
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
      />
      {/* Right leg - pivot leg, slightly bent */}
      <path
        d="M265 255 Q280 320 275 380 Q272 420 280 450"
        fill="none"
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="round"
      />
      {/* Right foot */}
      <path d="M276 448 Q290 455 300 448 Q303 442 292 438" />
      {/* Left leg - sweeping around in rotation */}
      <path
        d="M210 250 Q190 310 175 365 Q165 410 155 445"
        fill="none"
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="round"
      />
      {/* Left foot */}
      <path d="M150 443 Q140 450 138 445 Q136 438 148 435" />
    </svg>
  );
}

export default function HeroMask() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maskPos, setMaskPos] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMaskPos({ x, y });
    },
    []
  );

  const maskRadius = isHovering ? 18 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="relative w-full h-full select-none"
      aria-hidden="true"
    >
      {/* Base layer — Shot Putter (always visible) */}
      <ShotPutterSVG className="absolute inset-0 w-full h-full text-[#e8e4dc]/[0.04]" />

      {/* Reveal layer — Discus Thrower (visible through mask) */}
      <div
        className="absolute inset-0 transition-[clip-path] duration-100 ease-out"
        style={{
          clipPath: `circle(${maskRadius}% at ${maskPos.x}% ${maskPos.y}%)`,
        }}
      >
        <DiscusThrowerSVG className="absolute inset-0 w-full h-full text-primary-500/[0.08]" />
      </div>

      {/* Subtle hint ring on hover */}
      <div
        className="pointer-events-none absolute rounded-full border border-primary-500/10 transition-all duration-300"
        style={{
          width: `${maskRadius * 2}%`,
          height: `${maskRadius * 2}%`,
          left: `${maskPos.x}%`,
          top: `${maskPos.y}%`,
          transform: "translate(-50%, -50%)",
          opacity: isHovering ? 1 : 0,
        }}
      />
    </div>
  );
}
