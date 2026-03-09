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
import { headingFont, bodyFont } from "../fonts";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const checkSpring = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });
  const checkScale = interpolate(checkSpring, [0, 1], [0, 1]);

  const titleSpring = spring({ frame, fps, config: { damping: 200 }, delay: 12 });
  const titleY = interpolate(titleSpring, [0, 1], [40, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  const subSpring = spring({ frame, fps, config: { damping: 200 }, delay: 22 });
  const subOpacity = interpolate(subSpring, [0, 1], [0, 1]);

  const ctaSpring = spring({ frame, fps, config: { damping: 15, stiffness: 120 }, delay: 35 });
  const ctaScale = interpolate(ctaSpring, [0, 1], [0.8, 1]);
  const ctaOpacity = interpolate(ctaSpring, [0, 1], [0, 1]);

  const logoSpring = spring({ frame, fps, config: { damping: 200 }, delay: 45 });
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 36 }}>
      {/* Glow */}
      <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle, ${COLORS.successGlow}, transparent)`, opacity: interpolate(frame % 60, [0, 30, 60], [0.3, 0.7, 0.3]), transform: `scale(${checkScale})` }} />

      {/* Checkmark */}
      <div style={{ width: 120, height: 120, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.success}, #059669)`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${checkScale})`, boxShadow: `0 12px 40px ${COLORS.successGlow}` }}>
        <span style={{ fontSize: 58, fontWeight: 700, color: COLORS.white, lineHeight: 1 }}>&#10003;</span>
      </div>

      {/* Title */}
      <div style={{ textAlign: "center", transform: `translateY(${titleY}px)`, opacity: titleOpacity, padding: "0 50px" }}>
        <h1 style={{ fontFamily: headingFont, fontSize: 66, fontWeight: 800, color: COLORS.text, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Start coaching{"\n"}smarter.
        </h1>
      </div>

      {/* Subtitle */}
      <div style={{ textAlign: "center", opacity: subOpacity, padding: "0 70px" }}>
        <p style={{ fontFamily: bodyFont, fontSize: 28, fontWeight: 500, color: COLORS.textMuted, margin: 0, lineHeight: 1.4 }}>
          Set up takes under 5 minutes.{"\n"}Your athletes will thank you.
        </p>
      </div>

      {/* CTA */}
      <div style={{ transform: `scale(${ctaScale})`, opacity: ctaOpacity, marginTop: 8 }}>
        <div style={{ background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`, borderRadius: 18, padding: "20px 56px", boxShadow: `0 8px 30px ${COLORS.primaryGlow}` }}>
          <span style={{ fontFamily: bodyFont, fontSize: 26, fontWeight: 700, color: COLORS.bg, letterSpacing: "0.02em" }}>podiumthrows.com</span>
        </div>
      </div>

      {/* Small logo at bottom */}
      <div style={{ opacity: logoOpacity, marginTop: 20 }}>
        <Img src={staticFile("podium-throws-logo.png")} style={{ width: 120, height: 120, objectFit: "contain", opacity: 0.5 }} />
      </div>
    </AbsoluteFill>
  );
};
