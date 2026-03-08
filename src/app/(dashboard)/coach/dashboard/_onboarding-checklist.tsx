"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ProgressBar, Button, Input, Modal, UpgradeModal, useModal } from "@/components";
import type { OnboardingStatus } from "@/lib/data/coach";
import type { PlanName } from "@/lib/stripe";

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface OnboardingChecklistProps {
  firstName: string;
  status: OnboardingStatus;
  athleteCount: number;
  planLimit: number;
  currentPlan: string;
}

/* ─── Icons ──────────────────────────────────────────────────────────────── */

function CheckCircle({ done, locked }: { done: boolean; locked: boolean }) {
  if (done) {
    return (
      <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="w-7 h-7 rounded-full border-2 border-surface-200 dark:border-surface-700 flex items-center justify-center shrink-0">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-surface-300 dark:text-surface-600">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
    );
  }

  // Current step — empty circle with subtle pulse
  return (
    <div className="w-7 h-7 rounded-full border-2 border-primary-400 dark:border-primary-500 shrink-0 relative">
      <div className="absolute inset-0 rounded-full border-2 border-primary-400 dark:border-primary-500 animate-ping opacity-20" />
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/* ─── Inline Invite Modal (reuses same pattern as athletes/_invite.tsx) ─── */

function InlineInviteButton({
  athleteCount,
  planLimit,
  currentPlan,
}: {
  athleteCount: number;
  planLimit: number;
  currentPlan: string;
}) {
  const modal = useModal();
  const upgradeModal = useModal();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [canShare, setCanShare] = useState(false);

  const atLimit = planLimit !== Infinity && athleteCount >= planLimit;
  const success = !!inviteLink;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send invitation");
      const token = data.data?.token;
      setInviteLink(`${window.location.origin}/register?invite=${token}`);
      setEmail("");
      setCanShare(typeof navigator !== "undefined" && !!navigator.share);
      // Refresh to update onboarding status
      setTimeout(() => router.refresh(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      const el = document.createElement("input");
      el.value = inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareLink() {
    try {
      await navigator.share({
        title: "Join my team on Podium Throws",
        text: "I've invited you to join my coaching roster.",
        url: inviteLink,
      });
    } catch {
      copyLink();
    }
  }

  function handleOpen() {
    setInviteLink("");
    setError("");
    setEmail("");
    setCopied(false);
    modal.onOpen();
  }

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={atLimit ? upgradeModal.onOpen : handleOpen}
        className="shrink-0"
      >
        Invite Athlete
        <ArrowRightIcon />
      </Button>

      <UpgradeModal
        open={upgradeModal.open}
        onClose={upgradeModal.onClose}
        reason={`You've reached your ${planLimit}-athlete limit on the ${currentPlan.charAt(0) + currentPlan.slice(1).toLowerCase()} plan. Upgrade to add more athletes.`}
        currentPlan={currentPlan as PlanName}
      />

      <Modal
        open={modal.open}
        onClose={modal.onClose}
        title="Invite an Athlete"
        size="sm"
        footer={
          !success && (
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={modal.onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  handleSubmit({ preventDefault: () => {} } as React.FormEvent);
                }}
                loading={loading}
                className="min-h-[44px]"
              >
                Send Invitation
              </Button>
            </div>
          )
        }
      >
        {success ? (
          <div className="space-y-4 py-1">
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Invitation sent!</p>
              <p className="text-xs text-muted mt-1">You can also share the link directly.</p>
            </div>

            <div className="space-y-2">
              {canShare && (
                <button
                  onClick={shareLink}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-500 text-white font-semibold text-sm py-3 hover:bg-primary-600 active:bg-primary-700 transition-colors min-h-[48px]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  Share Invite Link
                </button>
              )}
              <button
                onClick={copyLink}
                className={`w-full flex items-center justify-center gap-2 rounded-xl font-semibold text-sm py-3 transition-all min-h-[48px] border ${
                  copied
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--surface-raised)] active:bg-[var(--surface-hover)]"
                }`}
              >
                {copied ? "Copied!" : "Copy Invite Link"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted">
              Enter their email. They&apos;ll get a link to join your roster.
            </p>
            <Input
              label="Athlete email"
              type="email"
              placeholder="athlete@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              error={error}
            />
          </form>
        )}
      </Modal>
    </>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function OnboardingChecklist({
  firstName,
  status,
  athleteCount,
  planLimit,
  currentPlan,
}: OnboardingChecklistProps) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);

  async function handleDismiss() {
    setDismissing(true);
    try {
      await fetch("/api/coach/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      router.refresh();
    } catch {
      setDismissing(false);
    }
  }

  const pct = (status.completedCount / status.totalSteps) * 100;

  // Compute which steps are locked
  function isLocked(idx: number): boolean {
    const step = status.steps[idx];
    if (!step.requiresPrevious) return false;
    // Check if the previous step is completed
    const prev = status.steps[idx - 1];
    return prev ? !prev.completed : false;
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-[var(--card-border)] flex items-start gap-4">
        <div className="w-1 self-stretch rounded-full bg-primary-500 shrink-0" />
        <div>
          <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">
            Welcome to Podium Throws, {firstName}.
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Complete these steps to unlock your coaching dashboard.
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-6 sm:px-8 pt-5">
        <ProgressBar
          value={pct}
          variant="primary"
          size="sm"
          showLabel
          label={`${status.completedCount} of ${status.totalSteps} complete`}
          animate
        />
      </div>

      {/* Steps */}
      <div className="px-6 sm:px-8 py-5 space-y-1">
        {status.steps.map((step, idx) => {
          const locked = isLocked(idx);
          const isCurrent = !step.completed && !locked;

          return (
            <div
              key={step.key}
              className={cn(
                "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl px-4 py-3 transition-colors",
                isCurrent && "bg-primary-50 dark:bg-primary-500/5 border border-primary-200 dark:border-primary-500/20",
                step.completed && "opacity-80",
                locked && "opacity-50",
              )}
            >
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <CheckCircle done={step.completed} locked={locked} />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-semibold",
                    step.completed
                      ? "text-surface-500 dark:text-surface-400 line-through"
                      : "text-[var(--foreground)]",
                  )}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted mt-0.5 hidden sm:block">{step.description}</p>
                </div>

                {/* Done badge — inline on mobile */}
                {step.completed && (
                  <span className="text-xs font-medium text-primary-600 dark:text-primary-400 sm:hidden shrink-0">Done</span>
                )}
              </div>

              {/* CTA — stacks below on mobile, inline on desktop */}
              <div className="shrink-0 pl-10 sm:pl-0">
                {step.completed ? (
                  <span className="text-xs font-medium text-primary-600 dark:text-primary-400 hidden sm:inline">Done</span>
                ) : step.key === "invite" && !locked ? (
                  <InlineInviteButton
                    athleteCount={athleteCount}
                    planLimit={planLimit}
                    currentPlan={currentPlan}
                  />
                ) : (
                  <Link href={step.href}>
                    <Button
                      variant={isCurrent ? "primary" : "secondary"}
                      size="sm"
                      disabled={locked}
                    >
                      {step.ctaLabel}
                      {!locked && <ArrowRightIcon />}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="px-6 sm:px-8 pb-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--card-border)] pt-4">
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className="text-sm text-muted hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
        >
          {dismissing ? "Dismissing..." : "Skip setup — I'll explore on my own"}
        </button>
        <Link
          href="/coach/throws"
          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >
          Explore Throws Hub &rarr;
        </Link>
      </div>
    </div>
  );
}
