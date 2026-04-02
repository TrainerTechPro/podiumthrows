import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { Background } from "../components/Background";
import { DeviceFrame } from "../components/DeviceFrame";
import { DataReveal } from "../components/DataReveal";
import { EventBar } from "../components/EventBar";
import { COLORS, EVENT_COLORS, cutCornerClipPath } from "../lib/tokens";
import { FONT_HEADING, FONT_BODY, FONT_MONO } from "../lib/fonts";
import { SMOOTH } from "../lib/spring-presets";

const STAT_CARDS = [
  { label: "Total Analyses", value: 47, decimals: 0, suffix: "", enterDelay: 0 },
  { label: "Season PR Rate", value: 73, decimals: 0, suffix: "%", enterDelay: 8 },
  { label: "Avg Readiness", value: 8.2, decimals: 1, suffix: "", enterDelay: 16 },
];

const EVENT_BARS = [
  { event: "SHOT_PUT", percentage: 42, enterDelay: 30 },
  { event: "DISCUS", percentage: 28, enterDelay: 38 },
  { event: "HAMMER", percentage: 18, enterDelay: 46 },
  { event: "JAVELIN", percentage: 12, enterDelay: 54 },
];

/**
 * DashboardScene — 150 frames / 5s @ 30fps
 * iPhone showing the coach dashboard with stats + event bars alongside floating data.
 */
export const DashboardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelProgress = spring({ frame, fps, config: SMOOTH });
  const labelOpacity = interpolate(labelProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill>
      <Background />

      {/* Scene label */}
      <div
        style={{
          position: "absolute",
          top: 36,
          left: 60,
          fontFamily: FONT_HEADING,
          fontSize: 14,
          fontWeight: 600,
          color: COLORS.gold,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          opacity: labelOpacity,
        }}
      >
        Coach Dashboard
      </div>

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 50,
          padding: "0 60px",
        }}
      >
        {/* iPhone with dashboard UI */}
        <DeviceFrame width={260} height={562} enterDelay={0}>
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: COLORS.background,
              padding: "28px 10px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {/* App bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontFamily: FONT_HEADING, fontSize: 11, fontWeight: 700, color: COLORS.gold }}>
                Dashboard
              </span>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: `1px solid ${COLORS.muted}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 7, color: COLORS.muted }}>AS</span>
              </div>
            </div>

            {/* Mini stat cards row */}
            <div style={{ display: "flex", gap: 4 }}>
              {STAT_CARDS.map((card, i) => {
                const cardProgress = spring({ frame: frame - 8 - i * 6, fps, config: SMOOTH });
                const cardOpacity = interpolate(cardProgress, [0, 1], [0, 1]);
                const cardY = interpolate(cardProgress, [0, 1], [15, 0]);

                return (
                  <div
                    key={card.label}
                    style={{
                      flex: 1,
                      clipPath: cutCornerClipPath(6),
                      backgroundColor: COLORS.cardBg,
                      border: `1px solid ${COLORS.cardBorder}`,
                      padding: "6px 6px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                      opacity: cardOpacity,
                      transform: `translateY(${cardY}px)`,
                    }}
                  >
                    <span style={{ fontFamily: FONT_BODY, fontSize: 6, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {card.label}
                    </span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 500, color: COLORS.gold }}>
                      {card.value}{card.suffix}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Event distribution section */}
            <div style={{ marginTop: 4 }}>
              <span style={{ fontFamily: FONT_HEADING, fontSize: 7, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                By Event
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                {EVENT_BARS.map((bar, i) => {
                  const barProgress = spring({ frame: frame - 20 - i * 5, fps, config: SMOOTH });
                  const barOpacity = interpolate(barProgress, [0, 1], [0, 1]);
                  const barScaleX = interpolate(barProgress, [0, 1], [0, 1]);
                  const eventColor = EVENT_COLORS[bar.event] || COLORS.gold;

                  return (
                    <div key={bar.event} style={{ display: "flex", alignItems: "center", gap: 4, opacity: barOpacity }}>
                      <span style={{ fontFamily: FONT_BODY, fontSize: 7, color: COLORS.muted, width: 38, flexShrink: 0 }}>
                        {bar.event === "SHOT_PUT" ? "Shot" : bar.event === "DISCUS" ? "Disc" : bar.event === "HAMMER" ? "Ham" : "Jav"}
                      </span>
                      <div style={{ flex: 1, height: 5, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.04)" }}>
                        <div style={{ width: `${bar.percentage}%`, height: "100%", borderRadius: 2, backgroundColor: eventColor, transform: `scaleX(${barScaleX})`, transformOrigin: "left" }} />
                      </div>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 7, color: COLORS.muted, width: 16, textAlign: "right" }}>
                        {bar.percentage}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent activity section */}
            <div style={{ marginTop: 6 }}>
              <span style={{ fontFamily: FONT_HEADING, fontSize: 7, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Recent Activity
              </span>
              {[
                { text: "Marcus T. completed AM Session", time: "2m ago", color: COLORS.success },
                { text: "Sarah K. set new PR — 14.22m", time: "18m ago", color: COLORS.gold },
                { text: "James R. readiness check-in: 8.5", time: "1h ago", color: COLORS.info },
              ].map((item, i) => {
                const itemProgress = spring({ frame: frame - 40 - i * 6, fps, config: SMOOTH });
                const itemOpacity = interpolate(itemProgress, [0, 1], [0, 1]);

                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, opacity: itemOpacity }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: item.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: FONT_BODY, fontSize: 7, color: COLORS.foreground, flex: 1 }}>{item.text}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 6, color: COLORS.muted }}>{item.time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </DeviceFrame>

        {/* Right side: Big animated stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {STAT_CARDS.map((card) => (
            <div key={card.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {card.label}
              </span>
              <DataReveal
                value={card.value}
                decimals={card.decimals}
                suffix={card.suffix}
                enterDelay={card.enterDelay + 10}
                fontSize={52}
              />
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
