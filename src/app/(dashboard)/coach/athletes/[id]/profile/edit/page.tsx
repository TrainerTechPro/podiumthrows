import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireCoachSession } from "@/lib/data/coach";
import { prisma } from "@/lib/prisma";
import { CoachProfileEditForm } from "./_form";

interface PageProps {
  params: { id: string };
}

export default async function CoachProfileEditPage({ params }: PageProps) {
  const { coach } = await requireCoachSession();

  const athlete = await prisma.athleteProfile.findFirst({
    where: { id: params.id, coachId: coach.id },
    include: {
      user: { select: { claimedAt: true, email: true } },
    },
  });

  if (!athlete) notFound();

  const isClaimed = athlete.user.claimedAt != null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 space-y-6">
      {/* Back link */}
      <Link
        href={`/coach/athletes/${athlete.id}`}
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        Back to {athlete.firstName}
      </Link>

      {/* Context banner */}
      <div className="border-l-4 border-primary-500 bg-surface-100 dark:bg-surface-800 px-4 py-3 rounded-r-lg">
        <p className="text-sm text-[var(--foreground)]">
          Editing{" "}
          <span className="font-semibold">
            {athlete.firstName} {athlete.lastName}
          </span>
          &apos;s profile
        </p>
        {isClaimed && (
          <p className="text-xs text-[var(--muted)] mt-1">
            Some core fields are managed by the athlete and read-only
          </p>
        )}
      </div>

      {/* Form */}
      <CoachProfileEditForm
        athleteId={athlete.id}
        isClaimed={isClaimed}
        initial={{
          firstName: athlete.firstName,
          lastName: athlete.lastName,
          gender: athlete.gender as string,
          events: athlete.events as string[],
          dateOfBirth: athlete.dateOfBirth?.toISOString().slice(0, 10) ?? "",
          heightCm: athlete.heightCm,
          weightKg: athlete.weightKg,
          classStanding: athlete.classStanding ?? "",
          gradYear: athlete.gradYear,
          turnDirection: athlete.turnDirection ?? "",
          strengthNumbers:
            (athlete.strengthNumbers as Record<string, number | null> | null) ?? {},
          competitionPRs:
            (athlete.competitionPRs as Record<string, number | null> | null) ?? {},
        }}
      />
    </div>
  );
}
