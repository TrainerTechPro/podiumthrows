import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
} from "remotion";

import { Background } from "./components/Background";
import { AthleteTitleScene } from "./scenes/athlete/AthleteTitleScene";
import { TextMessageScene } from "./scenes/athlete/TextMessageScene";
import { RegisterScene } from "./scenes/athlete/RegisterScene";
import { OnboardingWizardScene } from "./scenes/athlete/OnboardingWizardScene";
import { DashboardScene } from "./scenes/athlete/DashboardScene";
import { AthleteOutroScene } from "./scenes/athlete/AthleteOutroScene";

const FADE = 15; // frames for crossfade

type SceneEntry = {
  component: React.FC;
  duration: number;
};

const SCENES: SceneEntry[] = [
  { component: AthleteTitleScene, duration: 105 },
  { component: TextMessageScene, duration: 150 },
  { component: RegisterScene, duration: 165 },
  { component: OnboardingWizardScene, duration: 150 },
  { component: DashboardScene, duration: 150 },
  { component: AthleteOutroScene, duration: 120 },
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

export const AthleteInviteDemo: React.FC = () => {
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
