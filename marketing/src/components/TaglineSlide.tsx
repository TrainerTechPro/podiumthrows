import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../lib/tokens";
import { FONT_BODY } from "../lib/fonts";
import { SMOOTH } from "../lib/spring-presets";

type Props = {
  text: string;
  enterDelay?: number;
  wordDelay?: number;
  fontSize?: number;
  color?: string;
};

export const TaglineSlide: React.FC<Props> = ({
  text,
  enterDelay = 0,
  wordDelay = 4,
  fontSize = 24,
  color = COLORS.muted,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = text.split(" ");

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
      {words.map((word, i) => {
        const progress = spring({
          frame: frame - enterDelay - i * wordDelay,
          fps,
          config: SMOOTH,
        });
        const y = interpolate(progress, [0, 1], [10, 0]);
        const opacity = interpolate(progress, [0, 1], [0, 1]);

        return (
          <span
            key={i}
            style={{
              fontFamily: FONT_BODY,
              fontSize,
              fontWeight: 500,
              color,
              transform: `translateY(${y}px)`,
              opacity,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
