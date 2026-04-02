import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../lib/tokens";
import { FONT_HEADING } from "../lib/fonts";
import { BOUNCY, SMOOTH } from "../lib/spring-presets";

type Props = {
  variant?: "full" | "compact";
};

export const LogoStinger: React.FC<Props> = ({ variant = "full" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Gold line draws from center
  const lineScale = spring({ frame, fps, config: SMOOTH });

  // "PODIUM" letters spring in from above
  const podiumLetters = "PODIUM".split("");
  // "THROWS" letters spring in from below
  const throwsLetters = "THROWS".split("");

  const letterDelay = 2; // frames between each letter
  const podiumStart = 8;
  const throwsStart = 12;

  // Glow pulse after full reveal
  const glowOpacity = interpolate(
    frame,
    [20, 25, 40],
    [0, 0.5, 0.1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Cut-corner underline
  const underlineProgress = spring({
    frame: frame - 18,
    fps,
    config: SMOOTH,
  });

  if (variant === "compact") {
    const compactProgress = spring({ frame, fps, config: SMOOTH });
    const compactOpacity = interpolate(compactProgress, [0, 1], [0, 1]);
    const compactScale = interpolate(compactProgress, [0, 1], [0.85, 1]);

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: compactOpacity, transform: `scale(${compactScale})` }}>
        <span style={{ fontFamily: FONT_HEADING, fontSize: 36, fontWeight: 700, color: COLORS.gold, letterSpacing: "0.1em", textShadow: `0 0 30px rgba(255,200,0,${glowOpacity})` }}>
          PODIUM THROWS
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      {/* Gold horizontal line */}
      <div
        style={{
          width: 200,
          height: 1,
          backgroundColor: COLORS.gold,
          transform: `scaleX(${lineScale})`,
          opacity: 0.6,
          marginBottom: 8,
        }}
      />

      {/* PODIUM — from above */}
      <div style={{ display: "flex", gap: 4 }}>
        {podiumLetters.map((letter, i) => {
          const progress = spring({
            frame: frame - podiumStart - i * letterDelay,
            fps,
            config: BOUNCY,
          });
          const y = interpolate(progress, [0, 1], [-30, 0]);
          const opacity = interpolate(progress, [0, 1], [0, 1]);

          return (
            <span
              key={`p-${i}`}
              style={{
                fontFamily: FONT_HEADING,
                fontSize: 72,
                fontWeight: 700,
                color: COLORS.gold,
                transform: `translateY(${y}px)`,
                opacity,
                textShadow: `0 0 40px rgba(255,200,0,${glowOpacity})`,
              }}
            >
              {letter}
            </span>
          );
        })}
      </div>

      {/* THROWS — from below */}
      <div style={{ display: "flex", gap: 3, marginTop: -8 }}>
        {throwsLetters.map((letter, i) => {
          const progress = spring({
            frame: frame - throwsStart - i * letterDelay,
            fps,
            config: BOUNCY,
          });
          const y = interpolate(progress, [0, 1], [30, 0]);
          const opacity = interpolate(progress, [0, 1], [0, 1]);

          return (
            <span
              key={`t-${i}`}
              style={{
                fontFamily: FONT_HEADING,
                fontSize: 48,
                fontWeight: 600,
                color: COLORS.foreground,
                transform: `translateY(${y}px)`,
                opacity,
                letterSpacing: "0.15em",
              }}
            >
              {letter}
            </span>
          );
        })}
      </div>

      {/* Gold underline */}
      <div
        style={{
          width: 260,
          height: 2,
          backgroundColor: COLORS.gold,
          transform: `scaleX(${underlineProgress})`,
          transformOrigin: "left",
          marginTop: 8,
          opacity: 0.8,
        }}
      />
    </div>
  );
};
