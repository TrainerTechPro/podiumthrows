/**
 * Install-prompt gating counters. Storage-only; no React.
 *
 * Trigger gates (all must hold):
 *   - unique-days visited /athlete/dashboard ≥ MIN_UNIQUE_DAYS
 *   - logs submitted ≥ MIN_LOGS_SUBMITTED
 *   - dismiss-count < MAX_DISMISSALS
 *   - last-dismissal > DISMISS_WINDOW_DAYS ago
 *   - not already installed
 */

const KEY_VISIT_DAYS = "pwa-visit-days";
const KEY_LOGS_SUBMITTED = "pwa-logs-submitted";
const KEY_DISMISS_COUNT = "pwa-dismiss-count";
const KEY_LAST_DISMISSED_AT = "pwa-last-dismissed-at";
const KEY_INSTALLED_AT = "pwa-installed-at";
const KEY_INSTALL_DISABLED = "pwa-install-disabled";
const KEY_MIGRATION_DONE = "pwa-keys-migrated-v2";

// Legacy keys from the previous prompt — read-once on migration.
const LEGACY_KEY_DISMISS = "pwa-install-dismissed";
const LEGACY_KEY_VISIT_COUNT = "pwa-visit-count";

export const MIN_UNIQUE_DAYS = 3;
export const MIN_LOGS_SUBMITTED = 1;
export const MAX_DISMISSALS = 3;
export const DISMISS_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function safe<T>(fn: () => T, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function todayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function readVisitDays(): string[] {
  return safe(() => {
    const raw = localStorage.getItem(KEY_VISIT_DAYS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  }, []);
}

function writeVisitDays(days: string[]): void {
  safe(() => {
    // Cap to 60 days to prevent unbounded growth — we only need to know "≥ 3".
    const trimmed = days.slice(-60);
    localStorage.setItem(KEY_VISIT_DAYS, JSON.stringify(trimmed));
  }, undefined);
}

/** Run once per app load. Idempotent. */
export function migrateLegacyKeys(): void {
  safe(() => {
    if (localStorage.getItem(KEY_MIGRATION_DONE) === "1") return;

    const legacyDismiss = localStorage.getItem(LEGACY_KEY_DISMISS);
    if (legacyDismiss && !localStorage.getItem(KEY_LAST_DISMISSED_AT)) {
      localStorage.setItem(KEY_LAST_DISMISSED_AT, legacyDismiss);
      // One legacy dismissal seeds dismiss-count = 1 so we don't pretend it
      // never happened.
      if (!localStorage.getItem(KEY_DISMISS_COUNT)) {
        localStorage.setItem(KEY_DISMISS_COUNT, "1");
      }
    }
    localStorage.removeItem(LEGACY_KEY_DISMISS);
    localStorage.removeItem(LEGACY_KEY_VISIT_COUNT);
    localStorage.setItem(KEY_MIGRATION_DONE, "1");
  }, undefined);
}

/** Add today to the unique-day set. Returns the new unique-day count. */
export function markVisitedToday(): number {
  return safe(() => {
    const days = readVisitDays();
    const today = todayKey();
    if (days[days.length - 1] !== today && !days.includes(today)) {
      days.push(today);
      writeVisitDays(days);
    }
    return days.length;
  }, 0);
}

export function getUniqueVisitDays(): number {
  return safe(() => readVisitDays().length, 0);
}

export function bumpLogsSubmitted(): number {
  return safe(() => {
    const n = parseInt(localStorage.getItem(KEY_LOGS_SUBMITTED) || "0", 10) + 1;
    localStorage.setItem(KEY_LOGS_SUBMITTED, String(n));
    return n;
  }, 0);
}

export function getLogsSubmitted(): number {
  return safe(() => parseInt(localStorage.getItem(KEY_LOGS_SUBMITTED) || "0", 10), 0);
}

export function getDismissCount(): number {
  return safe(() => parseInt(localStorage.getItem(KEY_DISMISS_COUNT) || "0", 10), 0);
}

export function getLastDismissedAt(): number {
  return safe(() => parseInt(localStorage.getItem(KEY_LAST_DISMISSED_AT) || "0", 10), 0);
}

export function markDismissed(): number {
  return safe(() => {
    const next = getDismissCount() + 1;
    localStorage.setItem(KEY_DISMISS_COUNT, String(next));
    localStorage.setItem(KEY_LAST_DISMISSED_AT, String(Date.now()));
    if (next >= MAX_DISMISSALS) {
      localStorage.setItem(KEY_INSTALL_DISABLED, "1");
    }
    return next;
  }, 0);
}

export function markInstalled(): void {
  safe(() => {
    localStorage.setItem(KEY_INSTALLED_AT, String(Date.now()));
    localStorage.setItem(KEY_INSTALL_DISABLED, "1");
  }, undefined);
}

export function isInstallDisabled(): boolean {
  return safe(() => localStorage.getItem(KEY_INSTALL_DISABLED) === "1", false);
}

/**
 * Pure check — does NOT mutate any counter. Visit-day mutation must happen
 * separately on dashboard mount.
 */
export function shouldShowInstallPrompt(): boolean {
  if (typeof window === "undefined") return false;

  // Already installed (standalone) — never prompt.
  if (window.matchMedia?.("(display-mode: standalone)").matches) return false;
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return false;

  if (isInstallDisabled()) return false;

  const dismissCount = getDismissCount();
  if (dismissCount >= MAX_DISMISSALS) return false;

  const lastDismissedAt = getLastDismissedAt();
  if (lastDismissedAt > 0) {
    const daysSince = (Date.now() - lastDismissedAt) / DAY_MS;
    if (daysSince < DISMISS_WINDOW_DAYS) return false;
  }

  if (getUniqueVisitDays() < MIN_UNIQUE_DAYS) return false;
  if (getLogsSubmitted() < MIN_LOGS_SUBMITTED) return false;

  return true;
}
