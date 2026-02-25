import { requireCoachSession } from "@/lib/data/coach";
import { redirect } from "next/navigation";

export const metadata = { title: "Team Goals — Podium Throws" };

export default async function CoachGoalsPage() {
  try {
    await requireCoachSession();
  } catch {
    redirect("/login");
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Team Goals
        </h1>
        <p className="text-sm text-muted mt-1">
          Track progress toward season targets across your entire roster.
        </p>
      </div>

      {/* Coming soon card */}
      <div className="card px-8 py-16 flex flex-col items-center text-center gap-5">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary-500"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </div>

        <div className="space-y-2 max-w-md">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wide">
            Coming Soon
          </div>
          <h2 className="text-xl font-bold font-heading text-[var(--foreground)]">
            Roster-Wide Goal Tracking
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            See every athlete&apos;s season targets in one view —
            distance goals, PR milestones, and competition-readiness benchmarks.
            Spot who&apos;s on track and who needs a check-in before the next meet.
          </p>
        </div>

        {/* Feature previews */}
        <ul className="mt-2 space-y-2.5 text-left w-full max-w-sm">
          {[
            "Season PR targets by event (shot, disc, hammer, jav)",
            "Goal progress bars linked to real throw log data",
            "Competition-readiness scoring per athlete",
            "Goal completion history and trend charts",
          ].map((feat) => (
            <li key={feat} className="flex items-start gap-2.5 text-sm text-muted">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary-500 shrink-0 mt-0.5"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {feat}
            </li>
          ))}
        </ul>

        {/* Tip: athletes already have goals */}
        <p className="text-xs text-muted mt-2 max-w-sm">
          In the meantime, you can view and manage each athlete&apos;s individual
          goals from their{" "}
          <a
            href="/coach/athletes"
            className="text-primary-600 dark:text-primary-400 underline underline-offset-2 hover:no-underline"
          >
            athlete profile
          </a>
          .
        </p>
      </div>
    </div>
  );
}
