import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../lib/tokens";
import { FONT_HEADING } from "../lib/fonts";
import { SMOOTH } from "../lib/spring-presets";

type Props = {
  text: string;
  fontSize?: number;
  glow?: boolean;
  enterDelay?: number;
  style?: React.CSSProperties;
};

export const GoldText: React.FC<Props> = ({
  text,
  fontSize = 64,
  glow = true,
  enterDelay = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - enterDelay,
    fps,
    config: SMOOTH,
  });

  const scale = interpolate(progress, [0, 1], [0.9, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div
      style={{
        fontFamily: FONT_HEADING,
        fontSize,
        fontWeight: 700,
        color: COLORS.gold,
        textShadow: glow ? `0 0 40px rgba(255,200,0,0.3)` : undefined,
        transform: `scale(${scale})`,
        opacity,
        letterSpacing: "-0.02em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {text}
    </div>
  );
};
