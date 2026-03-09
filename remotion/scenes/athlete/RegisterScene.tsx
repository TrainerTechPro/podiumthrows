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

const RegisterScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const vis = spring({ frame, fps, config: { damping: 200 }, delay: 12 });

  const fields = [
    { label: "First Name", value: "Sarah", delay: 20 },
    { label: "Last Name", value: "Chen", delay: 32 },
    { label: "Email", value: "sarah.chen@university.edu", delay: 44 },
    { label: "Password", value: "••••••••••", delay: 56 },
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: COLORS.bg, padding: "68px 24px 24px", display: "flex", flexDirection: "column", opacity: interpolate(vis, [0, 1], [0, 1]) }}>
      {/* Header */}
      <div style={{ textAlign: "center", padding: "20px 0 24px" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <span style={{ fontFamily: headingFont, fontSize: 22, fontWeight: 800, color: COLORS.bg }}>P</span>
        </div>
        <h3 style={{ fontFamily: headingFont, fontSize: 22, fontWeight: 700, color: COLORS.text, margin: 0 }}>Create your account</h3>
        <p style={{ fontFamily: bodyFont, fontSize: 14, color: COLORS.textMuted, margin: "6px 0 0" }}>Join Coach Morrison&apos;s roster</p>
      </div>

      {/* Form fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 4px" }}>
        {fields.map((field) => {
          const fill = interpolate(frame, [field.delay, field.delay + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={field.label}>
              <span style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{field.label}</span>
              <div style={{ marginTop: 5, border: `1.5px solid ${fill > 0 ? `rgba(245,158,11,0.3)` : COLORS.surfaceRaised}`, borderRadius: 10, padding: "11px 14px", background: COLORS.surface }}>
                <span style={{ fontFamily: bodyFont, fontSize: 15, color: fill > 0 ? COLORS.text : COLORS.textSubtle }}>
                  {fill > 0 ? field.value.slice(0, Math.ceil(field.value.length * fill)) : field.label}
                </span>
                {fill > 0 && fill < 1 && <span style={{ display: "inline-block", width: 2, height: 16, background: COLORS.primary, marginLeft: 1, verticalAlign: "middle" }} />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit button */}
      {frame > 70 && (() => {
        const btnVis = spring({ frame: frame - 70, fps, config: { damping: 200 } });
        return (
          <div style={{ marginTop: 22, padding: "0 4px", opacity: interpolate(btnVis, [0, 1], [0, 1]), transform: `translateY(${interpolate(btnVis, [0, 1], [10, 0])}px)` }}>
            <div style={{ background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`, borderRadius: 12, padding: "15px 0", textAlign: "center" }}>
              <span style={{ fontFamily: bodyFont, fontSize: 16, fontWeight: 600, color: COLORS.bg }}>Create Account</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export const RegisterScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame, fps, config: { damping: 200 }, delay: 5 });

  return (
    <AbsoluteFill style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 50 }}>
      <div style={{ textAlign: "center", opacity: interpolate(t, [0, 1], [0, 1]), transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)` }}>
        <p style={{ fontFamily: bodyFont, fontSize: 20, fontWeight: 600, color: COLORS.primary, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 16px" }}>
          Quick Sign-Up
        </p>
        <h2 style={{ fontFamily: headingFont, fontSize: 58, fontWeight: 700, color: COLORS.text, margin: 0, lineHeight: 1.1 }}>
          Create an account{"\n"}in seconds
        </h2>
        <p style={{ fontFamily: bodyFont, fontSize: 24, color: COLORS.textMuted, margin: "16px auto 0", lineHeight: 1.5, maxWidth: 700 }}>
          Pre-linked to your coach.{"\n"}No invite code to enter.
        </p>
      </div>
      <PhoneMockup enterDelay={12}>
        <RegisterScreen />
      </PhoneMockup>
    </AbsoluteFill>
  );
};
