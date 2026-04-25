import { redirect } from "next/navigation";
import { requireCoachSession, getAthletePickerList } from "@/lib/data/coach";
import { getCoachPractices } from "@/lib/data/practices";
import { getTeamAvailability } from "@/lib/data/availability";
import { getEventGroups } from "@/lib/data/event-groups";
import { CalendarTabsClient } from "./_calendar-tabs";

export const metadata = { title: "Calendar — Podium Throws" };

export default async function CoachCalendarPage() {
  let result: Awaited<ReturnType<typeof requireCoachSession>>;
  try {
    result = await requireCoachSession();
  } catch {
    redirect("/login");
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const startDate = monday.toISOString().split("T")[0];
  const endDate = sunday.toISOString().split("T")[0];

  const [practices, availability, athletes, eventGroups] = await Promise.all([
    getCoachPractices(result.coach.id, startDate, endDate),
    getTeamAvailability(result.coach.id),
    getAthletePickerList(result.coach.id),
    getEventGroups(result.coach.id),
  ]);

  return (
    <CalendarTabsClient
      initialPractices={practices}
      initialStartDate={startDate}
      initialEndDate={endDate}
      availabilityData={availability}
      athletes={athletes}
      eventGroups={eventGroups.map((g) => ({ id: g.id, name: g.name }))}
    />
  );
}
