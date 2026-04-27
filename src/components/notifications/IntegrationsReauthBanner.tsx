"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { logger } from "@/lib/logger";

/* ─── Banner shown on the athlete dashboard when a wearable integration
       needs to be re-authorized. Dismissible for 24 hours via localStorage
       (per-athlete key — switching accounts on the same device shows it
       again). The 24-hour cap is intentional: long-expired tokens silently
       erase recovery/HRV from readiness check-ins, which is the kind of bug
       coaches blame on the app rather than on a known-expired token.
       ─────────────────────────────────────────────────────────────────── */

interface ProviderState {
  provider: "whoop" | "oura";
  needsReauth: boolean;
}

export interface IntegrationsReauthBannerProps {
  athleteId: string;
  whoop: ProviderState | null;
  oura: ProviderState | null;
}

const DISMISS_HOURS = 24;
const DISMISS_KEY_PREFIX = "podium:integrations-banner-dismissed:";

const PROVIDER_LABEL: Record<"whoop" | "oura", string> = {
  whoop: "WHOOP",
  oura: "Oura Ring",
};

const PROVIDER_AUTH_URL: Record<"whoop" | "oura", string> = {
  whoop: "/api/whoop/authorize",
  oura: "/api/oura/authorize",
};

function readDismissedAt(athleteId: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${DISMISS_KEY_PREFIX}${athleteId}`);
    if (!raw) return null;
    const ts = parseInt(raw, 10);
    return Number.isFinite(ts) ? ts : null;
  } catch (err) {
    // ok: best-effort dismissal; reading fails in private mode.
    logger.debug("integrations banner dismiss read failed", {
      context: "components/IntegrationsReauthBanner",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
    return null;
  }
}

function writeDismissedAt(athleteId: string, ts: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${DISMISS_KEY_PREFIX}${athleteId}`, String(ts));
  } catch (err) {
    // ok: best-effort dismissal; banner reappears on next render.
    logger.debug("integrations banner dismiss write failed", {
      context: "components/IntegrationsReauthBanner",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }
}

export function IntegrationsReauthBanner({
  athleteId,
  whoop,
  oura,
}: IntegrationsReauthBannerProps) {
  const expiredProviders = [
    whoop?.needsReauth ? whoop.provider : null,
    oura?.needsReauth ? oura.provider : null,
  ].filter((p): p is "whoop" | "oura" => p !== null);

  const [hidden, setHidden] = useState(true); // start hidden until we read storage
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (expiredProviders.length === 0) {
      setHidden(true);
      return;
    }
    const dismissedAt = readDismissedAt(athleteId);
    if (!dismissedAt) {
      setHidden(false);
      return;
    }
    const elapsedHours = (Date.now() - dismissedAt) / (1000 * 60 * 60);
    setHidden(elapsedHours < DISMISS_HOURS);
  }, [athleteId, expiredProviders.length]);

  if (!mounted || hidden || expiredProviders.length === 0) return null;

  const single = expiredProviders.length === 1 ? expiredProviders[0] : null;
  const headline =
    expiredProviders.length === 1
      ? `${PROVIDER_LABEL[expiredProviders[0]]} needs reconnecting`
      : "Wearable connections need reconnecting";
  const body =
    expiredProviders.length === 1
      ? `Your ${PROVIDER_LABEL[expiredProviders[0]]} authorization expired. Recovery and HRV stopped flowing into your check-ins. Takes 10 seconds.`
      : `Your ${expiredProviders.map((p) => PROVIDER_LABEL[p]).join(" and ")} authorizations expired. Reconnect to resume recovery + HRV in your check-ins.`;

  const handleDismiss = () => {
    writeDismissedAt(athleteId, Date.now());
    setHidden(true);
  };

  // Single-provider: render a Reconnect button that goes straight to OAuth.
  // Multi-provider: link to /athlete/integrations where each card has its
  // own Reconnect (less risk of clicking through to the wrong one).
  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-2xl border border-warning-500/30 bg-warning-500/10 p-4 flex items-start gap-3"
    >
      <span
        className="w-9 h-9 rounded-full bg-warning-500/15 flex items-center justify-center shrink-0 mt-0.5"
        aria-hidden="true"
      >
        <AlertTriangle size={18} strokeWidth={1.75} className="text-warning-500" />
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-heading font-semibold text-sm text-[var(--foreground)]">{headline}</p>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{body}</p>
        <div className="flex items-center gap-2 pt-1">
          {single ? (
            <a
              href={PROVIDER_AUTH_URL[single]}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-warning-500 hover:bg-warning-400 text-surface-950 text-xs font-medium transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500"
            >
              Reconnect {PROVIDER_LABEL[single]}
            </a>
          ) : (
            <Link
              href="/athlete/integrations"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-warning-500 hover:bg-warning-400 text-surface-950 text-xs font-medium transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500"
            >
              Open integrations
            </Link>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--foreground)] transition-colors px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500"
          >
            Remind me tomorrow
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500"
      >
        <X size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
