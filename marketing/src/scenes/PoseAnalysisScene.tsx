import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { Background } from "../components/Background";
import { DeviceFrame } from "../components/DeviceFrame";
import { ThrowingFigure3D } from "../components/ThrowingFigure3D";
import { AngleReadout } from "../components/AngleReadout";
import { COLORS } from "../lib/tokens";
import { FONT_HEADING, FONT_BODY } from "../lib/fonts";
import { SMOOTH } from "../lib/spring-presets";

const READINGS: {
  label: string;
  degrees: number;
  status: "optimal" | "marginal" | "concerning";
  enterDelay: number;
}[] = [
  { label: "Shoulder Sep", degrees: 42, status: "optimal", enterDelay: 25 },
  { label: "Hip-Shoulder", degrees: 38, status: "optimal", enterDelay: 35 },
  { label: "Block Knee", degrees: 156, status: "marginal", enterDelay: 45 },
  { label: "Trunk Lean", degrees: 22, status: "optimal", enterDelay: 55 },
  { label: "Rear Knee", degrees: 134, status: "optimal", enterDelay: 65 },
];

/**
 * PoseAnalysisScene — 150 frames / 5s @ 30fps
 * iPhone device frame showing the skeleton + angle panel alongside floating readouts.
 */
export const PoseAnalysisScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelProgress = spring({ frame, fps, config: SMOOTH });
  const labelOpacity = interpolate(labelProgress, [0, 1], [0, 1]);
  const labelY = interpolate(labelProgress, [0, 1], [-10, 0]);

  // Summary stats at bottom
  const summaryProgress = spring({ frame: frame - 70, fps, config: SMOOTH });
  const summaryOpacity = interpolate(summaryProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill>
      <Background vignetteIntensity={0.05} />

      {/* "POSE ANALYSIS" label — top-left */}
      <div
        style={{
          position: "absolute",
          top: 36,
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

      {/* Main layout: iPhone left, readouts right */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 50,
          padding: "0 60px",
        }}
      >
        {/* iPhone with skeleton inside */}
        <DeviceFrame width={260} height={562} enterDelay={0}>
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: COLORS.background,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* Fake status bar */}
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 16,
                right: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontFamily: FONT_BODY, fontSize: 9, color: COLORS.muted }}>
                9:41
              </span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 8, color: COLORS.gold, fontWeight: 600 }}>
                PODIUM THROWS
              </span>
              <div style={{ display: "flex", gap: 3 }}>
                <div style={{ width: 12, height: 6, borderRadius: 2, border: `1px solid ${COLORS.muted}` }}>
                  <div style={{ width: 8, height: 4, borderRadius: 1, backgroundColor: COLORS.success, margin: "0.5px" }} />
                </div>
              </div>
            </div>

            {/* 3D figure in the "video area" */}
            <div
              style={{
                marginTop: 20,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <ThrowingFigure3D
                width={240}
                height={340}
                enterDelay={8}
                rotateSpeed={0.005}
                showArcs={true}
              />
            </div>

            {/* Mini angle panel below skeleton */}
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                justifyContent: "center",
                padding: "0 8px",
              }}
            >
              {["42°", "38°", "156°"].map((deg, i) => {
                const chipProgress = spring({
                  frame: frame - 40 - i * 5,
                  fps,
                  config: SMOOTH,
                });
                const chipOpacity = interpolate(chipProgress, [0, 1], [0, 1]);
                const chipColor = i < 2 ? COLORS.success : COLORS.warning;

                return (
                  <div
                    key={i}
                    style={{
                      padding: "2px 6px",
                      borderRadius: 4,
                      backgroundColor: `${chipColor}15`,
                      border: `1px solid ${chipColor}30`,
                      opacity: chipOpacity,
                    }}
                  >
                    <span style={{ fontFamily: FONT_BODY, fontSize: 8, color: chipColor, fontWeight: 600 }}>
                      {deg}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </DeviceFrame>

        {/* Right side: Full angle readouts */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            justifyContent: "center",
          }}
        >
          {/* Section label */}
          <div
            style={{
              fontFamily: FONT_HEADING,
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.muted,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: interpolate(
                spring({ frame: frame - 15, fps, config: SMOOTH }),
                [0, 1], [0, 1]
              ),
            }}
          >
            Biomechanics
          </div>

          {READINGS.map((r) => (
            <AngleReadout
              key={r.label}
              label={r.label}
              degrees={r.degrees}
              status={r.status}
              enterDelay={r.enterDelay}
            />
          ))}

          {/* Summary */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 8,
              opacity: summaryOpacity,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: COLORS.success }} />
              <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: COLORS.muted }}>4 Optimal</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: COLORS.warning }} />
              <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: COLORS.muted }}>1 Marginal</span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
