import { Users } from "lucide-react";
import { requireAthleteSession } from "@/lib/data/athlete";
import { TeamFeed } from "./_team-feed";

export const dynamic = "force-dynamic";

export default async function AthleteTeamPage() {
  await requireAthleteSession();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Users
          className="h-6 w-6 text-primary-500"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Team
        </h1>
      </div>
      <p className="text-sm text-muted -mt-4">
        What your teammates are up to.
      </p>

      <TeamFeed />
    </div>
  );
}
