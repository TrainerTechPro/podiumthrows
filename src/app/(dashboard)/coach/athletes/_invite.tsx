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
              >
                Send Invitation
              </Button>
            </div>
          )
        }
      >
        {success ? (
          <div className="space-y-4 py-1">
            {/* Success header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <svg
                  width="20"
                  height="20"
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
                <p className="text-sm text-muted">Email delivered. Share the link below too.</p>
              </div>
            </div>

            {/* Copy link section */}
            <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-3 space-y-2">
              <p className="text-xs font-medium text-muted uppercase tracking-wide">Invite link</p>
              <div className="flex gap-2 items-center">
                <input
                  readOnly
                  value={inviteLink}
                  aria-label="Invite link"
                  className="flex-1 text-xs font-mono bg-transparent text-[var(--foreground)] outline-none truncate"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={copyLink}
                  aria-label={copied ? "Link copied" : "Copy invite link"}
                  className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    copied
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-[var(--surface-raised)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-muted">Expires in 7 days.</p>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={modal.onClose}>
                Done
              </Button>
              <Button variant="secondary" size="sm" onClick={handleInviteAnother}>
                Invite another
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted">
              Enter the athlete&apos;s email address. They&apos;ll receive a link to create their account
              and join your roster.
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
