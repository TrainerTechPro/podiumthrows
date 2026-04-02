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
import { FONT_BODY } from "../lib/fonts";
import { SMOOTH } from "../lib/spring-presets";
import { Background } from "../components/Background";
import { DeviceFrame } from "../components/DeviceFrame";
import { GoldText } from "../components/GoldText";
import { ThrowingFigure3D } from "../components/ThrowingFigure3D";
import { AngleReadout } from "../components/AngleReadout";
import { StatusDot } from "../components/StatusDot";

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

  // Summary entrance
  const summaryProgress = spring({ frame: frame - 150, fps, config: SMOOTH });
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
          padding: "40px 40px 30px",
        }}
      >
        {/* Title */}
        <GoldText text="POSE ANALYSIS" fontSize={42} enterDelay={0} />

        {/* iPhone with 3D figure inside */}
        <div style={{ marginTop: 16, display: "flex", gap: 24, alignItems: "center" }}>
          <DeviceFrame width={200} height={432} enterDelay={5}>
            <div style={{ width: "100%", height: "100%", backgroundColor: COLORS.background }}>
              <ThrowingFigure3D
                width={192}
                height={424}
                enterDelay={10}
                rotateSpeed={0.006}
                showArcs={true}
              />
            </div>
          </DeviceFrame>

          {/* Angle readouts beside the phone */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
        </div>

        {/* Summary */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            opacity: summaryOpacity,
            transform: `translateY(${summaryY}px)`,
          }}
        >
          <StatusDot status="optimal" size={8} />
          <StatusDot status="optimal" size={8} />
          <StatusDot status="marginal" size={8} />
          <span style={{ fontFamily: FONT_BODY, fontSize: 16, fontWeight: 500, color: COLORS.foreground, marginLeft: 6 }}>
            2 Optimal
          </span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 16, color: COLORS.muted }}>/</span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 16, fontWeight: 500, color: COLORS.warning }}>
            1 Marginal
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
