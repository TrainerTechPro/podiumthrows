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

const STEPS = [
  { label: "Complete your profile", done: true },
  { label: "Create first program", current: true },
  { label: "Invite an athlete" },
  { label: "Log first session" },
  { label: "Review progress" },
];

const ChecklistScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ width: "100%", height: "100%", background: COLORS.bg, padding: "68px 24px 24px", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "18px 8px 10px" }}>
        <h3 style={{ fontFamily: headingFont, fontSize: 24, fontWeight: 700, color: COLORS.text, margin: 0 }}>Getting Started</h3>
        <p style={{ fontFamily: bodyFont, fontSize: 15, color: COLORS.textMuted, margin: "5px 0 0" }}>1 of 5 complete</p>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: COLORS.surface, margin: "8px 8px 18px", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.primaryLight})`, width: "20%" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {STEPS.map((step, idx) => {
          const s = spring({ frame, fps, config: { damping: 200 }, delay: 8 + idx * 4 });
          return (
            <div
              key={step.label}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12,
                background: step.current ? "rgba(245,158,11,0.07)" : "transparent",
                border: step.current ? "1px solid rgba(245,158,11,0.18)" : "1px solid transparent",
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(s, [0, 1], [16, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: step.done ? COLORS.primary : "transparent",
                  border: step.done ? "none" : step.current ? `2px solid ${COLORS.primary}` : `2px solid ${COLORS.surfaceRaised}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {step.done && <span style={{ color: COLORS.bg, fontSize: 15, fontWeight: 700 }}>&#10003;</span>}
              </div>
              <span style={{ fontFamily: bodyFont, fontSize: 17, fontWeight: step.current ? 600 : 400, color: step.done ? COLORS.textSubtle : COLORS.text, textDecoration: step.done ? "line-through" : "none", flex: 1 }}>
                {step.label}
              </span>
              {step.done && <span style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 600, color: COLORS.primary }}>Done</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ChecklistScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame, fps, config: { damping: 200 }, delay: 5 });

  return (
    <AbsoluteFill style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 50 }}>
      <div style={{ textAlign: "center", opacity: interpolate(t, [0, 1], [0, 1]), transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)` }}>
        <p style={{ fontFamily: bodyFont, fontSize: 20, fontWeight: 600, color: COLORS.primary, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 16px" }}>
          Guided Setup
        </p>
        <h2 style={{ fontFamily: headingFont, fontSize: 58, fontWeight: 700, color: COLORS.text, margin: 0, lineHeight: 1.1 }}>
          5-step checklist{"\n"}keeps you on track
        </h2>
        <p style={{ fontFamily: bodyFont, fontSize: 24, color: COLORS.textMuted, margin: "16px auto 0", lineHeight: 1.5, maxWidth: 700 }}>
          Progress bar and contextual actions{"\n"}at every step. Skip anytime.
        </p>
      </div>
      <PhoneMockup enterDelay={12}>
        <ChecklistScreen />
      </PhoneMockup>
    </AbsoluteFill>
  );
};
