"use client";

/**
 * StreakReminder
 * Client-side daily reminder that fires a browser Notification if the
 * athlete's streak is active and they haven't logged in ~24h.
 *
 * Design:
 *   - Never nags athletes whose streak is already broken (currentStreak = 0
 *     or lastActivityDate < yesterday).
 *   - Opt-in via a small inline card; never calls requestPermission() on
 *     page load.
 *   - State (enabled / dismissed) is persisted to AthleteProfile.notificationPreferences
 *     via /api/athlete/notification-preferences so it syncs across devices.
 *     The lastFired throttle is still local to the tab (short-lived).
 *   - Firing eligibility is re-checked via the streak-status API so the
 *     client never trusts stale props.
 *   - Reschedules on visibilitychange so the tab doesn't need to stay open.
 */

import { useEffect, useState, useCallback } from "react";
import { Bell, X, Check } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";

const LOCAL_LAST_FIRED_KEY = "streak-reminder-last-fired";
const MIN_MS_BETWEEN_FIRINGS = 18 * 60 * 60 * 1000; // 18h
const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 min

type PermissionStatus = "default" | "granted" | "denied" | "unsupported";

type StreakStatusResponse = {
  currentStreak: number;
  isStreakActive: boolean;
  shouldRemindNow: boolean;
};

/* ─── Props ──────────────────────────────────────────────────────────────── */

export type StreakReminderProps = {
  currentStreak: number;
  /** Initial preference state hydrated from the server on page load. */
  initialEnabled: boolean;
  initialPromptDismissed: boolean;
};

/* ─── Component ──────────────────────────────────────────────────────────── */

export function StreakReminder({
  currentStreak,
  initialEnabled,
  initialPromptDismissed,
}: StreakReminderProps) {
  const [enabled, setEnabled] = useState<boolean>(initialEnabled);
  const [dismissed, setDismissed] = useState<boolean>(initialPromptDismissed);
  const [permission, setPermission] = useState<PermissionStatus>("default");
  const [saving, setSaving] = useState<boolean>(false);

  /* ─── Mount: detect browser permission status ────────────────────────── */

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission as PermissionStatus);
    }
  }, []);

  /* ─── Persist preference to the server ──────────────────────────────── */

  const savePrefs = useCallback(
    async (patch: { enabled?: boolean; promptDismissed?: boolean }) => {
      setSaving(true);
      try {
        await fetch("/api/athlete/notification-preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ streakReminder: patch }),
        });
      } catch {
        // Silent — prefs are not load-bearing
      } finally {
        setSaving(false);
      }
    },
    []
  );

  /* ─── Reminder scheduler ────────────────────────────────────────────── */

  const checkAndFire = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (Notification.permission !== "granted") return;

    // Throttle: never fire more than once per 18h window. Tracked locally
    // because the throttle is per-tab (prevents duplicate fires across tabs
    // on the same machine, but cross-device throttling isn't critical).
    const lastFired = window.localStorage.getItem(LOCAL_LAST_FIRED_KEY);
    if (lastFired) {
      const ms = Date.now() - new Date(lastFired).getTime();
      if (ms < MIN_MS_BETWEEN_FIRINGS) return;
    }

    // Ask the server — client clock & props can be stale
    let status: StreakStatusResponse | null = null;
    try {
      const res = await fetch("/api/athlete/streak-status", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      status = (await res.json()) as StreakStatusResponse;
    } catch {
      return;
    }

    if (!status || !status.shouldRemindNow) return;

    try {
      new Notification("Keep your streak alive", {
        body: `Log at least one throw today to keep your ${status.currentStreak}-day streak going.`,
        tag: "podium-throws-streak",
      });
      window.localStorage.setItem(
        LOCAL_LAST_FIRED_KEY,
        new Date().toISOString()
      );
    } catch {
      // Notification construction can throw in some browsers — silent
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (permission !== "granted") return;

    // Initial check on mount
    void checkAndFire();

    // Periodic poll while tab is open
    const interval = setInterval(() => {
      void checkAndFire();
    }, POLL_INTERVAL_MS);

    // Re-check when tab regains focus
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkAndFire();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, permission, checkAndFire]);

  /* ─── Actions ───────────────────────────────────────────────────────── */

  async function optIn() {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionStatus);
      if (result === "granted") {
        setEnabled(true);
        void savePrefs({ enabled: true });
      } else {
        setDismissed(true);
        void savePrefs({ promptDismissed: true });
      }
    } catch {
      setPermission("unsupported");
    }
  }

  function dismissPrompt() {
    setDismissed(true);
    void savePrefs({ promptDismissed: true });
  }

  /* ─── Render rules ──────────────────────────────────────────────────── */

  // No UI under any of these conditions:
  // - streak not active (don't nag inactive athletes)
  // - user dismissed the prompt
  // - already opted in
  // - notifications unsupported
  // - permission was explicitly denied
  if (currentStreak <= 0) return null;
  if (enabled) return null;
  if (dismissed) return null;
  if (permission === "unsupported" || permission === "denied") return null;

  return (
    <div className="card px-4 py-3 flex items-center gap-3 border border-primary-500/20 bg-primary-500/5">
      <div className="h-9 w-9 rounded-full bg-primary-500/15 flex items-center justify-center shrink-0">
        <Bell
          className="h-4 w-4 text-primary-500"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          Protect your {currentStreak}-day streak
        </p>
        <p className="text-xs text-muted mt-0.5">
          Get a gentle reminder if you haven&apos;t logged in 24 hours.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={dismissPrompt}
          disabled={saving}
          aria-label="Dismiss reminder prompt"
          className="h-8 w-8 rounded-full flex items-center justify-center text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={optIn}
          disabled={saving}
          className="btn btn-primary text-xs inline-flex items-center gap-1.5 h-8"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Enable
        </button>
      </div>
    </div>
  );
}
