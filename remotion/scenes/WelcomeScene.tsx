import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../theme";
import { headingFont, bodyFont } from "../fonts";
import { PhoneMockup } from "../components/PhoneMockup";

const WelcomeScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s1 = spring({ frame, fps, config: { damping: 200 }, delay: 15 });
  const s2 = spring({ frame, fps, config: { damping: 200 }, delay: 30 });

  return (
    <div style={{ width: "100%", height: "100%", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 36px 50px" }}>
      <div style={{ opacity: interpolate(s1, [0, 1], [0, 1]), transform: `translateY(${interpolate(s1, [0, 1], [20, 0])}px)`, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <div style={{ width: 80, height: 80, borderRadius: 20, background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 40 }}>&#127942;</span>
        </div>
        <h2 style={{ fontFamily: headingFont, fontSize: 32, fontWeight: 700, color: COLORS.text, margin: 0, lineHeight: 1.2 }}>
          Welcome to{"\n"}Podium Throws!
        </h2>
        <p style={{ fontFamily: bodyFont, fontSize: 17, color: COLORS.textMuted, margin: 0, lineHeight: 1.5, maxWidth: 360 }}>
          Your coaching dashboard is ready. Let&apos;s get set up in a few quick steps.
        </p>
      </div>
      <div style={{ marginTop: 36, opacity: interpolate(s2, [0, 1], [0, 1]), transform: `scale(${interpolate(s2, [0, 1], [0.9, 1])})` }}>
        <div style={{ background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`, borderRadius: 14, padding: "16px 44px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: bodyFont, fontSize: 18, fontWeight: 600, color: COLORS.bg }}>Get Started</span>
          <span style={{ fontSize: 16, color: COLORS.bg }}>&#8594;</span>
        </div>
      </div>
    </div>
  );
};

export const WelcomeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = spring({ frame, fps, config: { damping: 200 }, delay: 5 });

  return (
    <AbsoluteFill style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 50 }}>
      {/* Label */}
      <div style={{ textAlign: "center", opacity: interpolate(t, [0, 1], [0, 1]), transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)` }}>
        <p style={{ fontFamily: bodyFont, fontSize: 20, fontWeight: 600, color: COLORS.primary, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 16px" }}>
          After Registration
        </p>
        <h2 style={{ fontFamily: headingFont, fontSize: 58, fontWeight: 700, color: COLORS.text, margin: 0, lineHeight: 1.1 }}>
          A personalized{"\n"}welcome awaits
        </h2>
        <p style={{ fontFamily: bodyFont, fontSize: 24, color: COLORS.textMuted, margin: "16px auto 0", lineHeight: 1.5, maxWidth: 700 }}>
          Coaches land on a guided welcome page —{"\n"}not a blank dashboard.
        </p>
      </div>
      <PhoneMockup enterDelay={12}>
        <WelcomeScreen />
      </PhoneMockup>
    </AbsoluteFill>
  );
};
