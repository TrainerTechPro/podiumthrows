import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { CONFETTI_COLORS } from "../lib/tokens";

type Props = {
  triggerFrame?: number;
  particleCount?: number;
  colors?: string[];
};

type Particle = {
  angle: number;
  velocity: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
};

export const ConfettiBurst: React.FC<Props> = ({
  triggerFrame = 0,
  particleCount = 40,
  colors = CONFETTI_COLORS,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Generate particles deterministically using index-based pseudo-random
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: particleCount }, (_, i) => {
      const seed = (i * 7919 + 1) % 1000 / 1000; // deterministic pseudo-random
      const seed2 = (i * 6271 + 3) % 1000 / 1000;
      const seed3 = (i * 3571 + 7) % 1000 / 1000;

      return {
        angle: seed * Math.PI * 2,
        velocity: 3 + seed2 * 8,
        color: colors[i % colors.length],
        size: 4 + seed3 * 6,
        rotation: seed * 360,
        rotationSpeed: -180 + seed2 * 360,
      };
    });
  }, [particleCount, colors]);

  const localFrame = frame - triggerFrame;
  if (localFrame < 0) return null;

  const gravity = 0.15;
  const duration = 45; // frames

  if (localFrame > duration) return null;

  const fadeOut = interpolate(localFrame, [duration - 15, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {particles.map((p, i) => {
        const t = localFrame / fps;
        const x = Math.cos(p.angle) * p.velocity * localFrame;
        const y = Math.sin(p.angle) * p.velocity * localFrame + 0.5 * gravity * localFrame * localFrame;
        const rotation = p.rotation + p.rotationSpeed * t;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: p.color,
              borderRadius: 1,
              transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
              opacity: fadeOut,
            }}
          />
        );
      })}
    </div>
  );
};
