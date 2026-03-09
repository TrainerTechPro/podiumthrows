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
import { COLORS } from "../../theme";
import { headingFont, bodyFont } from "../../fonts";

export const AthleteOutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const iconSpring = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });
  const iconScale = interpolate(iconSpring, [0, 1], [0, 1]);

  const titleSpring = spring({ frame, fps, config: { damping: 200 }, delay: 12 });
  const titleY = interpolate(titleSpring, [0, 1], [40, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const subSpring = spring({ frame, fps, config: { damping: 200 }, delay: 22 });
  const subOpacity = interpolate(subSpring, [0, 1], [0, 1]);

  const logoSpring = spring({ frame, fps, config: { damping: 200 }, delay: 40 });
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 36 }}>
      {/* Glow */}
      <div style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", background: `radial-gradient(circle, rgba(245,158,11,0.12), transparent)`, opacity: interpolate(frame % 60, [0, 30, 60], [0.4, 0.8, 0.4]), transform: `scale(${iconScale})` }} />

      {/* Rocket icon */}
      <div style={{ width: 120, height: 120, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${iconScale})`, boxShadow: `0 12px 40px ${COLORS.primaryGlow}` }}>
        <span style={{ fontSize: 56, lineHeight: 1 }}>&#127942;</span>
      </div>

      {/* Title */}
      <div style={{ textAlign: "center", transform: `translateY(${titleY}px)`, opacity: titleOpacity, padding: "0 50px" }}>
        <h1 style={{ fontFamily: headingFont, fontSize: 62, fontWeight: 800, color: COLORS.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Ready to{"\n"}compete.
        </h1>
      </div>

      {/* Subtitle */}
      <div style={{ textAlign: "center", opacity: subOpacity, padding: "0 60px" }}>
        <p style={{ fontFamily: bodyFont, fontSize: 28, fontWeight: 500, color: COLORS.textMuted, margin: 0, lineHeight: 1.4 }}>
          From invite to dashboard{"\n"}in under 3 minutes.
        </p>
      </div>

      {/* Logo */}
      <div style={{ opacity: logoOpacity, marginTop: 24 }}>
        <Img src={staticFile("podium-throws-logo.png")} style={{ width: 160, height: 160, objectFit: "contain", opacity: 0.6 }} />
      </div>
    </AbsoluteFill>
  );
};
