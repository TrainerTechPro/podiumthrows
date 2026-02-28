import { requireCoachSession } from "@/lib/data/coach";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Team Wellness — Podium Throws" };

const PLANNED_FEATURES = [
  "Daily readiness heatmap across your roster",
  "Sleep, soreness, and stress breakdowns",
  "7-day rolling wellness trends per athlete",
  "Alerts when athletes dip below threshold",
];

export default async function CoachWellnessPage() {
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
          Team Wellness
        </h1>
        <p className="text-sm text-muted mt-1">
          Monitor readiness, recovery, and wellness trends across your roster.
        </p>
      </div>

      {/* Coming soon */}
      <div className="card px-8 py-12">
        <EmptyState
          icon={<Heart size={28} strokeWidth={1.75} className="text-rose-500" />}
          title="Team Wellness Dashboard"
          description="Get a real-time view of your entire roster's readiness scores, sleep quality, soreness levels, and stress trends — all in one place."
        />

        {/* Coming soon badge */}
        <div className="flex justify-center mt-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wide">
            Coming Soon
          </span>
        </div>

        {/* Feature preview list */}
        <ul className="mt-6 space-y-2.5 text-left w-full max-w-sm mx-auto">
          {PLANNED_FEATURES.map((feat) => (
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
      </div>
    </div>
  );
}
