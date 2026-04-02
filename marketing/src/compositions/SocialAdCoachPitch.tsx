import "../style.css";
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS, EVENT_COLORS, cutCornerClipPath } from "../lib/tokens";
import { FONT_HEADING, FONT_BODY, FONT_MONO } from "../lib/fonts";
import { SMOOTH, SNAPPY } from "../lib/spring-presets";
import { Background } from "../components/Background";
import { LogoStinger } from "../components/LogoStinger";
import { TaglineSlide } from "../components/TaglineSlide";
import { CutCornerCard } from "../components/CutCornerCard";
import { DataReveal } from "../components/DataReveal";
import { EventBar } from "../components/EventBar";

/* ─── Session row data for programming calendar ─────────────────────────── */

const CALENDAR_SESSIONS = [
  { event: "SHOT_PUT", name: "Heavy Shot — AM", color: EVENT_COLORS.SHOT_PUT },
  { event: "DISCUS", name: "Discus Transfer", color: EVENT_COLORS.DISCUS },
  { event: "HAMMER", name: "Hammer Tech", color: EVENT_COLORS.HAMMER },
  { event: "SHOT_PUT", name: "Competition Prep", color: EVENT_COLORS.SHOT_PUT },
  { event: "JAVELIN", name: "Javelin Approach", color: EVENT_COLORS.JAVELIN },
];

/* ─── Bullet points ─────────────────────────────────────────────────────── */

const BULLETS = [
  { text: "Bondarchuk Methodology", color: COLORS.gold },
  { text: "Real-time Pose Analysis", color: COLORS.success },
  { text: "Automated PR Detection", color: COLORS.info },
];

/* ─── Stat cards ────────────────────────────────────────────────────────── */

const STAT_CARDS = [
  { value: 47, label: "Analyses", decimals: 0 },
  { value: 8.2, label: "Readiness", decimals: 1 },
  { value: 12, label: "PRs", decimals: 0 },
];

/* ─── Event bars ────────────────────────────────────────────────────────── */

const BARS = [
  { event: "SHOT_PUT", percentage: 85, count: 42 },
  { event: "DISCUS", percentage: 65, count: 36 },
  { event: "HAMMER", percentage: 55, count: 30 },
  { event: "JAVELIN", percentage: 40, count: 22 },
];

/* ─── Main Composition (1920x1080, 450 frames) ──────────────────────────── */

export const SocialAdCoachPitch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ── Section 1: Logo + Tagline (frame 0-60) ────────────────────────── */

  const s1Opacity = interpolate(frame, [0, 8, 50, 60], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Section 2: Calendar + Bullets (frame 45-180) ──────────────────── */

  const s2Opacity = interpolate(frame, [45, 55, 170, 180], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Section 3: Stats + EventBars (frame 165-330) ──────────────────── */

  const s3Opacity = interpolate(frame, [165, 175, 320, 330], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Section 4: CTA (frame 315-450) ────────────────────────────────── */

  const ctaProgress = spring({
    frame: frame - 325,
    fps,
    config: SMOOTH,
  });
  const ctaOpacity = interpolate(ctaProgress, [0, 1], [0, 1]);
  const ctaScale = interpolate(ctaProgress, [0, 1], [0.95, 1]);

  // Gold glow pulse for CTA
  const pulsePhase = interpolate(frame, [340, 380, 420, 450], [0.15, 0.4, 0.15, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Background />

      {/* Section 1: Logo left + Tagline right */}
      <AbsoluteFill
        style={{
          opacity: s1Opacity,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 100px",
          gap: 80,
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <LogoStinger variant="compact" />
        </div>
        <div style={{ flex: 1, maxWidth: 700 }}>
          <TaglineSlide
            text="The throws coaching platform that understands periodization"
            enterDelay={10}
            fontSize={28}
            color={COLORS.foreground}
          />
        </div>
      </AbsoluteFill>

      {/* Section 2: Calendar left + Bullets right */}
      <AbsoluteFill
        style={{
          opacity: s2Opacity,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 80px",
          gap: 60,
        }}
      >
        {/* Left: Programming calendar */}
        <div style={{ flex: 1, maxWidth: 600 }}>
          <CutCornerCard enterDelay={55} style={{ padding: 24 }}>
            <div
              style={{
                fontFamily: FONT_HEADING,
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.muted,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 14,
              }}
            >
              Weekly Programming
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {CALENDAR_SESSIONS.map((session, i) => {
                const rowProgress = spring({
                  frame: frame - 65 - i * 8,
                  fps,
                  config: SMOOTH,
                });
                const rowY = interpolate(rowProgress, [0, 1], [20, 0]);
                const rowOpacity = interpolate(rowProgress, [0, 1], [0, 1]);

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 4,
                      backgroundColor: "rgba(255,255,255,0.03)",
                      transform: `translateY(${rowY}px)`,
                      opacity: rowOpacity,
                    }}
                  >
                    <div
                      style={{
                        width: 3,
                        height: 24,
                        borderRadius: 2,
                        backgroundColor: session.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 15,
                        fontWeight: 500,
                        color: COLORS.foreground,
                      }}
                    >
                      {session.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </CutCornerCard>
        </div>

        {/* Right: Bullet points */}
        <div
          style={{
            flex: 1,
            maxWidth: 500,
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          {BULLETS.map((bullet, i) => {
            const bulletProgress = spring({
              frame: frame - 80 - i * 15,
              fps,
              config: SMOOTH,
            });
            const bulletOpacity = interpolate(bulletProgress, [0, 1], [0, 1]);
            const bulletX = interpolate(bulletProgress, [0, 1], [30, 0]);

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  opacity: bulletOpacity,
                  transform: `translateX(${bulletX}px)`,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: bullet.color,
                    flexShrink: 0,
                    boxShadow: `0 0 12px ${bullet.color}60`,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT_HEADING,
                    fontSize: 28,
                    fontWeight: 600,
                    color: COLORS.foreground,
                  }}
                >
                  {bullet.text}
                </span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Section 3: Full-width stats row + EventBars */}
      <AbsoluteFill
        style={{
          opacity: s3Opacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          padding: "0 100px",
        }}
      >
        {/* 3 stat cards in a row */}
        <div
          style={{
            display: "flex",
            gap: 32,
            justifyContent: "center",
            width: "100%",
          }}
        >
          {STAT_CARDS.map((stat, i) => (
            <CutCornerCard
              key={i}
              enterDelay={180 + i * 10}
              style={{
                flex: 1,
                maxWidth: 320,
                padding: "32px 24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <DataReveal
                value={stat.value}
                decimals={stat.decimals}
                fontSize={56}
                enterDelay={185 + i * 10}
                countDuration={25}
              />
              <span
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 16,
                  fontWeight: 500,
                  color: COLORS.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                {stat.label}
              </span>
            </CutCornerCard>
          ))}
        </div>

        {/* 4 EventBars below */}
        <div
          style={{
            width: "100%",
            maxWidth: 800,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {BARS.map((bar, i) => (
            <EventBar
              key={bar.event}
              event={bar.event}
              percentage={bar.percentage}
              count={bar.count}
              enterDelay={220 + i * 8}
            />
          ))}
        </div>
      </AbsoluteFill>

      {/* Section 4: CTA */}
      <AbsoluteFill
        style={{
          opacity: ctaOpacity,
          transform: `scale(${ctaScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <span
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 56,
            fontWeight: 700,
            color: COLORS.gold,
            textShadow: `0 0 60px rgba(255,200,0,${pulsePhase})`,
            letterSpacing: "-0.02em",
          }}
        >
          podiumthrows.com
        </span>
        <span
          style={{
            fontFamily: FONT_BODY,
            fontSize: 22,
            fontWeight: 400,
            color: COLORS.muted,
          }}
        >
          Free for up to 3 athletes
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
