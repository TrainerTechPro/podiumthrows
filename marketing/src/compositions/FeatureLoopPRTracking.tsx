import "../style.css";
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS, cutCornerClipPath } from "../lib/tokens";
import { FONT_HEADING, FONT_BODY, FONT_MONO } from "../lib/fonts";
import { SMOOTH, SNAPPY, BOUNCY } from "../lib/spring-presets";
import { Background } from "../components/Background";
import { GoldText } from "../components/GoldText";
import { DataReveal } from "../components/DataReveal";
import { ConfettiBurst } from "../components/ConfettiBurst";

/* ─── Chart data ────────────────────────────────────────────────────────── */

const POINTS = [
  { x: 100, y: 300 },
  { x: 250, y: 260 },
  { x: 400, y: 240 },
  { x: 550, y: 200 },
  { x: 700, y: 160 },
];

function buildPathD(points: { x: number; y: number }[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
}

const PATH_D = buildPathD(POINTS);

/* Approximate total path length for dasharray animation */
const TOTAL_LENGTH = 720;

/* ─── Main Composition ──────────────────────────────────────────────────── */

export const FeatureLoopPRTracking: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Loop fade bookends
  const loopOpacity = interpolate(
    frame,
    [0, 15, 225, 240],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Line chart draw-in: frame 15-75
  const drawProgress = interpolate(frame, [15, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dashOffset = TOTAL_LENGTH * (1 - drawProgress);

  // Last point circle: scales up at frame 60-90
  const dotProgress = spring({
    frame: frame - 60,
    fps,
    config: BOUNCY,
  });
  const dotScale = interpolate(dotProgress, [0, 1], [0, 1.2]);
  const dotOpacity = interpolate(dotProgress, [0, 1], [0, 1]);

  // NEW PR badge: springs in at frame 70
  const badgeProgress = spring({
    frame: frame - 70,
    fps,
    config: SNAPPY,
  });
  const badgeScale = interpolate(badgeProgress, [0, 1], [0.5, 1]);
  const badgeOpacity = interpolate(badgeProgress, [0, 1], [0, 1]);

  // Center distance reveal: frame 75-150
  const distanceOpacity = interpolate(frame, [75, 85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Season best text: frame 135-210
  const seasonProgress = spring({
    frame: frame - 135,
    fps,
    config: SMOOTH,
  });
  const seasonOpacity = interpolate(seasonProgress, [0, 1], [0, 1]);
  const seasonY = interpolate(seasonProgress, [0, 1], [15, 0]);

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
          <GoldText text="PERSONAL RECORDS" fontSize={52} enterDelay={0} />
        </div>

        {/* SVG line chart */}
        <div
          style={{
            marginTop: 20,
            position: "relative",
            width: 800,
            height: 400,
          }}
        >
          <svg viewBox="0 0 800 400" width={800} height={400} fill="none">
            {/* Grid lines */}
            {[100, 200, 300].map((y) => (
              <line
                key={y}
                x1={60}
                y1={y}
                x2={740}
                y2={y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={1}
              />
            ))}

            {/* Trend line */}
            <path
              d={PATH_D}
              stroke={COLORS.gold}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={TOTAL_LENGTH}
              strokeDashoffset={dashOffset}
            />

            {/* Data point dots (visible after line reaches them) */}
            {POINTS.slice(0, -1).map((p, i) => {
              const pointVisible = interpolate(
                frame,
                [15 + (i / (POINTS.length - 1)) * 60, 15 + (i / (POINTS.length - 1)) * 60 + 5],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill={COLORS.gold}
                  opacity={pointVisible}
                />
              );
            })}

            {/* Last point — gold circle that scales up */}
            <circle
              cx={POINTS[POINTS.length - 1].x}
              cy={POINTS[POINTS.length - 1].y}
              r={8}
              fill={COLORS.gold}
              opacity={dotOpacity}
              transform={`translate(${POINTS[POINTS.length - 1].x * (1 - dotScale)}, ${POINTS[POINTS.length - 1].y * (1 - dotScale)}) scale(${dotScale})`}
              style={{
                transformOrigin: `${POINTS[POINTS.length - 1].x}px ${POINTS[POINTS.length - 1].y}px`,
              }}
            />

            {/* Glow on last point */}
            <circle
              cx={POINTS[POINTS.length - 1].x}
              cy={POINTS[POINTS.length - 1].y}
              r={16}
              fill="none"
              stroke={COLORS.gold}
              strokeWidth={2}
              opacity={dotOpacity * 0.3}
              transform={`translate(${POINTS[POINTS.length - 1].x * (1 - dotScale)}, ${POINTS[POINTS.length - 1].y * (1 - dotScale)}) scale(${dotScale})`}
              style={{
                transformOrigin: `${POINTS[POINTS.length - 1].x}px ${POINTS[POINTS.length - 1].y}px`,
              }}
            />
          </svg>

          {/* NEW PR badge — positioned near last point */}
          <div
            style={{
              position: "absolute",
              top: POINTS[POINTS.length - 1].y - 55,
              left: POINTS[POINTS.length - 1].x - 30,
              opacity: badgeOpacity,
              transform: `scale(${badgeScale})`,
            }}
          >
            <div
              style={{
                clipPath: cutCornerClipPath(6),
                backgroundColor: COLORS.gold,
                padding: "4px 14px",
              }}
            >
              <span
                style={{
                  fontFamily: FONT_HEADING,
                  fontSize: 13,
                  fontWeight: 700,
                  color: COLORS.background,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                NEW PR
              </span>
            </div>
          </div>
        </div>

        {/* Center: Distance reveal with confetti */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: distanceOpacity,
            marginTop: -10,
          }}
        >
          <ConfettiBurst triggerFrame={80} particleCount={50} />
          <DataReveal
            value={18.42}
            suffix="m"
            decimals={2}
            fontSize={72}
            enterDelay={75}
            countDuration={40}
          />
        </div>

        {/* Season best + improvement */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            opacity: seasonOpacity,
            transform: `translateY(${seasonY}px)`,
          }}
        >
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 22,
              fontWeight: 500,
              color: COLORS.foreground,
            }}
          >
            Season Best: Shot Put
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 18,
                fontWeight: 600,
                color: COLORS.success,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ↑ 0.34m
            </span>
            <span
              style={{
                fontFamily: FONT_BODY,
                fontSize: 16,
                color: COLORS.muted,
              }}
            >
              improvement
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
