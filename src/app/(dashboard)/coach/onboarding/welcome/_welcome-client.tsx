"use client";

import Link from "next/link";

const EVENT_LABELS: Record<string, string> = {
  SP: "Shot Put",
  DT: "Discus",
  HT: "Hammer",
  JT: "Javelin",
};

const DEFICIT_LABELS: Record<string, string> = {
  heavy_implement: "Heavy Implement Deficit",
  light_implement: "Light Implement Deficit",
  strength: "Strength Deficit",
  balanced: "Balanced Profile",
  none: "Insufficient Data",
};

const DEFICIT_COLORS: Record<string, string> = {
  heavy_implement: "text-amber-500",
  light_implement: "text-blue-500",
  strength: "text-red-500",
  balanced: "text-emerald-500",
  none: "text-surface-400",
};

type DeficitData = {
  primary: string;
  heavyRatio: number | null;
  squatBwRatio: number | null;
  distanceBand: string | null;
  overPowered: boolean;
  event: string | null;
  gender: string | null;
};

interface WelcomeClientProps {
  firstName: string;
  planName: string;
  deficitData: DeficitData | null;
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WelcomeClient({ firstName, planName, deficitData }: WelcomeClientProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* ── Success Banner ── */}
      <div className="text-center space-y-3 pt-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-500/10 mb-2">
          <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-primary-500" aria-hidden="true">
            <path
              d="M9 12l2 2 4-4"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        <h1 className="text-display-md font-heading font-bold text-[var(--foreground)]">
          Welcome to Podium Throws {planName}!
        </h1>
        <p className="text-surface-500 dark:text-surface-400 text-lg">
          Great to have you, {firstName}. Your account is ready to go.
        </p>
      </div>

      {/* ── Deficit Analysis Card (if from funnel) ── */}
      {deficitData && deficitData.primary !== "none" && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary-500" />
            <p className="text-xs font-heading font-semibold text-primary-500 uppercase tracking-widest">
              Your Deficit Analysis
            </p>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3
                className={`text-xl font-heading font-bold ${
                  DEFICIT_COLORS[deficitData.primary] || "text-[var(--foreground)]"
                }`}
              >
                {DEFICIT_LABELS[deficitData.primary] || "Analysis"}
              </h3>
              {(deficitData.event || deficitData.gender || deficitData.distanceBand) && (
                <p className="text-sm text-muted mt-1">
                  {[
                    deficitData.event ? EVENT_LABELS[deficitData.event] || deficitData.event : "",
                    deficitData.gender === "M" ? "Men's" : deficitData.gender === "F" ? "Women's" : "",
                    deficitData.distanceBand ? `${deficitData.distanceBand}m band` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>

            <div className="flex gap-6">
              {deficitData.heavyRatio !== null && (
                <div className="text-right">
                  <p className="text-xs text-muted uppercase tracking-wide">Heavy Ratio</p>
                  <p className="text-lg font-bold font-heading text-[var(--foreground)]">
                    {(deficitData.heavyRatio * 100).toFixed(1)}%
                  </p>
                </div>
              )}
              {deficitData.squatBwRatio !== null && (
                <div className="text-right">
                  <p className="text-xs text-muted uppercase tracking-wide">Squat-to-BW</p>
                  <p className="text-lg font-bold font-heading text-[var(--foreground)]">
                    {deficitData.squatBwRatio.toFixed(2)}x
                  </p>
                </div>
              )}
            </div>
          </div>

          {deficitData.overPowered && (
            <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">
                Overpowered Flag
              </p>
              <p className="text-sm text-muted mt-1">
                Strength exceeds target while implement marks are below. Consider shifting volume
                from general preparation to specific developmental exercises.
              </p>
            </div>
          )}

          <p className="text-sm text-muted">
            This data has been saved to your profile. You can track deficit trends across your
            entire roster from the Throws Hub.
          </p>
        </div>
      )}

      {/* ── Next Steps ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-heading font-semibold text-muted uppercase tracking-wider">
          Next Steps
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Link
            href="/coach/invitations"
            className="card p-5 group hover:border-primary-500/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500 mb-3">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
                <path
                  d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12.5 7a4 4 0 11-8 0 4 4 0 018 0zM20 8v6M23 11h-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="font-heading font-semibold text-sm text-[var(--foreground)] group-hover:text-primary-500 transition-colors">
              Invite Your First Athlete
            </p>
            <p className="text-xs text-muted mt-1">
              Send invitations and start building your roster.
            </p>
            <span className="inline-flex items-center gap-1 text-xs text-primary-500 mt-3 font-medium">
              Get started <ArrowRightIcon />
            </span>
          </Link>

          <Link
            href="/coach/throws"
            className="card p-5 group hover:border-primary-500/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500 mb-3">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
                <path
                  d="M12 20V10M18 20V4M6 20v-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="font-heading font-semibold text-sm text-[var(--foreground)] group-hover:text-primary-500 transition-colors">
              Explore Throws Hub
            </p>
            <p className="text-xs text-muted mt-1">
              Sessions, analytics, and Bondarchuk tools.
            </p>
            <span className="inline-flex items-center gap-1 text-xs text-primary-500 mt-3 font-medium">
              Explore <ArrowRightIcon />
            </span>
          </Link>

          <Link
            href="/coach/dashboard"
            className="card p-5 group hover:border-primary-500/40 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500 mb-3">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <p className="font-heading font-semibold text-sm text-[var(--foreground)] group-hover:text-primary-500 transition-colors">
              View Your Dashboard
            </p>
            <p className="text-xs text-muted mt-1">
              Overview of team activity and readiness.
            </p>
            <span className="inline-flex items-center gap-1 text-xs text-primary-500 mt-3 font-medium">
              Go to dashboard <ArrowRightIcon />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
