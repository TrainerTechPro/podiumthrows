"use client";

import { useCallback, useRef, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface HoloBadgeProps {
  /** The badge content */
  children: ReactNode;
  /** Whether the badge is "earned" (enables holographic effect) */
  earned?: boolean;
  className?: string;
}

/**
 * Holographic 3D-tilt badge for achievements.
 * Earned badges get a rainbow shimmer on hover/touch with perspective tilt.
 * Unearned badges render as flat, muted cards.
 */
export function HoloBadge({ children, earned = false, className }: HoloBadgeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!earned || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      const rotateX = (y - 0.5) * -20; // max ±10deg
      const rotateY = (x - 0.5) * 20;
      setStyle({
        transform: `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`,
      });
    },
    [earned]
  );

  const handleReset = useCallback(() => {
    setStyle({ transform: "perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)" });
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded-2xl overflow-hidden transition-transform duration-200 ease-out",
        earned ? "cursor-pointer" : "opacity-50 grayscale",
        className
      )}
      style={style}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseLeave={handleReset}
      onTouchMove={(e) => {
        const t = e.touches[0];
        handleMove(t.clientX, t.clientY);
      }}
      onTouchEnd={handleReset}
    >
      {/* Content */}
      {children}

      {/* Holographic overlay — only visible on earned badges */}
      {earned && (
        <div
          className="pointer-events-none absolute inset-0 animate-holographic rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,0,150,0.12), rgba(0,200,255,0.12), rgba(255,200,0,0.12), rgba(0,255,150,0.12))",
            backgroundSize: "300% 300%",
            mixBlendMode: "overlay",
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
