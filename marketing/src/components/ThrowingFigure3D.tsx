import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { SMOOTH } from "../lib/spring-presets";

type Props = {
  width: number;
  height: number;
  enterDelay?: number;
  /** Slow turntable rotation in radians per frame */
  rotateSpeed?: number;
  /** Show angle arc overlays */
  showArcs?: boolean;
};

/* ─── Joint positions for shot put release pose (in 3D space) ───────────── */

const JOINT_POSITIONS: Record<string, [number, number, number]> = {
  // [x, y, z] — y is up, x is right, z is forward
  head:           [0.05, 1.72, 0.08],
  neck:           [0.0, 1.58, 0.0],
  lShoulder:      [-0.22, 1.48, -0.05],
  rShoulder:      [0.18, 1.50, 0.08],
  lElbow:         [-0.38, 1.28, -0.14],
  rElbow:         [0.38, 1.62, 0.20],
  lWrist:         [-0.48, 1.12, -0.18],
  rWrist:         [0.52, 1.76, 0.28],  // release point — highest
  spineMid:       [0.0, 1.28, 0.0],
  pelvis:         [0.0, 1.0, 0.0],
  lHip:           [-0.12, 0.95, -0.04],
  rHip:           [0.12, 0.96, 0.04],
  lKnee:          [-0.18, 0.55, -0.10],
  rKnee:          [0.14, 0.52, 0.08],
  lAnkle:         [-0.22, 0.08, -0.14],
  rAnkle:         [0.16, 0.08, 0.12],
  lFoot:          [-0.26, 0.0, -0.20],
  rFoot:          [0.20, 0.0, 0.18],
};

/* ─── Bone connections ──────────────────────────────────────────────────── */

const BONE_PAIRS: [string, string][] = [
  ["head", "neck"],
  ["neck", "lShoulder"], ["neck", "rShoulder"],
  ["lShoulder", "rShoulder"],
  ["lShoulder", "lElbow"], ["lElbow", "lWrist"],
  ["rShoulder", "rElbow"], ["rElbow", "rWrist"],
  ["neck", "spineMid"], ["spineMid", "pelvis"],
  ["pelvis", "lHip"], ["pelvis", "rHip"],
  ["lHip", "rHip"],
  ["lHip", "lKnee"], ["lKnee", "lAnkle"], ["lAnkle", "lFoot"],
  ["rHip", "rKnee"], ["rKnee", "rAnkle"], ["rAnkle", "rFoot"],
];

/* ─── Body segment meshes (low-poly volumes) ────────────────────────────── */

type BodySegment = {
  from: string;
  to: string;
  radiusTop: number;
  radiusBottom: number;
  color: string;
  emissive?: string;
};

const BODY_SEGMENTS: BodySegment[] = [
  // Torso
  { from: "neck", to: "spineMid", radiusTop: 0.10, radiusBottom: 0.12, color: "#1a3a2a", emissive: "#003311" },
  { from: "spineMid", to: "pelvis", radiusTop: 0.12, radiusBottom: 0.13, color: "#1a3a2a", emissive: "#003311" },
  // Left arm
  { from: "lShoulder", to: "lElbow", radiusTop: 0.045, radiusBottom: 0.04, color: "#1a3a2a" },
  { from: "lElbow", to: "lWrist", radiusTop: 0.04, radiusBottom: 0.03, color: "#1a3a2a" },
  // Right arm (throwing — highlighted)
  { from: "rShoulder", to: "rElbow", radiusTop: 0.05, radiusBottom: 0.045, color: "#2a4a1a", emissive: "#1a3300" },
  { from: "rElbow", to: "rWrist", radiusTop: 0.045, radiusBottom: 0.035, color: "#2a4a1a", emissive: "#1a3300" },
  // Left leg
  { from: "lHip", to: "lKnee", radiusTop: 0.06, radiusBottom: 0.05, color: "#1a3a2a" },
  { from: "lKnee", to: "lAnkle", radiusTop: 0.05, radiusBottom: 0.04, color: "#1a3a2a" },
  // Right leg (block leg — highlighted)
  { from: "rHip", to: "rKnee", radiusTop: 0.065, radiusBottom: 0.055, color: "#2a4a1a", emissive: "#1a3300" },
  { from: "rKnee", to: "rAnkle", radiusTop: 0.055, radiusBottom: 0.04, color: "#2a4a1a", emissive: "#1a3300" },
  // Shoulders bridge
  { from: "lShoulder", to: "rShoulder", radiusTop: 0.05, radiusBottom: 0.05, color: "#1a3a2a" },
  // Hip bridge
  { from: "lHip", to: "rHip", radiusTop: 0.06, radiusBottom: 0.06, color: "#1a3a2a" },
];

/* ─── Cylinder between two points ───────────────────────────────────────── */

const SegmentCylinder: React.FC<{
  from: [number, number, number];
  to: [number, number, number];
  radiusTop: number;
  radiusBottom: number;
  color: string;
  emissive?: string;
  opacity: number;
}> = ({ from, to, radiusTop, radiusBottom, color, emissive, opacity }) => {
  const { position, quaternion, length } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    dir.normalize();

    const quat = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    quat.setFromUnitVectors(up, dir);

    return { position: mid, quaternion: quat, length: len };
  }, [from, to]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radiusTop, radiusBottom, length, 6]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive || "#000000"}
        emissiveIntensity={0.3}
        transparent
        opacity={opacity}
        roughness={0.6}
        metalness={0.2}
      />
    </mesh>
  );
};

/* ─── Joint sphere ──────────────────────────────────────────────────────── */

const JointSphere: React.FC<{
  position: [number, number, number];
  radius?: number;
  color: string;
  emissive: string;
  opacity: number;
}> = ({ position, radius = 0.03, color, emissive, opacity }) => {
  return (
    <mesh position={position}>
      <icosahedronGeometry args={[radius, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={0.6}
        transparent
        opacity={opacity}
        roughness={0.3}
        metalness={0.4}
      />
    </mesh>
  );
};

/* ─── Main component ────────────────────────────────────────────────────── */

export const ThrowingFigure3D: React.FC<Props> = ({
  width,
  height,
  enterDelay = 0,
  rotateSpeed = 0.008,
  showArcs = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Global entrance
  const entranceProgress = spring({
    frame: frame - enterDelay,
    fps,
    config: SMOOTH,
  });

  // Slow turntable
  const rotationY = (frame - enterDelay) * rotateSpeed;

  // Release point glow pulse
  const glowPulse = 0.4 + Math.sin((frame - enterDelay) * 0.08) * 0.2;

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ position: [0, 1.0, 2.8], fov: 32 }}
      style={{ backgroundColor: "transparent" }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 4]} intensity={0.8} color="#ffffff" />
      <directionalLight position={[-2, 3, -2]} intensity={0.3} color="#FFC800" />
      <pointLight position={[0.52, 1.76, 0.28]} intensity={glowPulse} color="#FFC800" distance={1.5} />

      {/* Turntable group */}
      <group rotation={[0, rotationY, 0]}>
        {/* Body segments (cylinders) */}
        {BODY_SEGMENTS.map((seg, i) => {
          const segProgress = spring({
            frame: frame - enterDelay - i * 1.5,
            fps,
            config: SMOOTH,
          });
          const opacity = interpolate(segProgress, [0, 1], [0, 0.85]);

          return (
            <SegmentCylinder
              key={`seg-${i}`}
              from={JOINT_POSITIONS[seg.from]}
              to={JOINT_POSITIONS[seg.to]}
              radiusTop={seg.radiusTop}
              radiusBottom={seg.radiusBottom}
              color={seg.color}
              emissive={seg.emissive}
              opacity={opacity}
            />
          );
        })}

        {/* Joint spheres */}
        {Object.entries(JOINT_POSITIONS).map(([name, pos], i) => {
          const jointProgress = spring({
            frame: frame - enterDelay - i * 1,
            fps,
            config: SMOOTH,
          });
          const opacity = interpolate(jointProgress, [0, 1], [0, 0.95]);
          const isRelease = name === "rWrist";
          const isHead = name === "head";

          return (
            <JointSphere
              key={name}
              position={pos}
              radius={isHead ? 0.08 : isRelease ? 0.04 : 0.03}
              color={isRelease ? "#FFC800" : "#00FF88"}
              emissive={isRelease ? "#FFC800" : "#00BB66"}
              opacity={opacity}
            />
          );
        })}

        {/* Wireframe bone overlay for tech look */}
        {BONE_PAIRS.map(([a, b], i) => {
          const wireProgress = spring({
            frame: frame - enterDelay - 10 - i * 0.8,
            fps,
            config: SMOOTH,
          });
          const opacity = interpolate(wireProgress, [0, 1], [0, 0.4]);

          const from = JOINT_POSITIONS[a];
          const to = JOINT_POSITIONS[b];
          const points = [new THREE.Vector3(...from), new THREE.Vector3(...to)];
          const geometry = new THREE.BufferGeometry().setFromPoints(points);

          return (
            <lineSegments key={`wire-${i}`} geometry={geometry}>
              <lineBasicMaterial color="#00FF88" transparent opacity={opacity} />
            </lineSegments>
          );
        })}

        {/* Release point glow sphere */}
        <mesh position={JOINT_POSITIONS.rWrist}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial
            color="#FFC800"
            transparent
            opacity={interpolate(entranceProgress, [0, 1], [0, glowPulse * 0.3])}
          />
        </mesh>

        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <circleGeometry args={[0.6, 32]} />
          <meshStandardMaterial
            color="#0a0a0c"
            transparent
            opacity={interpolate(entranceProgress, [0, 1], [0, 0.5])}
          />
        </mesh>

        {/* Angle arc rings */}
        {showArcs && (() => {
          const arcProgress = spring({
            frame: frame - enterDelay - 25,
            fps,
            config: SMOOTH,
          });
          const arcOpacity = interpolate(arcProgress, [0, 1], [0, 0.5]);

          return (
            <>
              {/* Block knee angle ring */}
              <mesh position={JOINT_POSITIONS.rKnee} rotation={[0, 0, Math.PI / 6]}>
                <torusGeometry args={[0.12, 0.005, 8, 16, Math.PI * 0.85]} />
                <meshBasicMaterial color="#FF8800" transparent opacity={arcOpacity} />
              </mesh>
              {/* Elbow angle ring */}
              <mesh position={JOINT_POSITIONS.rElbow} rotation={[Math.PI / 4, 0, 0]}>
                <torusGeometry args={[0.10, 0.005, 8, 16, Math.PI * 0.78]} />
                <meshBasicMaterial color="#00FF88" transparent opacity={arcOpacity} />
              </mesh>
            </>
          );
        })()}
      </group>
    </ThreeCanvas>
  );
};
