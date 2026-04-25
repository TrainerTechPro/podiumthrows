import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { requireCoachSession } from "@/lib/data/coach";
import { CoachComposer } from "../../team/_coach-composer";

export const metadata = { title: "Announcements — Podium Throws" };

export default async function CoachAthletesAnnouncementsPage() {
  try {
    await requireCoachSession();
  } catch {
    redirect("/login");
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary-500" strokeWidth={1.75} aria-hidden="true" />
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Announcements
          </h1>
        </div>
        <p className="text-sm text-muted mt-1">
          Broadcast a message to your entire roster. Athletes see your post in their team feed
          alongside their own activity.
        </p>
      </div>

      <CoachComposer />

      <div className="card p-5 text-center">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          Athlete activity is visible in each athlete&apos;s Team tab
        </p>
        <p className="text-xs text-muted mt-1">
          PRs, completed sessions, streaks, and goal hits from your roster appear in each
          athlete&apos;s feed automatically.
        </p>
      </div>
    </div>
  );
}
