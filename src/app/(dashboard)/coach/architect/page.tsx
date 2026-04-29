import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { ArchitectClient } from "./_architect-client";

export const metadata = { title: "Architect — Podium Throws" };

export default async function CoachArchitectPage() {
  let result: Awaited<ReturnType<typeof requireCoachSession>>;
  try {
    result = await requireCoachSession();
  } catch {
    redirect("/login");
  }

  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId: result.coach.id },
    include: {
      throwsPRs: {
        where: { source: "COMPETITION" },
        orderBy: { distance: "desc" },
      },
    },
    orderBy: { firstName: "asc" },
  });

  const athleteCards = athletes.map((a) => {
    const primaryEvent = a.events[0] ?? "SHOT_PUT";
    const bestPR = a.throwsPRs
      .filter((pr) => pr.event === primaryEvent)
      .sort((x, y) => y.distance - x.distance)[0];

    return {
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      gender: a.gender ?? "MALE",
      events: a.events as string[],
      pr: bestPR?.distance ?? null,
      prEvent: primaryEvent,
      dateOfBirth: a.dateOfBirth?.toISOString() ?? null,
    };
  });

  return <ArchitectClient athletes={athleteCards} />;
}
