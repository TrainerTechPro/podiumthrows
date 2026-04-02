import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from "remotion";
import { STATUS_COLORS, STATUS_SYMBOLS, COLORS } from "../lib/tokens";
import { FONT_BODY, FONT_MONO } from "../lib/fonts";
import { SMOOTH } from "../lib/spring-presets";

type Props = {
  label: string;
  degrees: number;
  status: "optimal" | "marginal" | "concerning";
  enterDelay?: number;
};

export const AngleReadout: React.FC<Props> = ({
  label,
  degrees,
  status,
  enterDelay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideProgress = spring({
    frame: frame - enterDelay,
    fps,
    config: SMOOTH,
  });

  const translateX = interpolate(slideProgress, [0, 1], [20, 0]);
  const opacity = interpolate(slideProgress, [0, 1], [0, 1]);

  const localFrame = frame - enterDelay;
  const displayDegrees = interpolate(
    localFrame,
    [0, 25],
    [0, degrees],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
  );

  const color = STATUS_COLORS[status];
  const symbol = STATUS_SYMBOLS[status];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        transform: `translateX(${translateX}px)`,
        opacity,
      }}
    >
      {/* Status dot */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      {/* Status symbol */}
      <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 600, color, width: 14 }}>
        {symbol}
      </span>
      {/* Label */}
      <span style={{ fontFamily: FONT_BODY, fontSize: 15, color: COLORS.muted, flexShrink: 0 }}>
        {label}
      </span>
      {/* Degrees */}
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 18,
          fontWeight: 500,
          color: COLORS.foreground,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Math.round(displayDegrees)}°
      </span>
    </div>
  );
};
