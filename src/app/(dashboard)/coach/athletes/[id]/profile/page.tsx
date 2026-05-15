import { redirect, notFound } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";

/**
 * Throws Profile retired (MVP surface cut). The unified
 * `/coach/athletes/[id]` scroll page is the canonical destination for
 * everything the old Throws Profile aggregated. This shell catches old
 * deep-links into the per-athlete profile sub-path and lands them there.
 *
 * Note: the colocated `/profile/edit` route (athlete bio fields) is a
 * sibling — unaffected by this redirect.
 */
export default async function CoachAthleteProfilePage({ params }: { params: { id: string } }) {
  const { coach } = await requireCoachSession();

  const athlete = await prisma.athleteProfile.findFirst({
    where: { id: params.id, coachId: coach.id },
    select: { id: true },
  });

  if (!athlete) notFound();

  redirect(`/coach/athletes/${athlete.id}`);
}
