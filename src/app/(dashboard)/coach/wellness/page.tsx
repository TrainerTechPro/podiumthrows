import { requireCoachSession } from "@/lib/data/coach";
import { redirect } from "next/navigation";

export const metadata = { title: "Team Wellness — Podium Throws" };

const PLANNED_FEATURES = [
  { label: "Daily readiness heatmap", detail: "At-a-glance view across your entire roster" },
  { label: "Sleep, soreness & stress", detail: "Full breakdown by category, not just a single score" },
  { label: "7-day rolling trends", detail: "Per-athlete progression and recovery curves" },
  { label: "Threshold alerts", detail: "Automatic flags when athletes dip below target" },
];

export default async function CoachWellnessPage() {
  try {
    await requireCoachSession();
  } catch {
    redirect("/login");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Team Wellness
          </h1>
          <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide bg-amber-500/10 text-amber-600 dark:text-amber-400">
            Coming Soon
          </span>
        </div>
        <p className="text-sm text-muted">
          Monitor readiness, recovery, and wellness trends across your roster.
        </p>
      </div>

      {/* Feature preview */}
      <div className="space-y-px rounded-xl overflow-hidden border border-[var(--card-border)]">
        {PLANNED_FEATURES.map((feat, i) => (
          <div
            key={feat.label}
            className="flex items-start gap-4 px-5 py-4 bg-[var(--card-bg)]"
          >
            <span className="text-xs tabular-nums font-mono text-surface-400 dark:text-surface-600 mt-0.5 w-4 shrink-0">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">{feat.label}</p>
              <p className="text-sm text-muted mt-0.5">{feat.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
