import { requireCoachSession } from "@/lib/data/coach";
import { redirect } from "next/navigation";

export const metadata = { title: "Team Wellness — Podium Throws" };

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

      {/* Coming soon card */}
      <div className="card px-8 py-16 flex flex-col items-center text-center gap-5">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f43f5e"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>

        <div className="space-y-2 max-w-md">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wide">
            Coming Soon
          </div>
          <h2 className="text-xl font-bold font-heading text-[var(--foreground)]">
            Team Wellness Dashboard
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            Get a real-time view of your entire roster&apos;s readiness scores,
            sleep quality, soreness levels, and stress trends — all in one place.
            Identify athletes who need load adjustments before they break down.
          </p>
        </div>

        {/* Feature previews */}
        <ul className="mt-2 space-y-2.5 text-left w-full max-w-sm">
          {[
            "Daily readiness heatmap across your roster",
            "Sleep, soreness, and stress breakdowns",
            "7-day rolling wellness trends per athlete",
            "Alerts when athletes dip below threshold",
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
      </div>
    </div>
  );
}
