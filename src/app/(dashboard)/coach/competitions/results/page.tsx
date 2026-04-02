import { redirect } from "next/navigation";
import { requireCoachSession, getCoachMeets, getAthletePickerList } from "@/lib/data/coach";
import { ResultsEntryClient } from "./_results-entry-client";

export const metadata = { title: "Enter Results — Podium Throws" };

export default async function CoachCompetitionResultsPage() {
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

  return <ResultsEntryClient meets={meets} athletes={athletes} />;
}
