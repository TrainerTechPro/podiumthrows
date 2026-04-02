import "../style.css";
import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, cutCornerClipPath } from "../lib/tokens";
import { FONT_HEADING, FONT_BODY, FONT_MONO } from "../lib/fonts";
import { Background } from "../components/Background";

/* ─── Static stat card data ─────────────────────────────────────────────── */

const STAT_CARDS = [
  { value: "47", label: "Analyses" },
  { value: "8.2", label: "Readiness" },
  { value: "12", label: "PRs" },
];

/* ─── Simple static skeleton wireframe ──────────────────────────────────── */

const JOINTS = [
  { cx: 40, cy: 10 },  // head
  { cx: 22, cy: 38 },  // left shoulder
  { cx: 58, cy: 38 },  // right shoulder
  { cx: 14, cy: 58 },  // left elbow
  { cx: 66, cy: 58 },  // right elbow
  { cx: 10, cy: 78 },  // left hand
  { cx: 70, cy: 78 },  // right hand
  { cx: 30, cy: 72 },  // left hip
  { cx: 50, cy: 72 },  // right hip
  { cx: 26, cy: 96 },  // left knee
  { cx: 54, cy: 96 },  // right knee
  { cx: 22, cy: 118 }, // left ankle
  { cx: 58, cy: 118 }, // right ankle
];

const BONES: [number, number][] = [
  [0, 1], [0, 2],
  [1, 2],
  [1, 3], [3, 5],
  [2, 4], [4, 6],
  [1, 7], [2, 8],
  [7, 8],
  [7, 9], [9, 11],
  [8, 10], [10, 12],
];

const MiniSkeleton: React.FC = () => (
  <svg viewBox="0 0 80 128" width={120} height={160} fill="none">
    {BONES.map(([a, b], i) => (
      <line
        key={`bone-${i}`}
        x1={JOINTS[a].cx}
        y1={JOINTS[a].cy}
        x2={JOINTS[b].cx}
        y2={JOINTS[b].cy}
        stroke={COLORS.success}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.6}
      />
    ))}
    {JOINTS.map((j, i) => (
      <circle
        key={`joint-${i}`}
        cx={j.cx}
        cy={j.cy}
        r={i === 0 ? 6 : 3}
        fill={i === 0 ? "none" : COLORS.success}
        stroke={i === 0 ? COLORS.success : "none"}
        strokeWidth={i === 0 ? 1.5 : 0}
        opacity={0.85}
      />
    ))}
  </svg>
);

/* ─── Thumbnail: Still composition (1280x720, frame 0 only) ─────────────── */

export const Thumbnail: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background vignette vignetteIntensity={0.1} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 80px",
        }}
      >
        {/* Left third: PODIUM / THROWS */}
        <div
          style={{
            flex: "0 0 300px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 2,
          }}
        >
          <span
            style={{
              fontFamily: FONT_HEADING,
              fontSize: 48,
              fontWeight: 700,
              color: COLORS.gold,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              textShadow: "0 0 30px rgba(255,200,0,0.2)",
            }}
          >
            PODIUM
          </span>
          <span
            style={{
              fontFamily: FONT_HEADING,
              fontSize: 32,
              fontWeight: 600,
              color: COLORS.gold,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            THROWS
          </span>
          {/* Gold underline */}
          <div
            style={{
              width: 200,
              height: 2,
              backgroundColor: COLORS.gold,
              marginTop: 10,
              opacity: 0.7,
            }}
          />
        </div>

        {/* Center: Fanned stat cards */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
            height: "100%",
          }}
        >
          {STAT_CARDS.map((stat, i) => {
            const rotation = (i - 1) * 5; // -5, 0, 5
            const xOffset = (i - 1) * 110;
            const yOffset = Math.abs(i - 1) * 8;

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  transform: `translateX(${xOffset}px) translateY(${yOffset}px) rotate(${rotation}deg)`,
                  width: 160,
                  clipPath: cutCornerClipPath(10),
                  backgroundColor: COLORS.cardBg,
                  border: `1px solid ${COLORS.cardBorder}`,
                  padding: "24px 16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 36,
                    fontWeight: 500,
                    color: COLORS.gold,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {stat.value}
                </span>
                <span
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 13,
                    fontWeight: 500,
                    color: COLORS.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {stat.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right third: Mini skeleton wireframe + angle labels */}
        <div
          style={{
            flex: "0 0 260px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          <MiniSkeleton />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Angle label 1 */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: COLORS.success,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  color: COLORS.muted,
                }}
              >
                Shoulder
              </span>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 14,
                  fontWeight: 500,
                  color: COLORS.foreground,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                42°
              </span>
            </div>

            {/* Angle label 2 */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: COLORS.warning,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  color: COLORS.muted,
                }}
              >
                Block Knee
              </span>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 14,
                  fontWeight: 500,
                  color: COLORS.foreground,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                156°
              </span>
            </div>
          </div>
        </div>
      </AbsoluteFill>

      {/* Bottom center: URL */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: FONT_BODY,
            fontSize: 18,
            fontWeight: 400,
            color: COLORS.muted,
          }}
        >
          podiumthrows.com
        </span>
      </div>
    </AbsoluteFill>
  );
};
