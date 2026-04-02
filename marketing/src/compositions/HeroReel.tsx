import "../style.css";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { LogoScene } from "../scenes/LogoScene";
import { TaglineScene } from "../scenes/TaglineScene";
import { ProgrammingScene } from "../scenes/ProgrammingScene";
import { PoseAnalysisScene } from "../scenes/PoseAnalysisScene";
import { DashboardScene } from "../scenes/DashboardScene";
import { PRCelebrationScene } from "../scenes/PRCelebrationScene";
import { EventMontageScene } from "../scenes/EventMontageScene";
import { CTAScene } from "../scenes/CTAScene";

const TRANSITION_DURATION = 15; // frames

export const HeroReel: React.FC = () => {
  return (
    <AbsoluteFill>
      <TransitionSeries>
        {/* Logo Stinger — 2.5s */}
        <TransitionSeries.Sequence durationInFrames={75}>
          <LogoScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Tagline — 2.5s */}
        <TransitionSeries.Sequence durationInFrames={75}>
          <TaglineScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Programming UI — 5s */}
        <TransitionSeries.Sequence durationInFrames={150}>
          <ProgrammingScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Pose Analysis — 5s */}
        <TransitionSeries.Sequence durationInFrames={150}>
          <PoseAnalysisScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Dashboard Stats — 5s */}
        <TransitionSeries.Sequence durationInFrames={150}>
          <DashboardScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* PR Celebration — 4s */}
        <TransitionSeries.Sequence durationInFrames={120}>
          <PRCelebrationScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* Event Montage — 4.5s */}
        <TransitionSeries.Sequence durationInFrames={135}>
          <EventMontageScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        {/* CTA — 5s */}
        <TransitionSeries.Sequence durationInFrames={150}>
          <CTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
