import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { OnboardingWizard } from "./_wizard";
import type { ThrowEvent } from "@/lib/throws/constants";
import type { ClassStanding, TurnDirection } from "./_state";

export const metadata = { title: "Welcome — Podium Throws" };

/**
 * Onboarding entry. Two paths:
 *
 *   - signup (default):    new user from /register, no profile data
 *   - invite (?from=invite): coach pre-filled events/gender via proxy claim
 *
 * Distinct from `requireUnonboardedAthlete`: that helper bounces if
 * `events.length > 0`, which is exactly the state of an invite-flow
 * athlete. We use a stricter completion check here — only
 * `onboardingCompletedAt` set means the athlete actually finished the
 * wizard. Pre-filled events without a completion timestamp = needs
 * onboarding (in invite mode).
 */
export default async function AthleteOnboardingPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    include: {
      coach: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!athlete) redirect("/login");

  // Already finished the wizard? Don't loop them.
  if (athlete.onboardingCompletedAt) {
    redirect("/athlete/dashboard");
  }

  const isInvite = searchParams.from === "invite";
  const prefillEvent = (athlete.events?.[0] ?? null) as ThrowEvent | null;

  return (
    <OnboardingWizard
      userId={session.userId}
      firstName={athlete.firstName}
      coachFirstName={athlete.coach.firstName}
      hasCoach={!athlete.isSelfCoached}
      prefill={{
        event: isInvite ? prefillEvent : null,
        classStanding: athlete.classStanding as ClassStanding | null,
        turnDirection: athlete.turnDirection as TurnDirection | null,
        gradYear: athlete.gradYear,
      }}
    />
  );
}
