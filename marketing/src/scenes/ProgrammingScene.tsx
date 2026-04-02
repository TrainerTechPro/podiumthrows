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
import { COLORS, EVENT_COLORS, cutCornerClipPath } from "../lib/tokens";
import { FONT_HEADING, FONT_BODY, FONT_MONO } from "../lib/fonts";
import { SMOOTH, SNAPPY } from "../lib/spring-presets";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const ACTIVE_DAYS = [0, 1, 2, 3, 4]; // Mon-Fri active

const SESSIONS = [
  { event: "SHOT_PUT", label: "AM — Throwing", detail: "Shot Put — 24 throws", time: "8:00 AM", enterDelay: 0 },
  { event: "DISCUS", label: "AM — Throwing", detail: "Discus — 30 throws", time: "8:00 AM", enterDelay: 8 },
  { event: "HAMMER", label: "PM — Throwing", detail: "Hammer — 20 throws", time: "2:00 PM", enterDelay: 16 },
  { event: "SHOT_PUT", label: "PM — Strength", detail: "Block 1 — 5×3 Clean", time: "3:30 PM", enterDelay: 24 },
];

/**
 * ProgrammingScene — 150 frames / 5s @ 30fps
 * iPhone showing weekly programming calendar with session cards.
 */
export const ProgrammingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = spring({ frame, fps, config: SMOOTH });
  const headerOpacity = interpolate(headerProgress, [0, 1], [0, 1]);

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
          opacity: headerOpacity,
        }}
      >
        Programming
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
        {/* iPhone with calendar UI */}
        <DeviceFrame width={260} height={562} enterDelay={0}>
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: COLORS.background,
              padding: "28px 12px 12px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Fake app bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontFamily: FONT_HEADING, fontSize: 12, fontWeight: 700, color: COLORS.gold }}>
                Weekly Program
              </span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 8, color: COLORS.muted }}>
                Mar 10–16
              </span>
            </div>

            {/* Day selector row */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
              {DAYS.map((day, i) => {
                const isActive = ACTIVE_DAYS.includes(i);
                const chipProgress = spring({
                  frame: frame - 5 - i * 2,
                  fps,
                  config: SMOOTH,
                });
                const chipOpacity = interpolate(chipProgress, [0, 1], [0, 1]);
                const isSelected = i === 0; // Monday selected

                return (
                  <div
                    key={`${day}-${i}`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isSelected ? COLORS.gold : isActive ? "rgba(255,200,0,0.08)" : "transparent",
                      border: isActive ? `1px solid rgba(255,200,0,0.15)` : "1px solid transparent",
                      opacity: chipOpacity,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 9,
                        fontWeight: 600,
                        color: isSelected ? "#0a0a0c" : isActive ? COLORS.foreground : COLORS.muted,
                      }}
                    >
                      {day}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Session cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              {SESSIONS.map((session, idx) => {
                const progress = spring({
                  frame: frame - session.enterDelay - 15,
                  fps,
                  config: SNAPPY,
                });
                const translateY = interpolate(progress, [0, 1], [30, 0]);
                const opacity = interpolate(progress, [0, 1], [0, 1]);
                const eventColor = EVENT_COLORS[session.event] || COLORS.gold;

                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "stretch",
                      transform: `translateY(${translateY}px)`,
                      opacity,
                      borderRadius: 6,
                      backgroundColor: COLORS.surfaceLight,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ width: 3, backgroundColor: eventColor, flexShrink: 0 }} />
                    <div style={{ padding: "6px 8px", flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: FONT_BODY, fontSize: 7, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {session.label}
                        </span>
                        <span style={{ fontFamily: FONT_MONO, fontSize: 7, color: COLORS.muted }}>
                          {session.time}
                        </span>
                      </div>
                      <div style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 500, color: COLORS.foreground, marginTop: 2 }}>
                        {session.detail}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DeviceFrame>

        {/* Right side: Feature highlights */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 400 }}>
          {[
            { title: "Bondarchuk Periodization", desc: "4-phase training cycles with automatic progression", delay: 20 },
            { title: "Descending Weight Protocol", desc: "Heavy → competition weight sequencing enforced", delay: 32 },
            { title: "AM/PM Session Structure", desc: "Throwing blocks separated by strength work", delay: 44 },
          ].map((feature, i) => {
            const fProgress = spring({ frame: frame - feature.delay, fps, config: SMOOTH });
            const fOpacity = interpolate(fProgress, [0, 1], [0, 1]);
            const fX = interpolate(fProgress, [0, 1], [20, 0]);

            return (
              <div
                key={i}
                style={{
                  transform: `translateX(${fX}px)`,
                  opacity: fOpacity,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: COLORS.gold }} />
                  <span style={{ fontFamily: FONT_HEADING, fontSize: 18, fontWeight: 600, color: COLORS.foreground }}>
                    {feature.title}
                  </span>
                </div>
                <span style={{ fontFamily: FONT_BODY, fontSize: 14, color: COLORS.muted, paddingLeft: 14 }}>
                  {feature.desc}
                </span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
