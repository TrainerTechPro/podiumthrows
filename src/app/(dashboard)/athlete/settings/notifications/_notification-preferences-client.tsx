"use client";

/**
 * NotificationPreferencesClient
 *
 * Renders the permission status section (via EnablePushNotifications compact)
 * and a list of 5 toggle rows for per-notification-type preferences.
 *
 * Optimistic UI: toggles update state immediately, PATCH in background,
 * roll back on failure with a toast.
 */

import { useState } from "react";
import { EnablePushNotifications } from "@/components/notifications/EnablePushNotifications";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { PushPreferences, PushPreferenceKey } from "@/lib/push/preferences";

/* ─── Preference metadata ─────────────────────────────────────────────────── */

type PreferenceItem = {
  key: PushPreferenceKey;
  emoji: string;
  title: string;
  description: string;
};

const PREFERENCE_ITEMS: PreferenceItem[] = [
  {
    key: "coachFeedback",
    emoji: "💬",
    title: "Coach feedback",
    description: "When your coach posts feedback on your throws or sessions",
  },
  {
    key: "teammatePRs",
    emoji: "🔥",
    title: "Teammate PRs",
    description: "When a teammate hits a new personal record",
  },
  {
    key: "streakReminder",
    emoji: "⚡",
    title: "Streak reminders",
    description: "Reminder when your training streak is about to break",
  },
  {
    key: "weeklyGoalReminder",
    emoji: "🎯",
    title: "Weekly goal progress",
    description: "Sunday check-in on your weekly goal progress",
  },
  {
    key: "practiceReminder",
    emoji: "📅",
    title: "Practice reminders",
    description: "30 minutes before scheduled practice sessions",
  },
  {
    key: "weeklyRecapEmail",
    emoji: "📧",
    title: "Weekly recap email",
    description: "Sunday evening — your week summarized in your inbox",
  },
  {
    key: "weeklyRecapInApp",
    emoji: "📊",
    title: "Weekly recap in-app",
    description: "Sunday evening — same recap as a notification you can re-open",
  },
];

/* ─── Props ──────────────────────────────────────────────────────────────── */

type Props = {
  initialPreferences: PushPreferences;
};

/* ─── Component ──────────────────────────────────────────────────────────── */

export function NotificationPreferencesClient({ initialPreferences }: Props) {
  const toast = useToast();
  const [prefs, setPrefs] = useState<PushPreferences>(initialPreferences);
  const [savingKey, setSavingKey] = useState<PushPreferenceKey | null>(null);

  async function toggle(key: PushPreferenceKey) {
    if (savingKey) return;
    const previous = prefs[key];
    const next = !previous;

    // Optimistic update
    setPrefs((p) => ({ ...p, [key]: next }));
    setSavingKey(key);

    try {
      const res = await fetch("/api/athlete/push-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ [key]: next }),
      });

      if (!res.ok) {
        // Roll back
        setPrefs((p) => ({ ...p, [key]: previous }));
        toast.error("Couldn't save preference. Try again.");
      }
    } catch {
      // Roll back
      setPrefs((p) => ({ ...p, [key]: previous }));
      toast.error("Network error. Try again.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Permission status ─────────────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Push Notifications
          </h2>
        </div>
        <p className="text-xs text-muted">
          Allow Podium Throws to send you push notifications, then control which alerts you receive
          below.
        </p>
        <EnablePushNotifications variant="compact" />
      </div>

      {/* ── Per-type toggles ──────────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-1">
          Alert Types
        </h2>
        <p className="text-xs text-muted mb-4">
          Toggle which notifications you want to receive. These only fire when push notifications
          are enabled above.
        </p>

        <div className="space-y-0">
          {PREFERENCE_ITEMS.map(({ key, emoji, title, description }) => {
            const enabled = prefs[key];
            const busy = savingKey === key;

            return (
              <div
                key={key}
                className="flex items-center gap-3 py-3 border-b border-[var(--card-border)] last:border-b-0"
              >
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-base shrink-0">
                  <span aria-hidden="true">{emoji}</span>
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
                  <p className="text-xs text-muted">{description}</p>
                </div>

                {/* Toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={title}
                  disabled={busy}
                  onClick={() => toggle(key)}
                  className={[
                    "relative h-6 w-11 rounded-full shrink-0 transition-colors",
                    enabled ? "bg-primary-500" : "bg-surface-200 dark:bg-surface-700",
                    busy ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                      enabled ? "translate-x-5" : "translate-x-0",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
