import "../style.css";
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../lib/tokens";
import { FONT_BODY, FONT_MONO } from "../lib/fonts";
import { SMOOTH } from "../lib/spring-presets";
import { Background } from "../components/Background";
import { GoldText } from "../components/GoldText";
import { SkeletonWireframe } from "../components/SkeletonWireframe";
import { AngleReadout } from "../components/AngleReadout";
import { StatusDot } from "../components/StatusDot";

/* ─── Angle data ────────────────────────────────────────────────────────── */

const ANGLES: {
  label: string;
  degrees: number;
  status: "optimal" | "marginal" | "concerning";
  delay: number;
}[] = [
  { label: "Shoulder Sep", degrees: 42, status: "optimal", delay: 60 },
  { label: "Hip-Shoulder", degrees: 38, status: "optimal", delay: 72 },
  { label: "Block Knee", degrees: 156, status: "marginal", delay: 84 },
];

/* ─── Main Composition ──────────────────────────────────────────────────── */

export const FeatureLoopPoseAnalysis: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Loop fade bookends
  const loopOpacity = interpolate(
    frame,
    [0, 15, 225, 240],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Summary text entrance
  const summaryProgress = spring({
    frame: frame - 150,
    fps,
    config: SMOOTH,
  });
  const summaryOpacity = interpolate(summaryProgress, [0, 1], [0, 1]);
  const summaryY = interpolate(summaryProgress, [0, 1], [15, 0]);

  return (
    <AbsoluteFill style={{ opacity: loopOpacity }}>
      <Background />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: 60,
        }}
      >
        {/* Title */}
        <div style={{ marginTop: 40 }}>
          <GoldText text="POSE ANALYSIS" fontSize={56} enterDelay={0} />
        </div>

        {/* Skeleton wireframe centered */}
        <div
          style={{
            marginTop: 30,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <SkeletonWireframe
            width={240}
            height={320}
            enterDelay={15}
          />
        </div>

        {/* Angle readouts */}
        <div
          style={{
            marginTop: 30,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            alignItems: "flex-start",
            width: "100%",
            maxWidth: 500,
            paddingLeft: 100,
          }}
        >
          {ANGLES.map((angle, i) => (
            <AngleReadout
              key={i}
              label={angle.label}
              degrees={angle.degrees}
              status={angle.status}
              enterDelay={angle.delay}
            />
          ))}
        </div>

        {/* Summary */}
        <div
          style={{
            marginTop: 36,
            display: "flex",
            alignItems: "center",
            gap: 12,
            opacity: summaryOpacity,
            transform: `translateY(${summaryY}px)`,
          }}
        >
          <StatusDot status="optimal" size={10} />
          <StatusDot status="optimal" size={10} />
          <StatusDot status="marginal" size={10} />

          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 20,
              fontWeight: 500,
              color: COLORS.foreground,
              marginLeft: 8,
            }}
          >
            2 Optimal
          </span>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 18,
              color: COLORS.muted,
            }}
          >
            /
          </span>
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 20,
              fontWeight: 500,
              color: COLORS.warning,
            }}
          >
            1 Marginal
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
