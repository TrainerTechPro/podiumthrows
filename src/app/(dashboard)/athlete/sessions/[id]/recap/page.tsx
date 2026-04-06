import { notFound } from "next/navigation";
import { requireAthleteSession } from "@/lib/data/athlete";
import { computeSessionRecap } from "@/lib/data/session-recap";
import { RecapClient } from "./_recap-client";

export const dynamic = "force-dynamic";

export default async function RecapPage({
  params,
}: {
  params: { id: string };
}) {
  const { athlete } = await requireAthleteSession();

  const recap = await computeSessionRecap(athlete.id, params.id);
  if (!recap) {
    notFound();
  }

  const athleteName = `${athlete.firstName}`.trim() || "Athlete";

  return <RecapClient recap={recap} athleteFirstName={athleteName} />;
}
