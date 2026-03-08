"use client";

import { useState } from "react";
import { Button, Input, Modal, UpgradeModal, useModal } from "@/components";
import type { PlanName } from "@/lib/stripe";

interface InviteAthleteButtonProps {
  athleteCount: number;
  planLimit: number;
  currentPlan?: PlanName;
}

export function InviteAthleteButton({
  athleteCount,
  planLimit,
  currentPlan = "FREE",
}: InviteAthleteButtonProps) {
  const modal = useModal();
  const upgradeModal = useModal();
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
      const link = `${window.location.origin}/register?invite=${token}`;
      setInviteLink(link);
      setEmail("");
      setCanShare(typeof navigator !== "undefined" && !!navigator.share);
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
        text: "I've invited you to join my coaching roster on Podium Throws. Tap the link to get started.",
        url: inviteLink,
      });
    } catch {
      // User cancelled share — fall back to copy
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

  function handleInviteAnother() {
    setInviteLink("");
    setError("");
    setEmail("");
    setCopied(false);
  }

  return (
    <>
      <Button
        variant="primary"
        size="md"
        onClick={atLimit ? upgradeModal.onOpen : handleOpen}
        aria-label="Invite a new athlete"
      >
        + Invite Athlete
      </Button>

      <UpgradeModal
        open={upgradeModal.open}
        onClose={upgradeModal.onClose}
        reason={`You've reached your ${planLimit}-athlete limit on the ${currentPlan.charAt(0) + currentPlan.slice(1).toLowerCase()} plan. Upgrade to add more athletes.`}
        currentPlan={currentPlan}
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
                onClick={handleSubmit as never}
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
          <div className="space-y-5 py-1">
            {/* Success header */}
            <div className="text-center sm:text-left sm:flex sm:items-center sm:gap-3">
              <div className="w-12 h-12 sm:w-10 sm:h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mx-auto sm:mx-0 mb-2 sm:mb-0">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">Invitation sent!</p>
                <p className="text-sm text-muted">Email delivered. You can also share the link directly.</p>
              </div>
            </div>

            {/* Action buttons — big, tappable on mobile */}
            <div className="space-y-2">
              {canShare ? (
                <button
                  onClick={shareLink}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-500 text-white font-semibold text-sm py-3.5 hover:bg-primary-600 active:bg-primary-700 transition-colors min-h-[48px]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  Share Invite Link
                </button>
              ) : null}

              <button
                onClick={copyLink}
                className={`w-full flex items-center justify-center gap-2 rounded-xl font-semibold text-sm py-3.5 transition-all min-h-[48px] border ${
                  copied
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--surface-raised)] active:bg-[var(--surface-hover)]"
                }`}
              >
                {copied ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied to clipboard
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy Invite Link
                  </>
                )}
              </button>
            </div>

            {/* Link preview — collapsed, expandable */}
            <p className="text-xs text-muted text-center">
              Link expires in 7 days.
            </p>

            <div className="flex gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={handleInviteAnother} className="flex-1 min-h-[40px]">
                Invite another
              </Button>
              <Button variant="ghost" size="sm" onClick={modal.onClose} className="flex-1 min-h-[40px]">
                Done
              </Button>
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="athlete@university.edu"
              required
              autoFocus
              error={error}
            />
            {planLimit !== Infinity && (
              <p className="text-xs text-muted">
                {athleteCount} / {planLimit} athletes on your plan.
              </p>
            )}
          </form>
        )}
      </Modal>
    </>
  );
}
