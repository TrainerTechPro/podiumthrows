import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SMOOTH } from "../lib/spring-presets";

type Props = {
  width?: number;
  height?: number;
  enterDelay?: number;
  children: React.ReactNode;
};

/**
 * iPhone 17 Pro Max device frame mockup.
 * Screen aspect ratio ~19.5:9 (2868×1320 logical → we use a simplified bezel).
 */
export const DeviceFrame: React.FC<Props> = ({
  width = 320,
  height = 692,
  enterDelay = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - enterDelay,
    fps,
    config: SMOOTH,
  });

  const scale = interpolate(progress, [0, 1], [0.92, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  const bezelRadius = width * 0.14;  // ~44px at 320w
  const bezelWidth = width * 0.012;  // ~4px
  const dynamicIslandW = width * 0.3;
  const dynamicIslandH = height * 0.016;
  const dynamicIslandY = height * 0.012;

  // Screen inset from bezel
  const screenInset = bezelWidth + 2;

  return (
    <div
      style={{
        width,
        height,
        transform: `scale(${scale})`,
        opacity,
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* Outer bezel (titanium frame) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: bezelRadius,
          background: "linear-gradient(145deg, #2a2a2e 0%, #1a1a1e 50%, #2a2a2e 100%)",
          border: `${bezelWidth}px solid #3a3a40`,
          boxShadow:
            "0 8px 40px rgba(0,0,0,0.6), " +
            "0 2px 8px rgba(0,0,0,0.4), " +
            "inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      />

      {/* Inner bezel highlight */}
      <div
        style={{
          position: "absolute",
          inset: bezelWidth,
          borderRadius: bezelRadius - bezelWidth,
          border: "0.5px solid rgba(255,255,255,0.06)",
          pointerEvents: "none",
        }}
      />

      {/* Screen area */}
      <div
        style={{
          position: "absolute",
          top: screenInset,
          left: screenInset,
          right: screenInset,
          bottom: screenInset,
          borderRadius: bezelRadius - screenInset,
          overflow: "hidden",
          backgroundColor: "#0a0a0c",
        }}
      >
        {children}
      </div>

      {/* Dynamic Island */}
      <div
        style={{
          position: "absolute",
          top: screenInset + dynamicIslandY,
          left: "50%",
          transform: "translateX(-50%)",
          width: dynamicIslandW,
          height: dynamicIslandH,
          borderRadius: dynamicIslandH / 2,
          backgroundColor: "#000000",
          zIndex: 10,
          boxShadow: "0 0 4px rgba(0,0,0,0.5)",
        }}
      />

      {/* Side button (right) */}
      <div
        style={{
          position: "absolute",
          right: -bezelWidth - 1.5,
          top: height * 0.25,
          width: 3,
          height: height * 0.08,
          borderRadius: 1.5,
          backgroundColor: "#3a3a40",
        }}
      />

      {/* Volume buttons (left) */}
      <div
        style={{
          position: "absolute",
          left: -bezelWidth - 1.5,
          top: height * 0.2,
          width: 3,
          height: height * 0.045,
          borderRadius: 1.5,
          backgroundColor: "#3a3a40",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -bezelWidth - 1.5,
          top: height * 0.27,
          width: 3,
          height: height * 0.045,
          borderRadius: 1.5,
          backgroundColor: "#3a3a40",
        }}
      />
    </div>
  );
};
