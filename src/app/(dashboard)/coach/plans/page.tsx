import { requireCoachSession } from "@/lib/data/coach";
import { redirect } from "next/navigation";

export const metadata = { title: "Workout Plans — Podium Throws" };

export default async function CoachPlansPage() {
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
          Workout Plans
        </h1>
        <p className="text-sm text-muted mt-1">
          Build periodized training programs and assign them to athletes.
        </p>
      </div>

      {/* Coming soon card */}
      <div className="card px-8 py-16 flex flex-col items-center text-center gap-5">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>

        <div className="space-y-2 max-w-md">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wide">
            Coming Soon
          </div>
          <h2 className="text-xl font-bold font-heading text-[var(--foreground)]">
            Periodized Training Plans
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            Build multi-week mesocycles using the Bondarchuk methodology —
            GPP, SPP, and Competition phases. Assign plans to individual athletes
            or your entire roster and track compliance in real time.
          </p>
        </div>

        {/* Feature previews */}
        <ul className="mt-2 space-y-2.5 text-left w-full max-w-sm">
          {[
            "Multi-week periodization blocks (GPP / SPP / Competition)",
            "Drag-and-drop weekly session builder",
            "Assign plans to one athlete or the full roster",
            "Auto-scale loads by athlete PR and bodyweight",
            "Plan vs. actual compliance tracking",
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
