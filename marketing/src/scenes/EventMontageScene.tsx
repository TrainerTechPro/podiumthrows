import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { Background } from "../components/Background";
import { DataReveal } from "../components/DataReveal";
import { COLORS, EVENT_COLORS, EVENT_LABELS } from "../lib/tokens";
import { FONT_HEADING } from "../lib/fonts";
import { SMOOTH, SNAPPY } from "../lib/spring-presets";

const EVENTS = [
  { key: "SHOT_PUT", distance: 18.42, enterDelay: 0 },
  { key: "DISCUS", distance: 52.16, enterDelay: 10 },
  { key: "HAMMER", distance: 71.3, enterDelay: 20 },
  { key: "JAVELIN", distance: 76.84, enterDelay: 30 },
];

/**
 * EventMontageScene — 135 frames / 4.5s @ 30fps
 * "BY EVENT" title + 2x2 grid of event cards with distances.
 */
export const EventMontageScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title entrance
  const titleProgress = spring({ frame, fps, config: SMOOTH });
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [-15, 0]);

  return (
    <AbsoluteFill>
      <Background />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          padding: "0 80px",
        }}
      >
        {/* Title */}
        <div
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.gold,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          By Event
        </div>

        {/* 2x2 grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            width: 620,
          }}
        >
          {EVENTS.map((ev) => {
            const cardProgress = spring({
              frame: frame - ev.enterDelay - 10,
              fps,
              config: SNAPPY,
            });
            const cardY = interpolate(cardProgress, [0, 1], [40, 0]);
            const cardOpacity = interpolate(cardProgress, [0, 1], [0, 1]);
            const eventColor = EVENT_COLORS[ev.key] || COLORS.gold;
            const eventLabel = EVENT_LABELS[ev.key] || ev.key;

            return (
              <div
                key={ev.key}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  backgroundColor: COLORS.cardBg,
                  border: `1px solid ${COLORS.cardBorder}`,
                  borderRadius: 4,
                  overflow: "hidden",
                  transform: `translateY(${cardY}px)`,
                  opacity: cardOpacity,
                }}
              >
                {/* Left color border */}
                <div
                  style={{
                    width: 4,
                    backgroundColor: eventColor,
                    flexShrink: 0,
                  }}
                />

                {/* Card content */}
                <div
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT_HEADING,
                      fontSize: 16,
                      fontWeight: 600,
                      color: eventColor,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {eventLabel}
                  </span>
                  <DataReveal
                    value={ev.distance}
                    decimals={2}
                    suffix="m"
                    fontSize={32}
                    enterDelay={ev.enterDelay + 10}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
