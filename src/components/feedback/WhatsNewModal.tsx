"use client";

/**
 * Dashboard-mounted modal that fetches the latest unseen release for the
 * current user on mount and renders it once. Bottom-sheet on mobile,
 * centered modal on desktop. Dismissal acks the release so it never
 * shows again for this user on any device.
 *
 * Fail-soft: network errors silently resolve to "nothing to show." A
 * release modal that won't dismiss is worse than never seeing it.
 */

import { useEffect, useState, useCallback } from "react";
import { Sparkles, X } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";

type Release = {
  slug: string;
  title: string;
  bullets: string[];
  ctaText: string | null;
  ctaHref: string | null;
  publishedAt: string;
};

export function WhatsNewModal() {
  const [release, setRelease] = useState<Release | null>(null);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/releases/unseen")
      .then(async (res) => {
        if (!res.ok) return null;
        const payload = await res.json().catch(() => null);
        return payload?.success ? payload.data.release : null;
      })
      .then((rel) => {
        if (!cancelled && rel) setRelease(rel as Release);
      })
      .catch(() => {
        // Silent fail — the modal is nice-to-have, not load-bearing
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(async () => {
    if (!release || dismissing) return;
    setDismissing(true);
    try {
      await fetch(`/api/releases/${encodeURIComponent(release.slug)}/ack`, {
        method: "POST",
        headers: csrfHeaders(),
      });
    } catch (err) {
      // Ignore — worst case the modal shows again next session
      logger.debug("Ignore — worst case the modal shows again next session", {
        context: "src/components/feedback/WhatsNewModal.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
    setRelease(null);
  }, [release, dismissing]);

  // Escape to dismiss
  useEffect(() => {
    if (!release) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [release, dismiss]);

  if (!release) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 animate-fade-slide-in"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[var(--surface-overlay)] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary-500/15 flex items-center justify-center shrink-0">
              <Sparkles size={18} strokeWidth={2} className="text-primary-500" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                What&apos;s new
              </p>
              <h2
                id="whats-new-title"
                className="text-base font-semibold text-[var(--foreground)] mt-0.5 leading-tight"
              >
                {release.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="p-1 rounded-lg text-muted hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors shrink-0"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* Bullets */}
        <div className="px-5 py-4">
          <ul className="space-y-2.5">
            {release.bullets.map((bullet, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm text-[var(--foreground)] leading-snug"
              >
                <span
                  className="mt-1.5 w-1 h-1 rounded-full bg-primary-500 shrink-0"
                  aria-hidden="true"
                />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center gap-2">
          {release.ctaText && release.ctaHref && (
            <a
              href={release.ctaHref}
              onClick={() => void dismiss()}
              className="flex-1 py-2 px-3 rounded-xl text-sm font-semibold bg-primary-500 text-black hover:bg-primary-600 transition-colors text-center"
            >
              {release.ctaText}
            </a>
          )}
          <button
            type="button"
            onClick={dismiss}
            disabled={dismissing}
            className={`${release.ctaText && release.ctaHref ? "flex-none" : "flex-1"} py-2 px-4 rounded-xl text-sm font-medium text-muted hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
