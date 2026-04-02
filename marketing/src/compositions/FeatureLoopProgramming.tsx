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
import { GoldText } from "../components/GoldText";
import { CutCornerCard } from "../components/CutCornerCard";
import { TaglineSlide } from "../components/TaglineSlide";
import { EventBar } from "../components/EventBar";

/* ─── Session row data ──────────────────────────────────────────────────── */

const SESSIONS = [
  {
    event: "SHOT_PUT",
    name: "Heavy Shot — AM",
    throws: 42,
  },
  {
    event: "DISCUS",
    name: "Discus Transfer",
    throws: 36,
  },
  {
    event: "HAMMER",
    name: "Hammer Technique",
    throws: 30,
  },
];

/* ─── Detail bars for the expanded session ──────────────────────────────── */

const DETAIL_BARS = [
  { event: "SHOT_PUT", percentage: 85, label: "9 kg Heavy", count: 18 },
  { event: "SHOT_PUT", percentage: 65, label: "8 kg Mid", count: 14 },
  { event: "SHOT_PUT", percentage: 45, label: "7.26 kg Comp", count: 10 },
];

/* ─── Session Row Component ─────────────────────────────────────────────── */

const SessionRow: React.FC<{
  event: string;
  name: string;
  throws: number;
  enterDelay: number;
  expanded?: boolean;
  expandDelay?: number;
}> = ({ event, name, throws, enterDelay, expanded = false, expandDelay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideProgress = spring({
    frame: frame - enterDelay,
    fps,
    config: SMOOTH,
  });

  const translateY = interpolate(slideProgress, [0, 1], [30, 0]);
  const opacity = interpolate(slideProgress, [0, 1], [0, 1]);

  const expandProgress = expanded
    ? spring({ frame: frame - expandDelay, fps, config: SNAPPY })
    : 0;

  const scale = interpolate(expandProgress, [0, 1], [1, 1.04]);

  const color = EVENT_COLORS[event] || COLORS.gold;

  return (
    <div
      style={{
        transform: `translateY(${translateY}px) scale(${scale})`,
        opacity,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 18px",
          borderRadius: 6,
          backgroundColor: expanded
            ? "rgba(255,255,255,0.06)"
            : "rgba(255,255,255,0.03)",
          border: expanded
            ? `1px solid ${color}40`
            : "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {/* Event color stripe */}
        <div
          style={{
            width: 4,
            height: 32,
            borderRadius: 2,
            backgroundColor: color,
            flexShrink: 0,
          }}
        />

        {/* Session name */}
        <span
          style={{
            fontFamily: FONT_BODY,
            fontSize: 18,
            fontWeight: 500,
            color: COLORS.foreground,
            flex: 1,
          }}
        >
          {name}
        </span>

        {/* Throw count */}
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 16,
            fontWeight: 500,
            color: COLORS.muted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {throws} throws
        </span>
      </div>

      {/* Expanded detail: EventBars */}
      {expanded && expandProgress > 0.01 && (
        <div
          style={{
            paddingLeft: 36,
            paddingRight: 18,
            opacity: interpolate(expandProgress, [0, 0.5, 1], [0, 0, 1]),
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {DETAIL_BARS.map((bar, i) => (
            <EventBar
              key={i}
              event={bar.event}
              percentage={bar.percentage}
              label={bar.label}
              count={bar.count}
              enterDelay={(expandDelay || 0) + i * 6}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Main Composition ──────────────────────────────────────────────────── */

export const FeatureLoopProgramming: React.FC = () => {
  const frame = useCurrentFrame();

  // Loop fade bookends: first 15 and last 15 frames
  const loopOpacity = interpolate(
    frame,
    [0, 15, 225, 240],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ opacity: loopOpacity }}>
      <Background />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: 60,
        }}
      >
        {/* Title */}
        <div style={{ marginTop: 40 }}>
          <GoldText text="PROGRAMMING" fontSize={56} enterDelay={0} />
        </div>

        {/* Calendar card with session rows */}
        <div style={{ marginTop: 40, width: "100%", maxWidth: 700 }}>
          <CutCornerCard enterDelay={15} style={{ padding: 28 }}>
            {/* Week header */}
            <div
              style={{
                fontFamily: FONT_HEADING,
                fontSize: 14,
                fontWeight: 600,
                color: COLORS.muted,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 18,
              }}
            >
              Week 4 — Accumulation
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {SESSIONS.map((session, i) => (
                <SessionRow
                  key={i}
                  event={session.event}
                  name={session.name}
                  throws={session.throws}
                  enterDelay={30 + i * 8}
                  expanded={i === 0}
                  expandDelay={75}
                />
              ))}
            </div>
          </CutCornerCard>
        </div>

        {/* Tagline */}
        <div style={{ marginTop: 50 }}>
          <TaglineSlide
            text="Powered by Bondarchuk Methodology"
            enterDelay={135}
            fontSize={22}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
