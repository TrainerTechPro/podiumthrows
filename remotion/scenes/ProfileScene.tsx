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

const ProfileScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const vis = spring({ frame, fps, config: { damping: 200 }, delay: 15 });
  const f1 = interpolate(frame, [30, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const f2 = interpolate(frame, [50, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const f3 = interpolate(frame, [70, 85], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const fields = [
    { label: "Organization", value: "University of Oregon", fill: f1 },
    { label: "Bio", value: "Head throws coach, 15 years", fill: f2 },
    { label: "Events", value: "Shot Put, Discus, Hammer", fill: f3 },
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: COLORS.bg, padding: "68px 24px 24px", display: "flex", flexDirection: "column", opacity: interpolate(vis, [0, 1], [0, 1]) }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 0 28px" }}>
        <div style={{ width: 88, height: 88, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: headingFont, fontSize: 34, fontWeight: 700, color: COLORS.bg }}>JM</span>
        </div>
        <h3 style={{ fontFamily: headingFont, fontSize: 22, fontWeight: 700, color: COLORS.text, margin: "14px 0 0" }}>Coach Profile</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "0 8px" }}>
        {fields.map((field) => (
          <div key={field.label}>
            <span style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{field.label}</span>
            <div style={{ marginTop: 7, border: `1.5px solid ${COLORS.surfaceRaised}`, borderRadius: 11, padding: "12px 16px", background: COLORS.surface }}>
              <span style={{ fontFamily: bodyFont, fontSize: 16, color: field.fill > 0 ? COLORS.text : COLORS.textSubtle }}>
                {field.fill > 0 ? field.value.slice(0, Math.ceil(field.value.length * field.fill)) : field.label + "..."}
              </span>
              {field.fill > 0 && field.fill < 1 && <span style={{ display: "inline-block", width: 2, height: 18, background: COLORS.primary, marginLeft: 1, verticalAlign: "middle" }} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ProfileScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame, fps, config: { damping: 200 }, delay: 5 });

  return (
    <AbsoluteFill style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 50 }}>
      <div style={{ textAlign: "center", opacity: interpolate(t, [0, 1], [0, 1]), transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)` }}>
        <p style={{ fontFamily: bodyFont, fontSize: 20, fontWeight: 600, color: COLORS.primary, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 16px" }}>
          Step 1 of 5
        </p>
        <h2 style={{ fontFamily: headingFont, fontSize: 58, fontWeight: 700, color: COLORS.text, margin: 0, lineHeight: 1.1 }}>
          Complete your{"\n"}coach profile
        </h2>
        <p style={{ fontFamily: bodyFont, fontSize: 24, color: COLORS.textMuted, margin: "16px auto 0", lineHeight: 1.5, maxWidth: 700 }}>
          Add your organization, bio, and specialties.{"\n"}Athletes see this when they join.
        </p>
      </div>
      <PhoneMockup enterDelay={12}>
        <ProfileScreen />
      </PhoneMockup>
    </AbsoluteFill>
  );
};
