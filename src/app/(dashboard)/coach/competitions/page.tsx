import { redirect } from "next/navigation";
import { requireCoachSession, getCoachMeets, getAthletePickerList } from "@/lib/data/coach";
import { CompetitionsClient } from "./_competitions-client";

export const metadata = { title: "Competitions — Podium Throws" };

export default async function CoachCompetitionsPage() {
  let result: Awaited<ReturnType<typeof requireCoachSession>>;
  try {
    result = await requireCoachSession();
  } catch {
    redirect("/login");
  }

  const [meets, athletes] = await Promise.all([
    getCoachMeets(result.coach.id),
    getAthletePickerList(result.coach.id),
  ]);

  return <CompetitionsClient initialMeets={meets} athletes={athletes} />;
}
