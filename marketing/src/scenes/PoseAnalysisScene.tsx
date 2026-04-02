import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { Background } from "../components/Background";
import { SkeletonWireframe } from "../components/SkeletonWireframe";
import { AngleReadout } from "../components/AngleReadout";
import { COLORS } from "../lib/tokens";
import { FONT_HEADING } from "../lib/fonts";
import { SMOOTH } from "../lib/spring-presets";

const READINGS: {
  label: string;
  degrees: number;
  status: "optimal" | "marginal" | "concerning";
  enterDelay: number;
}[] = [
  { label: "Shoulder Sep", degrees: 42, status: "optimal", enterDelay: 15 },
  { label: "Hip-Shoulder", degrees: 38, status: "optimal", enterDelay: 25 },
  { label: "Block Knee", degrees: 156, status: "marginal", enterDelay: 35 },
];

/**
 * PoseAnalysisScene — 150 frames / 5s @ 30fps
 * Split layout: SkeletonWireframe (left) + 3 staggered AngleReadouts (right).
 */
export const PoseAnalysisScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "POSE ANALYSIS" label fade-in
  const labelProgress = spring({ frame, fps, config: SMOOTH });
  const labelOpacity = interpolate(labelProgress, [0, 1], [0, 1]);
  const labelY = interpolate(labelProgress, [0, 1], [-10, 0]);

  return (
    <AbsoluteFill>
      <Background />

      {/* "POSE ANALYSIS" label — top-left */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 60,
          fontFamily: FONT_HEADING,
          fontSize: 14,
          fontWeight: 600,
          color: COLORS.gold,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          opacity: labelOpacity,
          transform: `translateY(${labelY}px)`,
        }}
      >
        Pose Analysis
      </div>

      {/* Split layout */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 60,
          padding: "0 80px",
        }}
      >
        {/* Left: Skeleton wireframe */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <SkeletonWireframe width={280} height={380} enterDelay={0} />
        </div>

        {/* Right: Angle readouts */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            justifyContent: "center",
          }}
        >
          {READINGS.map((r) => (
            <AngleReadout
              key={r.label}
              label={r.label}
              degrees={r.degrees}
              status={r.status}
              enterDelay={r.enterDelay}
            />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
