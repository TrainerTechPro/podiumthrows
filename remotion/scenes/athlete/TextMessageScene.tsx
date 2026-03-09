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

const TextScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bubble1 = spring({ frame, fps, config: { damping: 200 }, delay: 10 });
  const bubble2 = spring({ frame, fps, config: { damping: 200 }, delay: 35 });
  const linkGlow = interpolate(frame % 40, [0, 20, 40], [0.6, 1, 0.6]);

  return (
    <div style={{ width: "100%", height: "100%", background: COLORS.bg, padding: "68px 20px 24px", display: "flex", flexDirection: "column" }}>
      {/* Contact header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 8px 18px", borderBottom: `1px solid ${COLORS.surface}` }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: headingFont, fontSize: 18, fontWeight: 700, color: COLORS.bg }}>CM</span>
        </div>
        <div>
          <p style={{ fontFamily: bodyFont, fontSize: 17, fontWeight: 600, color: COLORS.text, margin: 0 }}>Coach Morrison</p>
          <p style={{ fontFamily: bodyFont, fontSize: 13, color: COLORS.textMuted, margin: "2px 0 0" }}>iMessage</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, padding: "20px 4px" }}>
        {/* Coach message 1 */}
        <div style={{ alignSelf: "flex-start", maxWidth: "85%", opacity: interpolate(bubble1, [0, 1], [0, 1]), transform: `translateY(${interpolate(bubble1, [0, 1], [16, 0])}px)` }}>
          <div style={{ background: COLORS.surface, borderRadius: "18px 18px 18px 6px", padding: "14px 18px" }}>
            <p style={{ fontFamily: bodyFont, fontSize: 16, color: COLORS.text, margin: 0, lineHeight: 1.4 }}>
              Hey! I just set you up on Podium Throws. Tap the link below to join my roster
            </p>
          </div>
          <p style={{ fontFamily: bodyFont, fontSize: 11, color: COLORS.textSubtle, margin: "4px 0 0 8px" }}>10:24 AM</p>
        </div>

        {/* Coach message 2 — the invite link */}
        <div style={{ alignSelf: "flex-start", maxWidth: "85%", opacity: interpolate(bubble2, [0, 1], [0, 1]), transform: `translateY(${interpolate(bubble2, [0, 1], [16, 0])}px)` }}>
          <div style={{ background: "rgba(245,158,11,0.10)", border: `1.5px solid rgba(245,158,11,0.25)`, borderRadius: "18px 18px 18px 6px", padding: "14px 18px" }}>
            <p style={{ fontFamily: bodyFont, fontSize: 14, color: COLORS.primaryLight, margin: 0, lineHeight: 1.5, opacity: linkGlow }}>
              podiumthrows.com/register?invite=a8f3...
            </p>
            <p style={{ fontFamily: bodyFont, fontSize: 13, color: COLORS.textMuted, margin: "6px 0 0" }}>
              Tap to join my team on Podium Throws
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TextMessageScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame, fps, config: { damping: 200 }, delay: 5 });

  return (
    <AbsoluteFill style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 50 }}>
      <div style={{ textAlign: "center", opacity: interpolate(t, [0, 1], [0, 1]), transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)` }}>
        <p style={{ fontFamily: bodyFont, fontSize: 20, fontWeight: 600, color: COLORS.primary, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 16px" }}>
          It Starts With a Text
        </p>
        <h2 style={{ fontFamily: headingFont, fontSize: 58, fontWeight: 700, color: COLORS.text, margin: 0, lineHeight: 1.1 }}>
          Your coach sends{"\n"}an invite link
        </h2>
        <p style={{ fontFamily: bodyFont, fontSize: 24, color: COLORS.textMuted, margin: "16px auto 0", lineHeight: 1.5, maxWidth: 700 }}>
          One tap is all it takes{"\n"}to start the sign-up.
        </p>
      </div>
      <PhoneMockup enterDelay={12}>
        <TextScreen />
      </PhoneMockup>
    </AbsoluteFill>
  );
};
