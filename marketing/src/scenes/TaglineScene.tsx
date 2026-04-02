import React from "react";
import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { TaglineSlide } from "../components/TaglineSlide";

/**
 * TaglineScene — 75 frames / 2.5s @ 30fps
 * Background + TaglineSlide centered: "Built for Elite Throws Coaching"
 */
export const TaglineScene: React.FC = () => {
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
        <TaglineSlide
          text="Built for Elite Throws Coaching"
          fontSize={32}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
