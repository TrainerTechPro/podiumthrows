import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Background } from "../components/Background";
import { LogoStinger } from "../components/LogoStinger";
import { COLORS } from "../lib/tokens";

/**
 * LogoScene — 75 frames / 2.5s @ 30fps
 * Background + full LogoStinger centered, gold glow pulse after reveal.
 */
export const LogoScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Gold glow pulse on entire scene after the logo finishes revealing (~frame 30+)
  const glowOpacity = interpolate(
    frame,
    [30, 45, 60, 75],
    [0, 0.15, 0.08, 0.12],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill>
      <Background />

      {/* Ambient gold glow pulse */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(255,200,0,${glowOpacity}) 0%, transparent 60%)`,
          pointerEvents: "none",
        }}
      />

      {/* Centered logo */}
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <LogoStinger variant="full" />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
