"use client";

import { useEffect, useRef } from "react";
import { formatEventType } from "@/lib/utils";
import { CONFETTI_COLORS, BRAND } from "@/lib/design-tokens";

interface PRCelebrationProps {
  show: boolean;
  onDismiss: () => void;
  event?: string;
  distance?: number;
  unit?: string;
}

// Stable seeded random for deterministic confetti positions (avoids hydration issues)
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const CONFETTI_COUNT = 36;

export function PRCelebration({
  show,
  onDismiss,
  event,
  distance,
  unit = "m",
}: PRCelebrationProps) {
  const rand = seededRandom(42);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (show) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onDismiss, 4000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [show, onDismiss]);

  if (!show) return null;

  const particles = Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const left = rand() * 100;
    const delay = rand() * 1.2;
    const duration = 1.8 + rand() * 1.5;
    const size = 6 + rand() * 8;
    const color = CONFETTI_COLORS[Math.floor(rand() * CONFETTI_COLORS.length)];
    const rotate = rand() * 360;
    const isRect = rand() > 0.5;
    return { i, left, delay, duration, size, color, rotate, isRect };
  });

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes prBadgeIn {
          0%   { transform: scale(0.6) translateY(20px); opacity: 0; }
          60%  { transform: scale(1.08) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes prFadeOut {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* Overlay — click to dismiss */}
      <div
        className="fixed inset-0 z-50 pointer-events-auto"
        onClick={onDismiss}
        aria-label="Dismiss celebration"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onDismiss()}
      >
        {/* Confetti particles */}
        {particles.map(({ i, left, delay, duration, size, color, rotate, isRect }) => (
          <span
            key={i}
            style={{
              position: "fixed",
              left: `${left}%`,
              top: "-12px",
              width: isRect ? `${size}px` : `${size * 0.7}px`,
              height: isRect ? `${size * 0.4}px` : `${size * 0.7}px`,
              backgroundColor: color,
              borderRadius: isRect ? "2px" : "50%",
              transform: `rotate(${rotate}deg)`,
              animation: `confettiFall ${duration}s ${delay}s ease-in both`,
              pointerEvents: "none",
            }}
          />
        ))}

        {/* Central badge */}
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 51 }}
        >
          <div
            className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl px-8 py-7 flex flex-col items-center gap-2 text-center"
            style={{
              animation: "prBadgeIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
              maxWidth: "320px",
              border: `2px solid ${BRAND.primary}`,
            }}
          >
            <span style={{ fontSize: "3rem", lineHeight: 1 }}>🏆</span>
            <p className="text-xl font-bold text-[var(--foreground)] mt-1">
              New Personal Best!
            </p>
            {event && (
              <p className="text-sm font-medium text-amber-500">
                {formatEventType(event)}
              </p>
            )}
            {distance !== undefined && (
              <p className="text-3xl font-bold text-amber-500 tabular-nums">
                {distance.toFixed(2)}{unit}
              </p>
            )}
            <p className="text-xs text-muted mt-1">
              Tap anywhere to continue
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
