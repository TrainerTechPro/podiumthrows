import { requireAthleteSession } from "@/lib/data/athlete";
import { getAthleteGoalsWithProgress } from "@/lib/data/athlete";
import { redirect } from "next/navigation";
import { GoalsClient } from "./_goals-client";

export const metadata = { title: "My Goals — Podium Throws" };

export default async function AthleteGoalsPage() {
  let athlete;
  try {
    const session = await requireAthleteSession();
    athlete = session.athlete;
  } catch {
    redirect("/login");
  }

  const goals = await getAthleteGoalsWithProgress(athlete.id);

  return <GoalsClient initialGoals={goals} />;
}
