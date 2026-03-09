import { Composition, registerRoot } from "remotion";
import { OnboardingDemo } from "./OnboardingDemo";
import { AthleteInviteDemo } from "./AthleteInviteDemo";

const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="OnboardingDemo"
        component={OnboardingDemo}
        durationInFrames={765}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="AthleteInviteDemo"
        component={AthleteInviteDemo}
        durationInFrames={765}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

registerRoot(RemotionRoot);
