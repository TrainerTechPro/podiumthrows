import { requireUnonboardedAthlete } from "@/lib/data/athlete";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { OnboardingWizard } from "./_wizard";

export default async function AthleteOnboardingPage() {
  const { athlete } = await requireUnonboardedAthlete();

  return (
    <div className="max-w-lg mx-auto py-4 sm:py-8">
      <ScrollProgressBar />
      <OnboardingWizard
        firstName={athlete.firstName}
        coachFirstName={athlete.coach.firstName}
        coachLastName={athlete.coach.lastName}
        coachAvatarUrl={athlete.coach.avatarUrl}
      />
    </div>
  );
}
