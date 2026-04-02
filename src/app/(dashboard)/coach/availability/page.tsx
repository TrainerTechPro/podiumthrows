import { redirect } from "next/navigation";
import { requireCoachSession, getAthletePickerList } from "@/lib/data/coach";
import { getTeamAvailability } from "@/lib/data/availability";
import { getEventGroups } from "@/lib/data/event-groups";
import { AvailabilityDashboard } from "./_availability-dashboard";

export const metadata = { title: "Team Availability — Podium Throws" };

export default async function CoachAvailabilityPage() {
  let result: Awaited<ReturnType<typeof requireCoachSession>>;
  try {
    result = await requireCoachSession();
  } catch {
    redirect("/login");
  }

  const [availability, athletes, eventGroups] = await Promise.all([
    getTeamAvailability(result.coach.id),
    getAthletePickerList(result.coach.id),
    getEventGroups(result.coach.id),
  ]);

  return (
    <AvailabilityDashboard
      initialData={availability}
      athletes={athletes}
      eventGroups={eventGroups.map((g) => ({ id: g.id, name: g.name }))}
    />
  );
}
