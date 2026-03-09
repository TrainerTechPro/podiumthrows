import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../theme";
import { bodyFont } from "../fonts";

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 14 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.5, 1]);
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);

  const subSpring = spring({ frame, fps, config: { damping: 200 }, delay: 18 });
  const subY = interpolate(subSpring, [0, 1], [24, 0]);
  const subOpacity = interpolate(subSpring, [0, 1], [0, 1]);

  const lineSpring = spring({ frame, fps, config: { damping: 200 }, delay: 30 });
  const lineWidth = interpolate(lineSpring, [0, 1], [0, 200]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Img
          src={staticFile("podium-throws-logo.png")}
          style={{ width: 680, height: 680, objectFit: "contain" }}
        />
      </div>

      {/* Decorative line */}
      <div
        style={{
          width: lineWidth,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${COLORS.primary}, transparent)`,
          marginTop: -30,
          marginBottom: 24,
        }}
      />

      {/* Subtitle */}
      <div
        style={{
          textAlign: "center",
          transform: `translateY(${subY}px)`,
          opacity: subOpacity,
        }}
      >
        <p
          style={{
            fontFamily: bodyFont,
            fontSize: 34,
            fontWeight: 600,
            color: COLORS.primaryLight,
            margin: 0,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Coach Onboarding
        </p>
      </div>
    </AbsoluteFill>
  );
};
