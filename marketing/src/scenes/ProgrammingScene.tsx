import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { Background } from "../components/Background";
import { CutCornerCard } from "../components/CutCornerCard";
import { COLORS, EVENT_COLORS, cutCornerClipPath } from "../lib/tokens";
import { FONT_HEADING, FONT_BODY } from "../lib/fonts";
import { SNAPPY } from "../lib/spring-presets";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SESSIONS = [
  {
    event: "SHOT_PUT",
    label: "AM Session",
    detail: "Shot Put — 24 throws",
    enterDelay: 0,
  },
  {
    event: "DISCUS",
    label: "AM Session",
    detail: "Discus — 30 throws",
    enterDelay: 8,
  },
  {
    event: "HAMMER",
    label: "PM Session",
    detail: "Hammer — 20 throws",
    enterDelay: 16,
  },
];

/**
 * ProgrammingScene — 150 frames / 5s @ 30fps
 * Weekly programming card with 7-day header and 3 staggered session cards.
 */
export const ProgrammingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Header "Weekly Programming" fade in
  const headerOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Day row header stagger
  const dayRowOpacity = interpolate(frame, [8, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Background />

      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CutCornerCard width={700} height={400} enterDelay={0}>
          {/* Header */}
          <div
            style={{
              fontFamily: FONT_HEADING,
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.gold,
              marginBottom: 16,
              opacity: headerOpacity,
              letterSpacing: "0.02em",
            }}
          >
            Weekly Programming
          </div>

          {/* 7-day row */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 20,
              opacity: dayRowOpacity,
            }}
          >
            {DAYS.map((day) => (
              <div
                key={day}
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  color: COLORS.muted,
                  width: 80,
                  textAlign: "center",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Session cards with staggered slide-in */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SESSIONS.map((session) => {
              const progress = spring({
                frame: frame - session.enterDelay - 15,
                fps,
                config: SNAPPY,
              });
              const translateY = interpolate(progress, [0, 1], [50, 0]);
              const opacity = interpolate(progress, [0, 1], [0, 1]);
              const eventColor = EVENT_COLORS[session.event] || COLORS.gold;

              return (
                <div
                  key={session.event}
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    transform: `translateY(${translateY}px)`,
                    opacity,
                    clipPath: cutCornerClipPath(8),
                    backgroundColor: COLORS.surfaceLight,
                    overflow: "hidden",
                  }}
                >
                  {/* Left colored stripe */}
                  <div
                    style={{
                      width: 4,
                      backgroundColor: eventColor,
                      flexShrink: 0,
                    }}
                  />

                  {/* Content */}
                  <div style={{ padding: "10px 16px" }}>
                    <div
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 11,
                        color: COLORS.muted,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 2,
                      }}
                    >
                      {session.label}
                    </div>
                    <div
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 15,
                        fontWeight: 500,
                        color: COLORS.foreground,
                      }}
                    >
                      {session.detail}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CutCornerCard>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
