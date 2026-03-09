import { requireCoachSession, getTeamGoals, getAthletePickerList } from "@/lib/data/coach";
import { redirect } from "next/navigation";
import { CoachGoalsClient } from "./_goals-client";

export const metadata = { title: "Team Goals — Podium Throws" };

export default async function CoachGoalsPage() {
  let result: Awaited<ReturnType<typeof requireCoachSession>>;
  try {
    result = await requireCoachSession();
  } catch {
    redirect("/login");
  }

  const [goals, athletes] = await Promise.all([
    getTeamGoals(result.coach.id),
    getAthletePickerList(result.coach.id),
  ]);

  return <CoachGoalsClient initialGoals={goals} athletes={athletes} />;
}
