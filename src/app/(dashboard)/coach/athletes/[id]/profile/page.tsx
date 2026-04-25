import { redirect, notFound } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";

/**
 * Per-athlete Throws Profile sub-route. The full Throws Profile UI is a
 * 3334-line client component at /coach/throws/profile that reads
 * `?athleteId=` via useSearchParams. Properly inlining it here requires
 * a prop refactor — deferred to a follow-up commit.
 *
 * For now this page server-redirects to the legacy URL with the athleteId
 * preserved, so /coach/athletes/[id]/profile is a working coach destination
 * (linked from the athlete-detail header) without the inline-extraction
 * scope. Commit 5 keeps /coach/throws/profile as the canonical render
 * surface; when extraction lands, the redirect direction flips.
 *
 * NOTE: The colocated /profile/edit route (athlete profile fields, distinct
 * from Throws Profile) is unaffected — it's a sibling to this page.tsx.
 */
export default async function CoachAthleteProfilePage({ params }: { params: { id: string } }) {
  const { coach } = await requireCoachSession();

  const athlete = await prisma.athleteProfile.findFirst({
    where: { id: params.id, coachId: coach.id },
    select: { id: true },
  });

  if (!athlete) notFound();

  redirect(`/coach/throws/profile?athleteId=${athlete.id}`);
}
