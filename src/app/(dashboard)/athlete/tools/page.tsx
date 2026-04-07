import { requireAthleteSession } from "@/lib/data/athlete";
import ToolsPage from "@/components/tools-page";
import type { ProfileBodyStats } from "@/components/tools-page";

export default async function AthleteToolsPage() {
  const { athlete } = await requireAthleteSession();

  const age =
    athlete.dateOfBirth != null
      ? Math.floor(
          (Date.now() - new Date(athlete.dateOfBirth).getTime()) /
            (1000 * 60 * 60 * 24 * 365.25)
        )
      : null;

  const profileBodyStats: ProfileBodyStats = {
    weightKg: athlete.weightKg,
    heightCm: athlete.heightCm,
    gender: athlete.gender,
    age,
  };

  return <ToolsPage isCoach={false} profileBodyStats={profileBodyStats} />;
}
