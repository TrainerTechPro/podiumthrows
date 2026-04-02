import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { EVENT_COLORS, EVENT_LABELS, COLORS } from "../lib/tokens";
import { FONT_BODY, FONT_MONO } from "../lib/fonts";
import { SMOOTH } from "../lib/spring-presets";

type Props = {
  event: string;
  percentage: number;
  label?: string;
  count?: number;
  enterDelay?: number;
};

export const EventBar: React.FC<Props> = ({
  event,
  percentage,
  label,
  count,
  enterDelay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const barProgress = spring({
    frame: frame - enterDelay,
    fps,
    config: SMOOTH,
  });

  const labelOpacity = interpolate(
    frame - enterDelay,
    [15, 25],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const color = EVENT_COLORS[event] || COLORS.gold;
  const displayLabel = label || EVENT_LABELS[event] || event;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, height: 32 }}>
      <span
        style={{
          fontFamily: FONT_BODY,
          fontSize: 14,
          color: COLORS.muted,
          width: 80,
          flexShrink: 0,
          opacity: labelOpacity,
        }}
      >
        {displayLabel}
      </span>
      <div
        style={{
          flex: 1,
          height: 10,
          borderRadius: 3,
          backgroundColor: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            borderRadius: 3,
            backgroundColor: color,
            transform: `scaleX(${barProgress})`,
            transformOrigin: "left",
          }}
        />
      </div>
      {count !== undefined && (
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 13,
            color: COLORS.muted,
            width: 30,
            textAlign: "right",
            opacity: labelOpacity,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
};
