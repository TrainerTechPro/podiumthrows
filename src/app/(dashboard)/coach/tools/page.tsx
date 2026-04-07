import { requireCoachSession } from "@/lib/data/coach";
import ToolsPage from "@/components/tools-page";
import type { ProfileBodyStats } from "@/components/tools-page";

export default async function CoachToolsPage() {
  // CoachProfile has no body stats fields — pass nulls so calculators fall back to manual entry
  await requireCoachSession();

  const profileBodyStats: ProfileBodyStats = {
    weightKg: null,
    heightCm: null,
    gender: null,
    age: null,
  };

  return <ToolsPage isCoach={true} profileBodyStats={profileBodyStats} />;
}
