import { Composition, Folder, Still } from "remotion";
import { HeroReel } from "./compositions/HeroReel";
import { FeatureLoopProgramming } from "./compositions/FeatureLoopProgramming";
import { FeatureLoopPoseAnalysis } from "./compositions/FeatureLoopPoseAnalysis";
import { FeatureLoopPRTracking } from "./compositions/FeatureLoopPRTracking";
import { InstagramReel } from "./compositions/InstagramReel";
import { SocialAdCoachPitch } from "./compositions/SocialAdCoachPitch";
import { Thumbnail } from "./compositions/Thumbnail";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ── Hero ── */}
      <Composition
        id="HeroReel"
        component={HeroReel}
        durationInFrames={900}
        fps={FPS}
        width={1920}
        height={1080}
      />

      {/* ── Feature Loops (Square, 8s) ── */}
      <Folder name="Feature-Loops">
        <Composition
          id="FeatureLoop-Programming"
          component={FeatureLoopProgramming}
          durationInFrames={240}
          fps={FPS}
          width={1080}
          height={1080}
        />
        <Composition
          id="FeatureLoop-PoseAnalysis"
          component={FeatureLoopPoseAnalysis}
          durationInFrames={240}
          fps={FPS}
          width={1080}
          height={1080}
        />
        <Composition
          id="FeatureLoop-PRTracking"
          component={FeatureLoopPRTracking}
          durationInFrames={240}
          fps={FPS}
          width={1080}
          height={1080}
        />
      </Folder>

      {/* ── Social ── */}
      <Folder name="Social">
        <Composition
          id="InstagramReel"
          component={InstagramReel}
          durationInFrames={450}
          fps={FPS}
          width={1080}
          height={1920}
        />
        <Composition
          id="SocialAd-CoachPitch"
          component={SocialAdCoachPitch}
          durationInFrames={450}
          fps={FPS}
          width={1920}
          height={1080}
        />
      </Folder>

      {/* ── Stills ── */}
      <Still
        id="Thumbnail"
        component={Thumbnail}
        width={1280}
        height={720}
      />
    </>
  );
};
