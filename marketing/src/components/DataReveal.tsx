import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { COLORS } from "../lib/tokens";
import { FONT_MONO } from "../lib/fonts";

type Props = {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  color?: string;
  fontSize?: number;
  enterDelay?: number;
  countDuration?: number;
};

export const DataReveal: React.FC<Props> = ({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  color = COLORS.gold,
  fontSize = 48,
  enterDelay = 0,
  countDuration = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps: _fps } = useVideoConfig();

  const localFrame = frame - enterDelay;

  const displayValue = interpolate(
    localFrame,
    [0, countDuration],
    [0, value],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    }
  );

  const opacity = interpolate(localFrame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize,
        fontWeight: 500,
        color,
        opacity,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  );
};
