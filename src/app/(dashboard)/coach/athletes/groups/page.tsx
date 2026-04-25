import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import { TeamsClient } from "../../teams/_teams-client";

export const metadata = { title: "Groups — Podium Throws" };

export default async function CoachAthletesGroupsPage() {
  try {
    await requireCoachSession();
  } catch {
    redirect("/login");
  }
  return <TeamsClient />;
}
