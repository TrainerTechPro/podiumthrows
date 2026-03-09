import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

type PhoneMockupProps = {
  children: React.ReactNode;
  enterDelay?: number;
};

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  children,
  enterDelay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - enterDelay,
    fps,
    config: { damping: 200 },
  });

  const scale = interpolate(entrance, [0, 1], [0.92, 1]);
  const y = interpolate(entrance, [0, 1], [30, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    <div
      style={{
        width: 480,
        height: 960,
        borderRadius: 52,
        background: "#111110",
        overflow: "hidden",
        position: "relative",
        transform: `scale(${scale}) translateY(${y}px)`,
        opacity,
        boxShadow: `
          0 0 0 3px #2a2826,
          0 0 0 5px #1a1917,
          0 40px 80px -20px rgba(0,0,0,0.8),
          0 0 120px -40px rgba(245,158,11,0.12)
        `,
        flexShrink: 0,
      }}
    >
      {/* Status bar area */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            width: 120,
            height: 32,
            borderRadius: 16,
            background: "#000",
            marginTop: 8,
          }}
        />
      </div>
      {/* Home indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: "50%",
          transform: "translateX(-50%)",
          width: 140,
          height: 5,
          borderRadius: 3,
          background: "rgba(255,255,255,0.15)",
          zIndex: 10,
        }}
      />
      {/* Screen */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: "hidden",
          borderRadius: 52,
        }}
      >
        {children}
      </div>
    </div>
  );
};
