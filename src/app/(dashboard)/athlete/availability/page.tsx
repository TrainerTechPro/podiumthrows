import { requireAthleteSession } from "@/lib/data/athlete";
import { getAthleteAvailability } from "@/lib/data/availability";
import { AvailabilityClient } from "./_availability-client";

export const metadata = { title: "My Availability — Podium Throws" };

export default async function AthleteAvailabilityPage() {
  const { athlete } = await requireAthleteSession();
  const availability = await getAthleteAvailability(athlete.id);
  return <AvailabilityClient initialData={availability} />;
}
