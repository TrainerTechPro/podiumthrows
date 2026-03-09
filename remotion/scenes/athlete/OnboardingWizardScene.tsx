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

const EVENTS = [
  { name: "Shot Put", emoji: "\uD83C\uDFCB\uFE0F", selected: true },
  { name: "Discus", emoji: "\uD83E\uDD4F", selected: true },
  { name: "Hammer", emoji: "\uD83D\uDD28", selected: false },
  { name: "Javelin", emoji: "\uD83C\uDFAF", selected: false },
];

const WizardScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const vis = spring({ frame, fps, config: { damping: 200 }, delay: 12 });

  return (
    <div style={{ width: "100%", height: "100%", background: COLORS.bg, padding: "68px 24px 24px", display: "flex", flexDirection: "column", opacity: interpolate(vis, [0, 1], [0, 1]) }}>
      {/* Progress dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "16px 0 24px" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: i === 0 ? 28 : 8, height: 8, borderRadius: 4, background: i === 0 ? COLORS.primary : COLORS.surface }} />
        ))}
      </div>

      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h3 style={{ fontFamily: headingFont, fontSize: 24, fontWeight: 700, color: COLORS.text, margin: 0 }}>Select your events</h3>
        <p style={{ fontFamily: bodyFont, fontSize: 14, color: COLORS.textMuted, margin: "8px 0 0" }}>Which events do you compete in?</p>
      </div>

      {/* Event grid */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: "0 4px", justifyContent: "center" }}>
        {EVENTS.map((event, idx) => {
          const eventSpring = spring({ frame, fps, config: { damping: 200 }, delay: 18 + idx * 6 });
          const selectAnim = event.selected ? spring({ frame, fps, config: { damping: 12 }, delay: 40 + idx * 8 }) : 0;

          return (
            <div
              key={event.name}
              style={{
                width: "45%",
                padding: "20px 0",
                borderRadius: 16,
                border: `2px solid ${event.selected && selectAnim > 0.5 ? COLORS.primary : COLORS.surfaceRaised}`,
                background: event.selected && selectAnim > 0.5 ? "rgba(245,158,11,0.08)" : COLORS.surface,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                opacity: interpolate(eventSpring, [0, 1], [0, 1]),
                transform: `scale(${interpolate(eventSpring, [0, 1], [0.9, 1])})`,
              }}
            >
              <span style={{ fontSize: 32 }}>{event.emoji}</span>
              <span style={{ fontFamily: bodyFont, fontSize: 15, fontWeight: 600, color: COLORS.text }}>{event.name}</span>
              {event.selected && selectAnim > 0.5 && (
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", top: -4, right: -4 }}>
                  <span style={{ color: COLORS.bg, fontSize: 13, fontWeight: 700 }}>&#10003;</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Continue button */}
      {frame > 65 && (() => {
        const btnVis = spring({ frame: frame - 65, fps, config: { damping: 200 } });
        return (
          <div style={{ marginTop: "auto", padding: "20px 4px 0", opacity: interpolate(btnVis, [0, 1], [0, 1]) }}>
            <div style={{ background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`, borderRadius: 14, padding: "16px 0", textAlign: "center" }}>
              <span style={{ fontFamily: bodyFont, fontSize: 17, fontWeight: 600, color: COLORS.bg }}>Continue</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export const OnboardingWizardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame, fps, config: { damping: 200 }, delay: 5 });

  return (
    <AbsoluteFill style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 50 }}>
      <div style={{ textAlign: "center", opacity: interpolate(t, [0, 1], [0, 1]), transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)` }}>
        <p style={{ fontFamily: bodyFont, fontSize: 20, fontWeight: 600, color: COLORS.primary, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 16px" }}>
          Quick Setup
        </p>
        <h2 style={{ fontFamily: headingFont, fontSize: 58, fontWeight: 700, color: COLORS.text, margin: 0, lineHeight: 1.1 }}>
          Pick your events{"\n"}and enter your PBs
        </h2>
        <p style={{ fontFamily: bodyFont, fontSize: 24, color: COLORS.textMuted, margin: "16px auto 0", lineHeight: 1.5, maxWidth: 700 }}>
          3 quick steps. Takes about{"\n"}2 minutes.
        </p>
      </div>
      <PhoneMockup enterDelay={12}>
        <WizardScreen />
      </PhoneMockup>
    </AbsoluteFill>
  );
};
