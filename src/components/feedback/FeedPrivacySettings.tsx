"use client";

/**
 * FeedPrivacySettings — 4-toggle group for team feed sharing preferences.
 *
 * Fetches /api/athlete/notification-preferences on mount to hydrate the
 * current state, then PATCHes individual flags as the athlete toggles.
 * Each toggle is independent and optimistic — failures roll back.
 *
 * Intended to be dropped into the athlete settings page as a standalone
 * section; doesn't assume any layout context besides the design-system
 * card styles.
 */

import { useEffect, useState } from "react";
import { Trophy, Dumbbell, Flame, Target, Users } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";

type FeedPrivacy = {
  sharePRs: boolean;
  shareSessions: boolean;
  shareStreaks: boolean;
  shareGoals: boolean;
};

const DEFAULTS: FeedPrivacy = {
  sharePRs: true,
  shareSessions: true,
  shareStreaks: true,
  shareGoals: true,
};

type ToggleKey = keyof FeedPrivacy;

const TOGGLES: Array<{
  key: ToggleKey;
  label: string;
  description: string;
  icon: typeof Trophy;
}> = [
  {
    key: "sharePRs",
    label: "Personal records",
    description: "Show your PRs in the team feed.",
    icon: Trophy,
  },
  {
    key: "shareSessions",
    label: "Training sessions",
    description: "Post when you complete a session.",
    icon: Dumbbell,
  },
  {
    key: "shareStreaks",
    label: "Streak milestones",
    description: "Celebrate 7 / 14 / 30 / 60-day streaks.",
    icon: Flame,
  },
  {
    key: "shareGoals",
    label: "Weekly goals",
    description: "Post when you hit a weekly throws goal.",
    icon: Target,
  },
];

export function FeedPrivacySettings() {
  const [prefs, setPrefs] = useState<FeedPrivacy>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<ToggleKey | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/athlete/notification-preferences", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const payload = (await res.json()) as
          | { success: true; data: { preferences: { feedPrivacy?: Partial<FeedPrivacy> } } }
          | { success: false; error: string };
        if (!payload.success) return;
        const fp = payload.data.preferences.feedPrivacy;
        setPrefs({
          sharePRs: fp?.sharePRs ?? true,
          shareSessions: fp?.shareSessions ?? true,
          shareStreaks: fp?.shareStreaks ?? true,
          shareGoals: fp?.shareGoals ?? true,
        });
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function toggle(key: ToggleKey) {
    if (savingKey) return;
    const previous = prefs[key];
    const next = !previous;

    // Optimistic
    setPrefs((p) => ({ ...p, [key]: next }));
    setSavingKey(key);
    setError(null);

    try {
      const res = await fetch("/api/athlete/notification-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ feedPrivacy: { [key]: next } }),
      });
      if (!res.ok) {
        setPrefs((p) => ({ ...p, [key]: previous }));
        setError("Couldn't save. Try again.");
      }
    } catch {
      setPrefs((p) => ({ ...p, [key]: previous }));
      setError("Network error. Try again.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Users className="h-4 w-4 text-primary-500" strokeWidth={1.75} aria-hidden="true" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Team Feed Privacy
        </h2>
      </div>
      <p className="text-xs text-muted mb-4">
        Pick what gets shared with your teammates. Turning a toggle off hides future events — past
        posts aren&apos;t deleted.
      </p>

      <div className="space-y-2">
        {TOGGLES.map(({ key, label, description, icon: Icon }) => {
          const enabled = prefs[key];
          const busy = savingKey === key;
          return (
            <div
              key={key}
              className="flex items-center gap-3 py-2.5 border-b border-[var(--card-border)] last:border-b-0"
            >
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                  enabled ? "bg-primary-500/15" : "bg-surface-100 dark:bg-surface-800"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${enabled ? "text-primary-500" : "text-muted"}`}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
                <p className="text-xs text-muted">{description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={label}
                disabled={!loaded || busy}
                onClick={() => toggle(key)}
                className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
                  enabled ? "bg-primary-500" : "bg-surface-200 dark:bg-surface-700"
                } ${busy ? "opacity-60" : ""}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                  aria-hidden="true"
                />
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
    </div>
  );
}
