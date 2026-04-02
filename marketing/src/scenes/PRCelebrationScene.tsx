import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { Background } from "../components/Background";
import { DataReveal } from "../components/DataReveal";
import { ConfettiBurst } from "../components/ConfettiBurst";
import { COLORS, EVENT_COLORS } from "../lib/tokens";
import { FONT_HEADING } from "../lib/fonts";
import { BOUNCY } from "../lib/spring-presets";

/**
 * PRCelebrationScene — 120 frames / 4s @ 30fps
 * Big PR number + event badge + confetti + "NEW PERSONAL BEST" title.
 */
export const PRCelebrationScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Gold glow radiating from center number — pulses with frame
  const glowBase = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glowPulse = 0.4 + Math.sin(frame * 0.15) * 0.15;
  const glowStrength = glowBase * glowPulse;

  // "SHOT PUT" badge spring entrance
  const badgeProgress = spring({
    frame: frame - 10,
    fps,
    config: BOUNCY,
  });
  const badgeScale = interpolate(badgeProgress, [0, 1], [0.5, 1]);
  const badgeOpacity = interpolate(badgeProgress, [0, 1], [0, 1]);

  // "NEW PERSONAL BEST" springs in from below
  const titleProgress = spring({
    frame: frame - 20,
    fps,
    config: BOUNCY,
  });
  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill>
      <Background vignetteIntensity={0.12} />

      {/* Gold glow radiate from center */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, rgba(255,200,0,${glowStrength}) 0%, transparent 50%)`,
          pointerEvents: "none",
        }}
      />

      {/* Confetti burst */}
      <ConfettiBurst triggerFrame={15} particleCount={50} />

      {/* Centered content */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        {/* Big PR number */}
        <div
          style={{
            boxShadow: `0 0 ${60 * glowStrength}px ${30 * glowStrength}px rgba(255,200,0,${glowStrength * 0.5})`,
            borderRadius: 8,
            padding: "4px 12px",
          }}
        >
          <DataReveal
            value={18.42}
            decimals={2}
            suffix="m"
            fontSize={96}
            color={COLORS.gold}
            enterDelay={0}
            countDuration={25}
          />
        </div>

        {/* Event badge */}
        <div
          style={{
            backgroundColor: EVENT_COLORS.SHOT_PUT,
            borderRadius: 6,
            padding: "6px 18px",
            transform: `scale(${badgeScale})`,
            opacity: badgeOpacity,
          }}
        >
          <span
            style={{
              fontFamily: FONT_HEADING,
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.white,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Shot Put
          </span>
        </div>

        {/* "NEW PERSONAL BEST" title */}
        <div
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 48,
            fontWeight: 700,
            color: COLORS.white,
            transform: `translateY(${titleY}px)`,
            opacity: titleOpacity,
            letterSpacing: "0.04em",
            marginTop: 8,
          }}
        >
          NEW PERSONAL BEST
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
