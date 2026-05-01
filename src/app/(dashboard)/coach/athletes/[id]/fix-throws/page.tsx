import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { FixThrowHistoryClient } from "@/app/(dashboard)/athlete/settings/fix-throw-history/_fix-throws-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fix throw history — Coach" };

/**
 * /coach/athletes/[id]/fix-throws
 *
 * Coach-side mirror of /athlete/settings/fix-throw-history. Same client
 * component, scoped to the athlete in the route param. Useful when an
 * athlete can't (or won't) clean up their own legacy throws — coaches can
 * resolve unassigned/ambiguous catalog matches on their behalf.
 *
 * Auth: requires session, COACH role on the route's athlete (canAccessAthlete
 * enforces roster membership; non-roster coaches → 404, not 403, to avoid
 * leaking athlete existence).
 */
export default async function CoachFixThrowsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: athleteId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "COACH") redirect("/athlete/dashboard");

  if (!(await canAccessAthlete(session.userId, session.role, athleteId))) {
    notFound();
  }

  const athlete = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: { firstName: true, lastName: true },
  });
  if (!athlete) notFound();

  const fullName = `${athlete.firstName} ${athlete.lastName}`;

  return (
    <FixThrowHistoryClient
      athleteId={athleteId}
      backHref={`/coach/athletes/${athleteId}`}
      backLabel={`Back to ${fullName}`}
      title={`Fix ${fullName}'s throw history`}
      intro={`Older throws for ${fullName} were stored with raw kg values, losing the original unit. Confirm the catalog match for each group below so their PRs use the right label.`}
    />
  );
}
