import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { Background } from "../components/Background";
import { TaglineSlide } from "../components/TaglineSlide";
import { COLORS } from "../lib/tokens";
import { FONT_HEADING } from "../lib/fonts";
import { SMOOTH } from "../lib/spring-presets";

/**
 * CTAScene — 150 frames / 5s @ 30fps
 * "podiumthrows.com" in large gold text + tagline below, gold glow pulse.
 */
export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // URL entrance
  const urlProgress = spring({ frame, fps, config: SMOOTH });
  const urlScale = interpolate(urlProgress, [0, 1], [0.85, 1]);
  const urlOpacity = interpolate(urlProgress, [0, 1], [0, 1]);

  // Gold glow pulsing via sine wave — oscillates boxShadow opacity between 0.15 and 0.25
  const glowOscillation = 0.2 + Math.sin(frame * 0.12) * 0.05;
  const glowShadow = `0 0 60px rgba(255,200,0,${glowOscillation}), 0 0 120px rgba(255,200,0,${glowOscillation * 0.5})`;

  return (
    <AbsoluteFill>
      <Background vignette />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {/* URL */}
        <div
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 64,
            fontWeight: 700,
            color: COLORS.gold,
            transform: `scale(${urlScale})`,
            opacity: urlOpacity,
            textShadow: glowShadow,
            letterSpacing: "-0.01em",
          }}
        >
          podiumthrows.com
        </div>

        {/* Tagline */}
        <TaglineSlide
          text="The coaching platform built for throws"
          enterDelay={15}
          fontSize={22}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
