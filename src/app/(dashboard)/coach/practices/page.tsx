import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import { getCoachPractices } from "@/lib/data/practices";
import { PracticesClient } from "./_practices-client";

export const metadata = { title: "Practices — Podium Throws" };

export default async function CoachPracticesPage() {
  let result;
  try {
    result = await requireCoachSession();
  } catch {
    redirect("/login");
  }

  // Default to current week (Monday–Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const startDate = monday.toISOString().split("T")[0];
  const endDate = sunday.toISOString().split("T")[0];

  const practices = await getCoachPractices(result.coach.id, startDate, endDate);

  return (
    <PracticesClient
      initialPractices={practices}
      initialStartDate={startDate}
      initialEndDate={endDate}
    />
  );
}
