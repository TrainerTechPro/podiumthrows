import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../lib/tokens";
import { SMOOTH } from "../lib/spring-presets";

type Props = {
  width?: number;
  height?: number;
  enterDelay?: number;
  color?: string;
};

const JOINTS = [
  { cx: 40, cy: 10, r: 8 },    // head
  { cx: 22, cy: 38 },           // left shoulder
  { cx: 58, cy: 38 },           // right shoulder
  { cx: 14, cy: 58 },           // left elbow
  { cx: 66, cy: 58 },           // right elbow
  { cx: 10, cy: 78 },           // left hand
  { cx: 70, cy: 78 },           // right hand
  { cx: 30, cy: 72 },           // left hip
  { cx: 50, cy: 72 },           // right hip
  { cx: 26, cy: 96 },           // left knee
  { cx: 54, cy: 96 },           // right knee
  { cx: 22, cy: 118 },          // left ankle
  { cx: 58, cy: 118 },          // right ankle
];

const BONES: [number, number][] = [
  [0, 1], [0, 2],      // neck to shoulders
  [1, 2],              // shoulder bridge
  [1, 3], [3, 5],     // left arm
  [2, 4], [4, 6],     // right arm
  [1, 7], [2, 8],     // torso sides
  [7, 8],              // hip bridge
  [7, 9], [9, 11],    // left leg
  [8, 10], [10, 12],  // right leg
];

export const SkeletonWireframe: React.FC<Props> = ({
  width = 200,
  height = 300,
  enterDelay = 0,
  color = COLORS.success,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <svg viewBox="0 0 80 128" width={width} height={height} fill="none">
      {/* Bones — draw in with stagger */}
      {BONES.map(([a, b], i) => {
        const progress = spring({
          frame: frame - enterDelay - i * 2,
          fps,
          config: SMOOTH,
        });
        const opacity = interpolate(progress, [0, 1], [0, 0.6]);

        return (
          <line
            key={`bone-${i}`}
            x1={JOINTS[a].cx}
            y1={JOINTS[a].cy}
            x2={JOINTS[b].cx}
            y2={JOINTS[b].cy}
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={opacity}
          />
        );
      })}

      {/* Joints — pulse in with stagger */}
      {JOINTS.map((joint, i) => {
        const progress = spring({
          frame: frame - enterDelay - i * 2,
          fps,
          config: SMOOTH,
        });
        const scale = interpolate(progress, [0, 1], [0, 1]);
        const opacity = interpolate(progress, [0, 1], [0, 0.9]);

        return (
          <circle
            key={`joint-${i}`}
            cx={joint.cx}
            cy={joint.cy}
            r={joint.r || 3}
            fill={i === 0 ? "none" : color}
            stroke={i === 0 ? color : "none"}
            strokeWidth={i === 0 ? 1.5 : 0}
            opacity={opacity}
            transform={`translate(${joint.cx * (1 - scale) } ${joint.cy * (1 - scale)}) scale(${scale})`}
            style={{ transformOrigin: `${joint.cx}px ${joint.cy}px` }}
          />
        );
      })}

      {/* Angle arc hint at right elbow */}
      <path
        d="M 62 53 A 6 6 0 0 1 69 63"
        stroke={COLORS.gold}
        strokeWidth={1}
        strokeDasharray="2 2"
        opacity={interpolate(
          spring({ frame: frame - enterDelay - 20, fps, config: SMOOTH }),
          [0, 1],
          [0, 0.5]
        )}
      />
    </svg>
  );
};
