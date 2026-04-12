import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import { TeamsClient } from "./_teams-client";

export const metadata = { title: "Groups — Podium Throws" };

export default async function TeamsPage() {
  try {
    await requireCoachSession();
  } catch {
    redirect("/login");
  }
  return <TeamsClient />;
}
