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

const InviteScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isLinkMode = frame > 60;
  const vis = spring({ frame, fps, config: { damping: 200 }, delay: 15 });
  const btnSpring = spring({ frame: frame - 75, fps, config: { damping: 15 } });
  const btnScale = isLinkMode ? interpolate(btnSpring, [0, 1], [0.92, 1]) : 1;

  return (
    <div style={{ width: "100%", height: "100%", background: COLORS.bg, padding: "68px 24px 24px", display: "flex", flexDirection: "column", opacity: interpolate(vis, [0, 1], [0, 1]) }}>
      <div style={{ padding: "18px 8px 18px", textAlign: "center" }}>
        <h3 style={{ fontFamily: headingFont, fontSize: 24, fontWeight: 700, color: COLORS.text, margin: 0 }}>Invite an Athlete</h3>
      </div>

      {/* Toggle */}
      <div style={{ display: "flex", borderRadius: 12, background: COLORS.surface, padding: 4, margin: "0 8px 22px" }}>
        {["Send Email", "Get a Link"].map((label, i) => {
          const active = i === 0 ? !isLinkMode : isLinkMode;
          return (
            <div key={label} style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 9, background: active ? COLORS.bgSubtle : "transparent", fontFamily: bodyFont, fontSize: 15, fontWeight: 600, color: active ? COLORS.text : COLORS.textMuted, boxShadow: active ? "0 1px 4px rgba(0,0,0,0.3)" : "none" }}>
              {label}
            </div>
          );
        })}
      </div>

      {!isLinkMode ? (
        <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontFamily: bodyFont, fontSize: 15, color: COLORS.textMuted, margin: 0 }}>Enter their email. They&apos;ll get a link to join your roster.</p>
          <div style={{ border: `1.5px solid ${COLORS.surfaceRaised}`, borderRadius: 12, padding: "14px 18px", background: COLORS.surface }}>
            <span style={{ fontFamily: bodyFont, fontSize: 16, color: COLORS.textSubtle }}>athlete@university.edu</span>
          </div>
        </div>
      ) : (
        <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 18 }}>
          <p style={{ fontFamily: bodyFont, fontSize: 15, color: COLORS.textMuted, margin: 0 }}>Generate a one-time invite link to send over text or any messaging app.</p>
          <div style={{ background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`, borderRadius: 14, padding: "16px 0", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transform: `scale(${btnScale})` }}>
            <span style={{ fontSize: 16 }}>&#128279;</span>
            <span style={{ fontFamily: bodyFont, fontSize: 17, fontWeight: 600, color: COLORS.bg }}>Generate Invite Link</span>
          </div>
          {frame > 90 && (() => {
            const shareVis = spring({ frame: frame - 90, fps, config: { damping: 200 } });
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: interpolate(shareVis, [0, 1], [0, 1]), transform: `translateY(${interpolate(shareVis, [0, 1], [12, 0])}px)` }}>
                <div style={{ background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`, borderRadius: 14, padding: "16px 0", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>&#128233;</span>
                  <span style={{ fontFamily: bodyFont, fontSize: 16, fontWeight: 600, color: COLORS.bg }}>Send via Text or App</span>
                </div>
                <div style={{ border: `1.5px solid ${COLORS.surfaceRaised}`, borderRadius: 14, padding: "16px 0", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>&#128203;</span>
                  <span style={{ fontFamily: bodyFont, fontSize: 16, fontWeight: 600, color: COLORS.text }}>Copy Invite Link</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export const InviteScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame, fps, config: { damping: 200 }, delay: 5 });

  return (
    <AbsoluteFill style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 44 }}>
      <div style={{ textAlign: "center", opacity: interpolate(t, [0, 1], [0, 1]), transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)` }}>
        <p style={{ fontFamily: bodyFont, fontSize: 20, fontWeight: 600, color: COLORS.primary, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 16px" }}>
          Step 3 of 5
        </p>
        <h2 style={{ fontFamily: headingFont, fontSize: 58, fontWeight: 700, color: COLORS.text, margin: 0, lineHeight: 1.1 }}>
          Invite athletes{"\n"}your way
        </h2>
        <p style={{ fontFamily: bodyFont, fontSize: 24, color: COLORS.textMuted, margin: "16px auto 0", lineHeight: 1.5, maxWidth: 700 }}>
          Email or shareable link —{"\n"}athletes auto-join your roster.
        </p>
      </div>

      <PhoneMockup enterDelay={12}>
        <InviteScreen />
      </PhoneMockup>

      {/* Feature pills */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {["Email", "Text Link", "Native Share"].map((text, i) => {
          const pill = spring({ frame, fps, config: { damping: 200 }, delay: 25 + i * 6 });
          return (
            <div
              key={text}
              style={{
                opacity: interpolate(pill, [0, 1], [0, 1]),
                transform: `scale(${interpolate(pill, [0, 1], [0.8, 1])})`,
                padding: "10px 24px",
                borderRadius: 100,
                border: `1.5px solid rgba(245,158,11,0.25)`,
                background: "rgba(245,158,11,0.06)",
              }}
            >
              <span style={{ fontFamily: bodyFont, fontSize: 18, fontWeight: 600, color: COLORS.primaryLight }}>{text}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
