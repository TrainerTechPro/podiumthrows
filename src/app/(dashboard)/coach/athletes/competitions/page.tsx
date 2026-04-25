import { redirect } from "next/navigation";
import {
  requireCoachSession,
  getCoachMeets,
  getAthletePickerList,
  getCoachCompetitionList,
} from "@/lib/data/coach";
import { CompetitionsClient } from "../../competitions/_competitions-client";

export const metadata = { title: "Competitions — Podium Throws" };

export default async function CoachAthletesCompetitionsPage() {
  let result: Awaited<ReturnType<typeof requireCoachSession>>;
  try {
    result = await requireCoachSession();
  } catch {
    redirect("/login");
  }

  const [meets, athletes, competitionList] = await Promise.all([
    getCoachMeets(result.coach.id),
    getAthletePickerList(result.coach.id),
    getCoachCompetitionList(result.coach.id),
  ]);

  return (
    <CompetitionsClient
      initialMeets={meets}
      athletes={athletes}
      competitionList={competitionList}
    />
  );
}
