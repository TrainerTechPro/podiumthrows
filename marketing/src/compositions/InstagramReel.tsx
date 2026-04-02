import "../style.css";
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS, EVENT_COLORS, EVENT_LABELS } from "../lib/tokens";
import { FONT_HEADING, FONT_BODY, FONT_MONO } from "../lib/fonts";
import { SMOOTH, SNAPPY, BOUNCY } from "../lib/spring-presets";
import { Background } from "../components/Background";
import { GoldText } from "../components/GoldText";
import { CutCornerCard } from "../components/CutCornerCard";
import { LogoStinger } from "../components/LogoStinger";
import { DataReveal } from "../components/DataReveal";
import { TaglineSlide } from "../components/TaglineSlide";
import { AngleReadout } from "../components/AngleReadout";

/* ─── Event card data ───────────────────────────────────────────────────── */

const EVENT_CARDS = [
  { event: "SHOT_PUT", distance: "18.42m" },
  { event: "DISCUS", distance: "62.15m" },
  { event: "HAMMER", distance: "71.88m" },
  { event: "JAVELIN", distance: "82.34m" },
];

/* ─── Quick-cut stats ───────────────────────────────────────────────────── */

const STATS = [
  { value: 47, label: "Analyses" },
  { value: 24, label: "Athletes" },
  { value: 12, label: "PRs This Month" },
];

/* ─── Angle data ────────────────────────────────────────────────────────── */

const ANGLES: {
  label: string;
  degrees: number;
  status: "optimal" | "marginal" | "concerning";
}[] = [
  { label: "Shoulder Sep", degrees: 42, status: "optimal" },
  { label: "Hip-Shoulder", degrees: 38, status: "optimal" },
  { label: "Block Knee", degrees: 156, status: "marginal" },
];

/* ─── Main Composition (1080x1920 vertical, 450 frames) ────────────────── */

export const InstagramReel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ── Section 1: Logo (frame 0-45) ──────────────────────────────────── */

  const logoOpacity = interpolate(frame, [0, 8, 35, 45], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Section 2: Staggered words (frame 30-120) ────────────────────── */

  const wordsOpacity = interpolate(frame, [30, 40, 110, 120], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "BUILT FOR"
  const builtForProgress = spring({
    frame: frame - 35,
    fps,
    config: SMOOTH,
  });
  const builtForOpacity = interpolate(builtForProgress, [0, 1], [0, 1]);
  const builtForY = interpolate(builtForProgress, [0, 1], [20, 0]);

  // "ELITE"
  const eliteProgress = spring({
    frame: frame - 50,
    fps,
    config: BOUNCY,
  });
  const eliteScale = interpolate(eliteProgress, [0, 1], [0.8, 1]);
  const eliteOpacity = interpolate(eliteProgress, [0, 1], [0, 1]);

  // "THROWS COACHING"
  const coachingProgress = spring({
    frame: frame - 65,
    fps,
    config: SMOOTH,
  });
  const coachingOpacity = interpolate(coachingProgress, [0, 1], [0, 1]);
  const coachingY = interpolate(coachingProgress, [0, 1], [15, 0]);

  /* ── Section 3: Event cards (frame 105-195) ────────────────────────── */

  const cardsOpacity = interpolate(
    frame,
    [105, 112, 185, 195],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  /* ── Section 4: Quick-cut stats (frame 180-270) ────────────────────── */

  // Each stat gets 30 frames
  const getStatVisibility = (index: number) => {
    const start = 180 + index * 30;
    const end = start + 30;
    return interpolate(frame, [start, start + 5, end - 5, end], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  };

  /* ── Section 5: Angle readouts (frame 255-360) ────────────────────── */

  const anglesOpacity = interpolate(
    frame,
    [255, 265, 350, 360],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  /* ── Section 6: CTA (frame 345-450) ───────────────────────────────── */

  const ctaProgress = spring({
    frame: frame - 355,
    fps,
    config: SMOOTH,
  });
  const ctaOpacity = interpolate(ctaProgress, [0, 1], [0, 1]);
  const ctaY = interpolate(ctaProgress, [0, 1], [20, 0]);

  return (
    <AbsoluteFill>
      <Background />

      {/* Section 1: Logo stinger */}
      <AbsoluteFill
        style={{
          opacity: logoOpacity,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <LogoStinger variant="compact" />
      </AbsoluteFill>

      {/* Section 2: Staggered words */}
      <AbsoluteFill
        style={{
          opacity: wordsOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: FONT_BODY,
            fontSize: 24,
            fontWeight: 500,
            color: COLORS.muted,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            opacity: builtForOpacity,
            transform: `translateY(${builtForY}px)`,
          }}
        >
          BUILT FOR
        </span>
        <div
          style={{
            opacity: eliteOpacity,
            transform: `scale(${eliteScale})`,
          }}
        >
          <GoldText text="ELITE" fontSize={96} enterDelay={50} />
        </div>
        <span
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 48,
            fontWeight: 600,
            color: COLORS.white,
            opacity: coachingOpacity,
            transform: `translateY(${coachingY}px)`,
          }}
        >
          THROWS COACHING
        </span>
      </AbsoluteFill>

      {/* Section 3: Event cards */}
      <AbsoluteFill
        style={{
          opacity: cardsOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "0 80px",
        }}
      >
        {EVENT_CARDS.map((card, i) => {
          const cardProgress = spring({
            frame: frame - 110 - i * 10,
            fps,
            config: SNAPPY,
          });
          const cardY = interpolate(cardProgress, [0, 1], [60, 0]);
          const cardOpacity = interpolate(cardProgress, [0, 1], [0, 1]);

          return (
            <div
              key={card.event}
              style={{
                transform: `translateY(${cardY}px)`,
                opacity: cardOpacity,
                width: "100%",
              }}
            >
              <CutCornerCard
                enterDelay={999}
                glowOnReveal={false}
                style={{
                  padding: "16px 24px",
                  opacity: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  borderLeft: `4px solid ${EVENT_COLORS[card.event]}`,
                }}
              >
                <span
                  style={{
                    fontFamily: FONT_HEADING,
                    fontSize: 22,
                    fontWeight: 600,
                    color: COLORS.foreground,
                    flex: 1,
                  }}
                >
                  {EVENT_LABELS[card.event]}
                </span>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 22,
                    fontWeight: 500,
                    color: COLORS.gold,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {card.distance}
                </span>
              </CutCornerCard>
            </div>
          );
        })}
      </AbsoluteFill>

      {/* Section 4: Quick-cut stats */}
      {STATS.map((stat, i) => {
        const vis = getStatVisibility(i);
        return (
          <AbsoluteFill
            key={i}
            style={{
              opacity: vis,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <DataReveal
              value={stat.value}
              fontSize={96}
              enterDelay={180 + i * 30}
              countDuration={20}
            />
            <span
              style={{
                fontFamily: FONT_BODY,
                fontSize: 28,
                fontWeight: 500,
                color: COLORS.muted,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {stat.label}
            </span>
          </AbsoluteFill>
        );
      })}

      {/* Section 5: Angle readouts */}
      <AbsoluteFill
        style={{
          opacity: anglesOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {ANGLES.map((angle, i) => (
          <AngleReadout
            key={i}
            label={angle.label}
            degrees={angle.degrees}
            status={angle.status}
            enterDelay={260 + i * 12}
          />
        ))}
      </AbsoluteFill>

      {/* Section 6: CTA */}
      <AbsoluteFill
        style={{
          opacity: ctaOpacity,
          transform: `translateY(${ctaY}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <span
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 48,
            fontWeight: 700,
            color: COLORS.gold,
            textShadow: `0 0 40px rgba(255,200,0,0.3)`,
          }}
        >
          podiumthrows.com
        </span>
        <TaglineSlide
          text="Built for elite throws coaching"
          enterDelay={365}
          fontSize={22}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
