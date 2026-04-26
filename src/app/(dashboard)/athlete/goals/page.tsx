import { redirect } from "next/navigation";
import { requireAthleteSession } from "@/lib/data/athlete";
import { getAthleteGoalsPageData } from "@/lib/data/goals";
import { GoalsClient } from "./_goals-client";

export const metadata = { title: "My Goals — Podium Throws" };

export default async function AthleteGoalsPage() {
  let athleteId: string;
  try {
    const session = await requireAthleteSession();
    athleteId = session.athlete.id;
  } catch {
    redirect("/login");
  }

  const initialData = await getAthleteGoalsPageData(athleteId);

  return <GoalsClient initialData={initialData} />;
}
