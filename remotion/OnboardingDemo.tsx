import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

import { Background } from "./components/Background";
import { TitleScene } from "./scenes/TitleScene";
import { WelcomeScene } from "./scenes/WelcomeScene";
import { ChecklistScene } from "./scenes/ChecklistScene";
import { ProfileScene } from "./scenes/ProfileScene";
import { InviteScene } from "./scenes/InviteScene";
import { OutroScene } from "./scenes/OutroScene";

const FADE = 15; // frames for crossfade

type SceneEntry = {
  component: React.FC;
  duration: number;
};

const SCENES: SceneEntry[] = [
  { component: TitleScene, duration: 105 },
  { component: WelcomeScene, duration: 135 },
  { component: ChecklistScene, duration: 150 },
  { component: ProfileScene, duration: 150 },
  { component: InviteScene, duration: 180 },
  { component: OutroScene, duration: 120 },
];

const FadeWrapper: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
  isFirst: boolean;
  isLast: boolean;
}> = ({ children, durationInFrames, isFirst, isLast }) => {
  const frame = useCurrentFrame();

  const fadeIn = isFirst
    ? 1
    : interpolate(frame, [0, FADE], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  const fadeOut = isLast
    ? 1
    : interpolate(
        frame,
        [durationInFrames - FADE, durationInFrames],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>{children}</AbsoluteFill>
  );
};

export const OnboardingDemo: React.FC = () => {
  // Calculate start frames with overlap
  const startFrames: number[] = [];
  let current = 0;
  for (let i = 0; i < SCENES.length; i++) {
    startFrames.push(current);
    current += SCENES[i].duration - (i < SCENES.length - 1 ? FADE : 0);
  }

  return (
    <AbsoluteFill>
      <Background />

      {SCENES.map((scene, i) => {
        const Component = scene.component;
        return (
          <Sequence
            key={i}
            from={startFrames[i]}
            durationInFrames={scene.duration}
            premountFor={FADE}
          >
            <FadeWrapper
              durationInFrames={scene.duration}
              isFirst={i === 0}
              isLast={i === SCENES.length - 1}
            >
              <Component />
            </FadeWrapper>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
