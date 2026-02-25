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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const atLimit = planLimit !== Infinity && athleteCount >= planLimit;

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
      setSuccess(true);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setSuccess(false);
    setError("");
    setEmail("");
    modal.onOpen();
  }

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={atLimit ? upgradeModal.onOpen : handleOpen}
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
          <div className="text-center py-4 space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="font-semibold text-[var(--foreground)]">Invitation sent!</p>
            <p className="text-sm text-muted">
              They&apos;ll receive an email with a link to create their athlete account.
            </p>
            <div className="pt-2">
              <Button variant="secondary" size="sm" onClick={() => { setSuccess(false); setEmail(""); }}>
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
