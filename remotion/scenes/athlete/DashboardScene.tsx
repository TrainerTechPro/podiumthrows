import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS } from "../../theme";
import { headingFont, bodyFont } from "../../fonts";
import { PhoneMockup } from "../../components/PhoneMockup";

const GUIDE_STEPS = [
  { label: "Submit a wellness check-in", done: false, current: true },
  { label: "Check your training sessions", done: false },
  { label: "Explore your throw history", done: false },
];

const DashboardScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const vis = spring({ frame, fps, config: { damping: 200 }, delay: 12 });

  return (
    <div style={{ width: "100%", height: "100%", background: COLORS.bg, padding: "68px 20px 20px", display: "flex", flexDirection: "column", gap: 16, opacity: interpolate(vis, [0, 1], [0, 1]) }}>
      {/* Greeting */}
      <div style={{ padding: "14px 8px 8px" }}>
        <h3 style={{ fontFamily: headingFont, fontSize: 22, fontWeight: 700, color: COLORS.text, margin: 0 }}>Good morning, Sarah.</h3>
        <p style={{ fontFamily: bodyFont, fontSize: 13, color: COLORS.textMuted, margin: "4px 0 0" }}>Sunday, March 9</p>
      </div>

      {/* Welcome card */}
      <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid rgba(245,158,11,0.15)` }}>
        {/* Gradient header */}
        <div style={{ background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`, padding: "16px 18px" }}>
          <p style={{ fontFamily: bodyFont, fontSize: 15, fontWeight: 600, color: COLORS.bg, margin: 0 }}>
            Great start, Sarah! Here&apos;s what to do next.
          </p>
        </div>
        {/* Steps */}
        <div style={{ background: COLORS.bgSubtle, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
          {GUIDE_STEPS.map((step, idx) => {
            const s = spring({ frame, fps, config: { damping: 200 }, delay: 25 + idx * 5 });
            return (
              <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderRadius: 8, background: step.current ? "rgba(245,158,11,0.06)" : "transparent", opacity: interpolate(s, [0, 1], [0, 1]) }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: step.current ? `2px solid ${COLORS.primary}` : `2px solid ${COLORS.surfaceRaised}`, flexShrink: 0 }} />
                <span style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: step.current ? 600 : 400, color: COLORS.text }}>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Readiness ring placeholder */}
      <div style={{ display: "flex", gap: 12, padding: "0 4px" }}>
        <div style={{ flex: 1, background: COLORS.surface, borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", border: `4px solid ${COLORS.primary}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: headingFont, fontSize: 18, fontWeight: 700, color: COLORS.primary }}>--</span>
          </div>
          <span style={{ fontFamily: bodyFont, fontSize: 12, color: COLORS.textMuted, textAlign: "center" }}>Readiness</span>
        </div>
        <div style={{ flex: 1, background: COLORS.surface, borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <span style={{ fontFamily: headingFont, fontSize: 28, fontWeight: 700, color: COLORS.text }}>0</span>
          <span style={{ fontFamily: bodyFont, fontSize: 12, color: COLORS.textMuted }}>Sessions</span>
        </div>
        <div style={{ flex: 1, background: COLORS.surface, borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <span style={{ fontFamily: headingFont, fontSize: 28, fontWeight: 700, color: COLORS.text }}>0</span>
          <span style={{ fontFamily: bodyFont, fontSize: 12, color: COLORS.textMuted }}>Goals</span>
        </div>
      </div>
    </div>
  );
};

export const DashboardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame, fps, config: { damping: 200 }, delay: 5 });

  return (
    <AbsoluteFill style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 50 }}>
      <div style={{ textAlign: "center", opacity: interpolate(t, [0, 1], [0, 1]), transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)` }}>
        <p style={{ fontFamily: bodyFont, fontSize: 20, fontWeight: 600, color: COLORS.primary, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 16px" }}>
          You&apos;re In
        </p>
        <h2 style={{ fontFamily: headingFont, fontSize: 58, fontWeight: 700, color: COLORS.text, margin: 0, lineHeight: 1.1 }}>
          Your dashboard{"\n"}is ready
        </h2>
        <p style={{ fontFamily: bodyFont, fontSize: 24, color: COLORS.textMuted, margin: "16px auto 0", lineHeight: 1.5, maxWidth: 700 }}>
          Guided next steps, readiness tracking,{"\n"}and your full training history.
        </p>
      </div>
      <PhoneMockup enterDelay={12}>
        <DashboardScreen />
      </PhoneMockup>
    </AbsoluteFill>
  );
};
