import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../theme";

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const glowY = interpolate(frame, [0, 765], [18, 22]);

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 120% 40% at 50% ${glowY}%, rgba(245,158,11,0.10), transparent 70%),
          radial-gradient(ellipse 100% 30% at 50% 85%, rgba(245,158,11,0.05), transparent 70%),
          ${COLORS.bg}
        `,
      }}
    >
      {/* Subtle top-edge highlight line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "15%",
          right: "15%",
          height: 1,
          background: `linear-gradient(90deg, transparent, rgba(245,158,11,0.15), transparent)`,
        }}
      />
    </AbsoluteFill>
  );
};
