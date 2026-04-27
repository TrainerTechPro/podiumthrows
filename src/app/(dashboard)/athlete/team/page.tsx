import { Users, UserPlus } from "lucide-react";
import Link from "next/link";
import { requireAthleteSession } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamTabs } from "./_team-tabs";

export const dynamic = "force-dynamic";

export default async function AthleteTeamPage() {
  const { athlete } = await requireAthleteSession();

  // Roster context — drives the "no team" empty state. Self-coached
  // athletes have a coach row pointing at their own placeholder coach,
  // so we additionally treat solo rosters (just the viewer) as no-team.
  const teammateCount = await prisma.athleteProfile.count({
    where: {
      coachId: athlete.coachId,
      id: { not: athlete.id },
    },
  });

  if (athlete.isSelfCoached || teammateCount === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <header className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary-500" strokeWidth={1.75} aria-hidden="true" />
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Team</h1>
        </header>

        <EmptyState
          icon={<UserPlus size={48} strokeWidth={1.75} aria-hidden="true" />}
          title="You haven't been added to a team yet"
          description="Ask your coach to invite you. Once teammates are on board, their PRs and streaks land here."
          action={
            <Link
              href="/athlete/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-[var(--foreground)] bg-[var(--card-bg)] border border-[var(--card-border)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              Back to dashboard
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary-500" strokeWidth={1.75} aria-hidden="true" />
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Team</h1>
        </div>
        <p className="text-sm text-muted mt-1">
          What your teammates are up to. Keep showing up — they&apos;re watching too.
        </p>
      </header>

      <TeamTabs />
    </div>
  );
}
