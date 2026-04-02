import React from "react";
import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { CutCornerCard } from "../components/CutCornerCard";
import { DataReveal } from "../components/DataReveal";
import { EventBar } from "../components/EventBar";
import { COLORS } from "../lib/tokens";
import { FONT_BODY } from "../lib/fonts";

const STAT_CARDS = [
  { label: "Total Analyses", value: 47, decimals: 0, suffix: "", enterDelay: 0 },
  { label: "Season PR Rate", value: 73, decimals: 0, suffix: "%", enterDelay: 8 },
  { label: "Avg Readiness", value: 8.2, decimals: 1, suffix: "", enterDelay: 16 },
];

const EVENT_BARS = [
  { event: "SHOT_PUT", percentage: 42, enterDelay: 20 },
  { event: "DISCUS", percentage: 28, enterDelay: 28 },
  { event: "HAMMER", percentage: 18, enterDelay: 36 },
  { event: "JAVELIN", percentage: 12, enterDelay: 44 },
];

/**
 * DashboardScene — 150 frames / 5s @ 30fps
 * Top row: 3 stat cards. Below: 4 event distribution bars.
 */
export const DashboardScene: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 80px",
          gap: 40,
        }}
      >
        {/* Top row: 3 stat cards */}
        <div style={{ display: "flex", gap: 20 }}>
          {STAT_CARDS.map((card) => (
            <CutCornerCard
              key={card.label}
              width={200}
              enterDelay={card.enterDelay}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: 20,
              }}
            >
              <span
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  color: COLORS.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {card.label}
              </span>
              <DataReveal
                value={card.value}
                decimals={card.decimals}
                suffix={card.suffix}
                enterDelay={card.enterDelay}
                fontSize={40}
              />
            </CutCornerCard>
          ))}
        </div>

        {/* Event distribution bars */}
        <div style={{ width: 600, display: "flex", flexDirection: "column", gap: 8 }}>
          {EVENT_BARS.map((bar) => (
            <EventBar
              key={bar.event}
              event={bar.event}
              percentage={bar.percentage}
              enterDelay={bar.enterDelay}
            />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
