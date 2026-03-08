"use client";

import { useState } from "react";
import { Button, UpgradeModal, useModal } from "@/components";
import type { PlanName } from "@/lib/stripe";

interface UpgradeBannerProps {
  athleteCount: number;
  planLimit: number;
}

export function UpgradeBanner({ athleteCount, planLimit }: UpgradeBannerProps) {
  const modal = useModal();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("podium-upgrade-banner-dismissed") === "true";
  });

  if (dismissed) return null;

  const atLimit = athleteCount >= planLimit;

  function handleDismiss() {
    setDismissed(true);
    try { sessionStorage.setItem("podium-upgrade-banner-dismissed", "true"); } catch {}
  }

  return (
    <>
      <div className="relative rounded-xl border border-primary-200 dark:border-primary-500/20 bg-primary-50/50 dark:bg-primary-500/5 px-5 py-4 flex flex-wrap items-center gap-4">
        <div className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500" aria-hidden="true">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {atLimit
              ? `You've reached your ${planLimit}-athlete limit`
              : `${athleteCount} of ${planLimit} athlete spots used`}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {atLimit
              ? "Upgrade to Pro for up to 25 athletes, plus program builder and video analysis."
              : "Upgrade to Pro to unlock up to 25 athletes and advanced coaching tools."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDismiss}
            className="text-xs text-muted hover:text-[var(--foreground)] transition-colors px-2 py-1"
          >
            Dismiss
          </button>
          <Button variant="primary" size="sm" onClick={modal.onOpen}>
            View Plans
          </Button>
        </div>
      </div>

      <UpgradeModal
        open={modal.open}
        onClose={modal.onClose}
        reason={
          atLimit
            ? `You've reached your ${planLimit}-athlete limit on the Free plan.`
            : undefined
        }
        currentPlan={"FREE" as PlanName}
      />
    </>
  );
}
