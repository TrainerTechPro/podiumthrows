import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS, cutCornerClipPath } from "../lib/tokens";
import { SMOOTH } from "../lib/spring-presets";

type Props = {
  width?: number | string;
  height?: number | string;
  enterDelay?: number;
  glowOnReveal?: boolean;
  cutSize?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

export const CutCornerCard: React.FC<Props> = ({
  width,
  height,
  enterDelay = 0,
  glowOnReveal = true,
  cutSize = 12,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - enterDelay,
    fps,
    config: SMOOTH,
  });

  const translateY = interpolate(progress, [0, 1], [40, 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  const glowOpacity = glowOnReveal
    ? interpolate(
        frame - enterDelay,
        [0, 10, 30],
        [0, 0.3, 0.1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      ) * Math.min(progress, 1)
    : 0.1;

  return (
    <div
      style={{
        width,
        height,
        transform: `translateY(${translateY}px)`,
        opacity,
        clipPath: cutCornerClipPath(cutSize),
        backgroundColor: COLORS.cardBg,
        border: `1px solid ${COLORS.cardBorder}`,
        boxShadow: `0 0 20px rgba(255,200,0,${glowOpacity})`,
        padding: 24,
        position: "relative",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
