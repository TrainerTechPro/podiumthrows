"use client";

import { useState } from "react";
import { Modal, Button } from "@/components";
import { PLANS } from "@/lib/stripe";
import { cn } from "@/lib/utils";
import type { PlanName } from "@/lib/stripe";
import { Check } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";

/* ── Feature lists per plan ──────────────────────────────────────────────── */

const PLAN_FEATURES: Record<"PRO" | "ELITE", string[]> = {
  PRO: [
    "Up to 25 athletes",
    "All Free features",
    "Program builder",
    "Video analysis",
    "ACWR analytics",
    "Athlete progress exports",
  ],
  ELITE: [
    "Unlimited athletes",
    "Everything in Pro",
    "Advanced analytics",
    "Priority support",
    "Custom branding (coming soon)",
  ],
};

/* ── Plan card ───────────────────────────────────────────────────────────── */

function PlanCard({
  planKey,
  isRecommended,
  onSelect,
  loading,
}: {
  planKey: "PRO" | "ELITE";
  isRecommended: boolean;
  onSelect: (plan: "PRO" | "ELITE") => void;
  loading: boolean;
}) {
  const plan = PLANS[planKey];
  const features = PLAN_FEATURES[planKey];

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-5 gap-4",
        isRecommended
          ? "border-primary-500 bg-primary-500/5"
          : "border-[var(--card-border)] bg-[var(--card-bg)]"
      )}
    >
      {isRecommended && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
          Recommended
        </span>
      )}

      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">
          {plan.name}
        </p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-2xl font-bold font-heading text-[var(--foreground)]">
            ${plan.monthlyPrice}
          </span>
          <span className="text-sm text-muted">/mo</span>
        </div>
        <p className="text-xs text-muted mt-1">{plan.description}</p>
      </div>

      <ul className="space-y-1.5 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
            <Check size={14} strokeWidth={2.5} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>

      <Button
        variant={isRecommended ? "primary" : "outline"}
        size="md"
        onClick={() => onSelect(planKey)}
        loading={loading}
        className="w-full"
      >
        Upgrade to {plan.name}
      </Button>
    </div>
  );
}

/* ── Modal ───────────────────────────────────────────────────────────────── */

export interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  /** Reason shown at top — e.g. "You've reached your 3-athlete limit." */
  reason?: string;
  /** Current plan so we can hide plans already on or below */
  currentPlan?: PlanName;
}

export function UpgradeModal({
  open,
  onClose,
  reason,
  currentPlan = "FREE",
}: UpgradeModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<"PRO" | "ELITE" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade(planKey: "PRO" | "ELITE") {
    setLoadingPlan(planKey);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout.");
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoadingPlan(null);
    }
  }

  /* Which plans to show (hide current plan and below) */
  const showElite = currentPlan !== "ELITE";
  const showPro = currentPlan === "FREE";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upgrade Your Plan"
      description={reason}
      size={showPro && showElite ? "xl" : "sm"}
    >
      <div className="space-y-5">
        <div className={cn("grid gap-4", showPro && showElite ? "sm:grid-cols-2" : "grid-cols-1")}>
          {showPro && (
            <PlanCard
              planKey="PRO"
              isRecommended={currentPlan === "FREE"}
              onSelect={handleUpgrade}
              loading={loadingPlan === "PRO"}
            />
          )}
          {showElite && (
            <PlanCard
              planKey="ELITE"
              isRecommended={currentPlan === "PRO"}
              onSelect={handleUpgrade}
              loading={loadingPlan === "ELITE"}
            />
          )}
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <p className="text-xs text-center text-muted">
          Secure checkout via Stripe. Cancel anytime.
        </p>
      </div>
    </Modal>
  );
}

