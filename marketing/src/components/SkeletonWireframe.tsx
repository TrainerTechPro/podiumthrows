import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../lib/tokens";
import { SMOOTH, SNAPPY } from "../lib/spring-presets";

type Props = {
  width?: number;
  height?: number;
  enterDelay?: number;
  color?: string;
  /** "standing" = neutral T-pose, "throwing" = shot put release position */
  pose?: "standing" | "throwing";
};

/* ─── Joint definitions ─────────────────────────────────────────────────── */

type Joint = { cx: number; cy: number; r?: number; label?: string };

const STANDING_JOINTS: Joint[] = [
  { cx: 50, cy: 12, r: 9 },     // 0  head
  { cx: 50, cy: 24 },            // 1  neck
  { cx: 34, cy: 32 },            // 2  left shoulder
  { cx: 66, cy: 32 },            // 3  right shoulder
  { cx: 24, cy: 50 },            // 4  left elbow
  { cx: 76, cy: 50 },            // 5  right elbow
  { cx: 16, cy: 68 },            // 6  left wrist
  { cx: 84, cy: 68 },            // 7  right wrist
  { cx: 50, cy: 52 },            // 8  spine mid
  { cx: 50, cy: 68 },            // 9  pelvis
  { cx: 38, cy: 70 },            // 10 left hip
  { cx: 62, cy: 70 },            // 11 right hip
  { cx: 34, cy: 92 },            // 12 left knee
  { cx: 66, cy: 92 },            // 13 right knee
  { cx: 30, cy: 114 },           // 14 left ankle
  { cx: 70, cy: 114 },           // 15 right ankle
  { cx: 26, cy: 118 },           // 16 left foot
  { cx: 74, cy: 118 },           // 17 right foot
];

// Shot putter at release — right arm extended forward-up, left arm back,
// torso rotated, rear leg driving, front leg braced
const THROWING_JOINTS: Joint[] = [
  { cx: 52, cy: 18, r: 9 },     // 0  head (slightly forward)
  { cx: 48, cy: 30 },            // 1  neck
  { cx: 36, cy: 36 },            // 2  left shoulder
  { cx: 60, cy: 33 },            // 3  right shoulder (raised, rotated)
  { cx: 24, cy: 46 },            // 4  left elbow (arm trailing back)
  { cx: 72, cy: 22 },            // 5  right elbow (arm extending up-forward)
  { cx: 14, cy: 52 },            // 6  left wrist (trailing)
  { cx: 82, cy: 14 },            // 7  right wrist (release point — highest)
  { cx: 46, cy: 50 },            // 8  spine mid (rotated)
  { cx: 44, cy: 66 },            // 9  pelvis
  { cx: 36, cy: 68 },            // 10 left hip
  { cx: 54, cy: 66 },            // 11 right hip
  { cx: 28, cy: 88 },            // 12 left knee (rear leg, driving)
  { cx: 58, cy: 84 },            // 13 right knee (front/block leg, braced)
  { cx: 20, cy: 108 },           // 14 left ankle (rear)
  { cx: 62, cy: 108 },           // 15 right ankle (block)
  { cx: 16, cy: 112 },           // 16 left foot
  { cx: 68, cy: 112 },           // 17 right foot (planted)
];

/* ─── Bone connections ──────────────────────────────────────────────────── */

const BONES: [number, number][] = [
  [0, 1],                         // head to neck
  [1, 2], [1, 3],                // neck to shoulders
  [2, 3],                         // shoulder bridge
  [2, 4], [4, 6],                // left arm
  [3, 5], [5, 7],                // right arm
  [1, 8], [8, 9],                // spine
  [9, 10], [9, 11],              // pelvis to hips
  [10, 11],                       // hip bridge
  [10, 12], [12, 14],            // left leg
  [11, 13], [13, 15],            // right leg
  [14, 16],                       // left foot
  [15, 17],                       // right foot
];

/* ─── Angle arcs for throwing pose ──────────────────────────────────────── */

type AngleArc = {
  center: number;    // joint index
  from: number;      // connected joint A
  to: number;        // connected joint B
  label: string;
  degrees: number;
  status: "optimal" | "marginal" | "concerning";
  radius: number;
  labelOffset: { x: number; y: number };
};

const THROWING_ARCS: AngleArc[] = [
  {
    center: 13,      // right knee (block leg)
    from: 11,        // right hip
    to: 15,          // right ankle
    label: "156°",
    degrees: 156,
    status: "marginal",
    radius: 10,
    labelOffset: { x: 12, y: 0 },
  },
  {
    center: 5,       // right elbow
    from: 3,         // right shoulder
    to: 7,           // right wrist
    label: "142°",
    degrees: 142,
    status: "optimal",
    radius: 9,
    labelOffset: { x: 8, y: -6 },
  },
  {
    center: 8,       // spine mid (torso lean)
    from: 1,         // neck
    to: 9,           // pelvis
    label: "38°",
    degrees: 38,
    status: "optimal",
    radius: 12,
    labelOffset: { x: -18, y: 0 },
  },
];

/* ─── Status colors ─────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  optimal: COLORS.success,
  marginal: COLORS.warning,
  concerning: COLORS.danger,
};

/* ─── Angle arc SVG path helper ─────────────────────────────────────────── */

function arcPath(
  cx: number, cy: number,
  fromX: number, fromY: number,
  toX: number, toY: number,
  radius: number,
): string {
  // Normalize directions from center to from/to
  const a1 = Math.atan2(fromY - cy, fromX - cx);
  const a2 = Math.atan2(toY - cy, toX - cx);

  const x1 = cx + Math.cos(a1) * radius;
  const y1 = cy + Math.sin(a1) * radius;
  const x2 = cx + Math.cos(a2) * radius;
  const y2 = cy + Math.sin(a2) * radius;

  // Determine if we should use the large arc
  let diff = a2 - a1;
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  const largeArc = Math.abs(diff) > Math.PI ? 1 : 0;
  const sweep = diff > 0 ? 1 : 0;

  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export const SkeletonWireframe: React.FC<Props> = ({
  width = 200,
  height = 300,
  enterDelay = 0,
  color = COLORS.success,
  pose = "throwing",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const joints = pose === "throwing" ? THROWING_JOINTS : STANDING_JOINTS;
  const arcs = pose === "throwing" ? THROWING_ARCS : [];

  return (
    <svg viewBox="0 0 100 128" width={width} height={height} fill="none">
      {/* Ground shadow */}
      <ellipse
        cx="44"
        cy="120"
        rx="30"
        ry="3"
        fill={color}
        opacity={interpolate(
          spring({ frame: frame - enterDelay - 10, fps, config: SMOOTH }),
          [0, 1], [0, 0.08]
        )}
      />

      {/* Muscle tension zones — translucent fills on torso and throwing arm */}
      {pose === "throwing" && (
        <>
          {/* Torso mass */}
          <polygon
            points={`${joints[2].cx},${joints[2].cy} ${joints[3].cx},${joints[3].cy} ${joints[11].cx},${joints[11].cy} ${joints[10].cx},${joints[10].cy}`}
            fill={color}
            opacity={interpolate(
              spring({ frame: frame - enterDelay - 8, fps, config: SMOOTH }),
              [0, 1], [0, 0.06]
            )}
          />
          {/* Right upper arm highlight */}
          <line
            x1={joints[3].cx} y1={joints[3].cy}
            x2={joints[5].cx} y2={joints[5].cy}
            stroke={COLORS.gold}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={interpolate(
              spring({ frame: frame - enterDelay - 14, fps, config: SMOOTH }),
              [0, 1], [0, 0.15]
            )}
          />
          {/* Block leg highlight */}
          <line
            x1={joints[11].cx} y1={joints[11].cy}
            x2={joints[13].cx} y2={joints[13].cy}
            stroke={COLORS.gold}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={interpolate(
              spring({ frame: frame - enterDelay - 16, fps, config: SMOOTH }),
              [0, 1], [0, 0.12]
            )}
          />
        </>
      )}

      {/* Bones — draw in with stagger */}
      {BONES.map(([a, b], i) => {
        const progress = spring({
          frame: frame - enterDelay - i * 1.5,
          fps,
          config: SMOOTH,
        });
        const opacity = interpolate(progress, [0, 1], [0, 0.7]);

        return (
          <line
            key={`bone-${i}`}
            x1={joints[a].cx}
            y1={joints[a].cy}
            x2={joints[b].cx}
            y2={joints[b].cy}
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            opacity={opacity}
          />
        );
      })}

      {/* Joints — scale in with stagger */}
      {joints.map((joint, i) => {
        const progress = spring({
          frame: frame - enterDelay - i * 1.5,
          fps,
          config: SMOOTH,
        });
        const opacity = interpolate(progress, [0, 1], [0, 1]);
        const r = joint.r || 2.5;
        const isHead = i === 0;

        return (
          <circle
            key={`joint-${i}`}
            cx={joint.cx}
            cy={joint.cy}
            r={r * interpolate(progress, [0, 1], [0, 1])}
            fill={isHead ? "none" : color}
            stroke={isHead ? color : "none"}
            strokeWidth={isHead ? 1.5 : 0}
            opacity={opacity}
          />
        );
      })}

      {/* Release point glow (throwing pose — right wrist) */}
      {pose === "throwing" && (() => {
        const glowProgress = spring({
          frame: frame - enterDelay - 25,
          fps,
          config: SNAPPY,
        });
        const glowR = interpolate(glowProgress, [0, 1], [0, 8]);
        const glowOpacity = interpolate(glowProgress, [0, 1], [0, 0.3]);

        return (
          <circle
            cx={joints[7].cx}
            cy={joints[7].cy}
            r={glowR}
            fill={COLORS.gold}
            opacity={glowOpacity}
          />
        );
      })()}

      {/* Angle arcs */}
      {arcs.map((arc, i) => {
        const arcProgress = spring({
          frame: frame - enterDelay - 30 - i * 8,
          fps,
          config: SMOOTH,
        });
        const opacity = interpolate(arcProgress, [0, 1], [0, 0.7]);

        const center = joints[arc.center];
        const from = joints[arc.from];
        const to = joints[arc.to];
        const d = arcPath(center.cx, center.cy, from.cx, from.cy, to.cx, to.cy, arc.radius);
        const arcColor = STATUS_COLORS[arc.status];

        return (
          <g key={`arc-${i}`} opacity={opacity}>
            {/* Arc line */}
            <path
              d={d}
              stroke={arcColor}
              strokeWidth={1.2}
              strokeDasharray="2 1.5"
              fill="none"
            />
            {/* Degree label */}
            <rect
              x={center.cx + arc.labelOffset.x - 10}
              y={center.cy + arc.labelOffset.y - 5}
              width={20}
              height={10}
              rx={2}
              fill="rgba(0,0,0,0.7)"
            />
            <text
              x={center.cx + arc.labelOffset.x}
              y={center.cy + arc.labelOffset.y + 3}
              textAnchor="middle"
              fontSize={7}
              fontFamily="monospace"
              fontWeight={600}
              fill={arcColor}
            >
              {arc.label}
            </text>
          </g>
        );
      })}

      {/* Motion trail on throwing arm (speed lines) */}
      {pose === "throwing" && (() => {
        const trailProgress = spring({
          frame: frame - enterDelay - 20,
          fps,
          config: SMOOTH,
        });
        const trailOpacity = interpolate(trailProgress, [0, 1], [0, 0.2]);

        return (
          <g opacity={trailOpacity}>
            <line x1={72} y1={24} x2={86} y2={12} stroke={color} strokeWidth={0.5} strokeDasharray="1 2" />
            <line x1={74} y1={26} x2={88} y2={16} stroke={color} strokeWidth={0.5} strokeDasharray="1 2" />
            <line x1={76} y1={20} x2={90} y2={10} stroke={color} strokeWidth={0.5} strokeDasharray="1 2" />
          </g>
        );
      })()}
    </svg>
  );
};
