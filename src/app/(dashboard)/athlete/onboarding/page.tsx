import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { OnboardingWizard } from "./_wizard";

export default async function AthleteOnboardingPage() {
  const session = await getSession();
  if (!session || session.role !== "ATHLETE") redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: {
      firstName: true,
      events: true,
      dateOfBirth: true,
      heightCm: true,
    },
  });

  if (!athlete) redirect("/login");

  // Already onboarded — skip to dashboard
  const isOnboarded =
    athlete.events.length > 0 ||
    athlete.dateOfBirth !== null ||
    athlete.heightCm !== null;

  if (isOnboarded) redirect("/athlete/dashboard");

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Welcome, {athlete.firstName}!
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Let&apos;s set up your athlete profile in two quick steps.
        </p>
      </div>

      <div className="card p-6">
        <OnboardingWizard firstName={athlete.firstName} />
      </div>
    </div>
  );
}
