import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import { headingFont, bodyFont } from "../fonts";

type StepIndicatorProps = {
  stepNumber: number;
  totalSteps: number;
  label: string;
  description: string;
  enterDelay?: number;
};

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  stepNumber,
  totalSteps,
  label,
  description,
  enterDelay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - enterDelay,
    fps,
    config: { damping: 200 },
  });

  const labelEntrance = spring({
    frame: frame - enterDelay - 8,
    fps,
    config: { damping: 200 },
  });

  const y = interpolate(entrance, [0, 1], [40, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const labelY = interpolate(labelEntrance, [0, 1], [20, 0]);
  const labelOpacity = interpolate(labelEntrance, [0, 1], [0, 1]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 16,
        transform: `translateY(${y}px)`,
        opacity,
      }}
    >
      {/* Step badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: headingFont,
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.bg,
          }}
        >
          {stepNumber}
        </div>
        <span
          style={{
            fontFamily: bodyFont,
            fontSize: 16,
            fontWeight: 500,
            color: COLORS.textMuted,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Step {stepNumber} of {totalSteps}
        </span>
      </div>

      {/* Label */}
      <div
        style={{
          transform: `translateY(${labelY}px)`,
          opacity: labelOpacity,
        }}
      >
        <h2
          style={{
            fontFamily: headingFont,
            fontSize: 42,
            fontWeight: 700,
            color: COLORS.text,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {label}
        </h2>
        <p
          style={{
            fontFamily: bodyFont,
            fontSize: 20,
            fontWeight: 400,
            color: COLORS.textMuted,
            margin: "8px 0 0",
            lineHeight: 1.5,
            maxWidth: 500,
          }}
        >
          {description}
        </p>
      </div>
    </div>
  );
};
