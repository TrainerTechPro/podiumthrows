import { notFound } from "next/navigation";
import { computeSessionRecap } from "@/lib/data/session-recap";
import { RecapClient } from "../../sessions/[id]/recap/_recap-client";

export async function TrainingSessionRecap({
  athleteId,
  athleteFirstName,
  sessionId,
}: {
  athleteId: string;
  athleteFirstName: string;
  sessionId: string;
}) {
  const recap = await computeSessionRecap(athleteId, sessionId);
  if (!recap) notFound();
  return <RecapClient recap={recap} athleteFirstName={athleteFirstName} />;
}
