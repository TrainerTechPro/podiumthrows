"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpCircle } from "lucide-react";
import { Button, Input, Modal, UpgradeModal, useModal } from "@/components";
import { Tabs, TabList, TabTrigger, TabPanel } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { PlanName } from "@/lib/stripe";
import { csrfHeaders } from "@/lib/csrf-client";

/**
 * Tier-limit status visible at the top of every add-athlete flow.
 *
 * Tiers:
 *   - Unlimited (ELITE / Infinity): render nothing — no useful signal.
 *   - 3+ remaining: muted plain counter, unchanged from the prior UX.
 *   - 1-2 remaining: amber warning — nudges the coach to think about upgrade
 *     before they run out mid-batch.
 *   - At limit: red card with a direct upgrade CTA. The outer button already
 *     intercepts and opens UpgradeModal at this state, but if a future caller
 *     opens the modal by a different path this banner still catches it.
 */
function PlanLimitBanner({
  athleteCount,
  planLimit,
  currentPlan,
  onUpgrade,
}: {
  athleteCount: number;
  planLimit: number;
  currentPlan: PlanName;
  onUpgrade: () => void;
}) {
  if (planLimit === Infinity) return null;

  const remaining = Math.max(0, planLimit - athleteCount);
  const planLabel = currentPlan.charAt(0) + currentPlan.slice(1).toLowerCase();

  if (remaining === 0) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 flex items-start gap-2">
        <AlertTriangle
          className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">
            Plan limit reached ({athleteCount}/{planLimit})
          </p>
          <button
            type="button"
            onClick={onUpgrade}
            className="text-xs font-semibold text-primary-600 dark:text-primary-300 hover:underline mt-0.5 inline-flex items-center gap-1"
          >
            <ArrowUpCircle className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
            Upgrade your {planLabel} plan
          </button>
        </div>
      </div>
    );
  }

  if (remaining <= 2) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 flex items-start gap-2">
        <AlertTriangle
          className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            {remaining} slot{remaining === 1 ? "" : "s"} remaining on your {planLabel} plan
          </p>
          <button
            type="button"
            onClick={onUpgrade}
            className="text-xs text-primary-600 dark:text-primary-300 hover:underline mt-0.5"
          >
            Upgrade to add more
          </button>
        </div>
      </div>
    );
  }

  return (
    <p className="text-xs text-muted">
      {athleteCount} / {planLimit} athletes on your {planLabel} plan.
    </p>
  );
}

type InviteMode = "email" | "link";
type TopTab = "create" | "invite";
type Gender = "MALE" | "FEMALE" | "OTHER";
type ThrowEvent = "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";

const EVENT_OPTIONS: { id: ThrowEvent; label: string }[] = [
  { id: "SHOT_PUT", label: "Shot Put" },
  { id: "DISCUS", label: "Discus" },
  { id: "HAMMER", label: "Hammer" },
  { id: "JAVELIN", label: "Javelin" },
];

const GENDER_OPTIONS: { id: Gender; label: string }[] = [
  { id: "MALE", label: "Male" },
  { id: "FEMALE", label: "Female" },
  { id: "OTHER", label: "Other" },
];

interface AddAthleteButtonProps {
  athleteCount: number;
  planLimit: number;
  currentPlan?: PlanName;
  selectedTeamId?: string;
}

export function AddAthleteButton({
  athleteCount,
  planLimit,
  currentPlan = "FREE",
  selectedTeamId,
}: AddAthleteButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const modal = useModal();
  const upgradeModal = useModal();

  // Top-level tab: Create Profile (default) | Send Invite
  const [topTab, setTopTab] = useState<TopTab>("create");

  // Create Profile form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<Gender>("OTHER");
  const [events, setEvents] = useState<ThrowEvent[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Invite (existing) state
  const [mode, setMode] = useState<InviteMode>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [sentViaEmail, setSentViaEmail] = useState(false);
  /// True when coach chose email mode but Resend returned emailSent:false.
  /// The invitation still exists (token in response) — the coach can copy
  /// the link — but we must NOT claim the email was delivered.
  const [emailDeliveryFailed, setEmailDeliveryFailed] = useState(false);

  const atLimit = planLimit !== Infinity && athleteCount >= planLimit;
  const success = !!inviteLink;

  function resetCreateForm() {
    setFirstName("");
    setLastName("");
    setGender("OTHER");
    setEvents([]);
    setCreateError("");
  }

  function resetInviteForm() {
    setInviteLink("");
    setError("");
    setEmail("");
    setCopied(false);
    setSentViaEmail(false);
    setEmailDeliveryFailed(false);
    setMode("email");
  }

  function handleOpen() {
    resetCreateForm();
    resetInviteForm();
    setTopTab("create");
    modal.onOpen();
  }

  function toggleEvent(ev: ThrowEvent) {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  }

  async function handleCreateProfile(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");

    if (!firstName.trim() || !lastName.trim()) {
      setCreateError("First and last name are required");
      return;
    }
    if (events.length === 0) {
      setCreateError("Select at least one event");
      return;
    }

    setCreateLoading(true);
    try {
      const res = await fetch("/api/coach/athletes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gender,
          events,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error ?? `Request failed (${res.status})`);
      }
      const created = payload.data as { id: string; firstName: string; lastName: string };

      // Auto-assign to selected team (best-effort)
      if (selectedTeamId) {
        try {
          await fetch(`/api/coach/teams/${selectedTeamId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body: JSON.stringify({ athleteIds: [created.id] }),
          });
        } catch {
          toast.warning("Added to roster but couldn't assign to group");
        }
      }

      toast.success(`Added ${created.firstName} ${created.lastName} to your roster`);
      modal.onClose();
      resetCreateForm();
      router.push(`/coach/athletes/${created.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create athlete";
      setCreateError(msg);
      toast.error(msg);
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    await createInvite("email", email.trim());
  }

  async function handleGenerateLink() {
    await createInvite("link");
  }

  async function createInvite(inviteMode: InviteMode, inviteEmail?: string) {
    setLoading(true);
    setError("");

    try {
      const body: Record<string, string> = {};
      if (inviteMode === "email" && inviteEmail) {
        body.email = inviteEmail;
      } else {
        body.mode = "link";
      }

      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create invitation");
      const token = data.data?.token;
      const link = `${window.location.origin}/athletes/claim/${token}`;
      setInviteLink(link);
      // Delivery status comes from the server's emailSent flag, NOT the
      // request mode. If Resend fails, the invitation still exists and the
      // link is valid, but claiming "Email delivered" would mislead the coach.
      const deliverySucceeded = data.emailSent === true;
      setSentViaEmail(inviteMode === "email" && deliverySucceeded);
      setEmailDeliveryFailed(inviteMode === "email" && !deliverySucceeded);
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
      copyLink();
    }
  }

  function handleInviteAnother() {
    setInviteLink("");
    setError("");
    setEmail("");
    setCopied(false);
    setSentViaEmail(false);
    setEmailDeliveryFailed(false);
  }

  // Footer is only shown for the Create tab and the Send Invite (email) flow.
  // The link flow has its own primary button inside the panel.
  const footer =
    topTab === "create" ? (
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={modal.onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleCreateProfile as never}
          loading={createLoading}
          className="min-h-[44px]"
        >
          Create Profile
        </Button>
      </div>
    ) : !success && mode === "email" ? (
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={modal.onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleEmailSubmit as never}
          loading={loading}
          className="min-h-[44px]"
        >
          Send Invitation
        </Button>
      </div>
    ) : !success && mode === "link" ? (
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={modal.onClose}>
          Cancel
        </Button>
      </div>
    ) : undefined;

  return (
    <>
      <Button
        variant="primary"
        size="md"
        onClick={atLimit ? upgradeModal.onOpen : handleOpen}
        aria-label="Add a new athlete"
      >
        + Add Athlete
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
        title="Add an Athlete"
        size="sm"
        footer={footer}
      >
        <Tabs defaultTab="create" activeTab={topTab} onChange={(id) => setTopTab(id as TopTab)}>
          <TabList variant="underline" className="mb-4">
            <TabTrigger id="create" variant="underline">
              Create Profile
            </TabTrigger>
            <TabTrigger id="invite" variant="underline">
              Send Invite
            </TabTrigger>
          </TabList>

          {/* ── Tab 1: Create Profile ────────────────────────────── */}
          <TabPanel id="create">
            <form onSubmit={handleCreateProfile} className="space-y-4">
              <p className="text-sm text-muted">
                Build a profile for an athlete you coach. They can claim it later with an invite if
                you want to give them app access.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  required
                  autoFocus
                />
                <Input
                  label="Last name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                />
              </div>

              {/* Gender toggle */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Gender
                </label>
                <div className="flex rounded-xl bg-surface-100 dark:bg-surface-800 p-1">
                  {GENDER_OPTIONS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGender(g.id)}
                      className={cn(
                        "flex-1 text-sm font-medium py-2 rounded-lg transition-all",
                        gender === g.id
                          ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                          : "text-muted hover:text-[var(--foreground)]"
                      )}
                      aria-pressed={gender === g.id}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Events multi-select pills */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Events
                </label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_OPTIONS.map((ev) => {
                    const selected = events.includes(ev.id);
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => toggleEvent(ev.id)}
                        className={cn(
                          "px-3.5 py-2 rounded-full text-sm font-medium border transition-all min-h-[36px]",
                          selected
                            ? "bg-primary-500 text-white border-primary-500 shadow-sm"
                            : "bg-[var(--card-bg)] text-[var(--foreground)] border-[var(--card-border)] hover:border-primary-500/50"
                        )}
                        aria-pressed={selected}
                      >
                        {ev.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {createError && (
                <p className="text-sm text-danger-600 dark:text-danger-400">{createError}</p>
              )}

              <PlanLimitBanner
                athleteCount={athleteCount}
                planLimit={planLimit}
                currentPlan={currentPlan}
                onUpgrade={() => {
                  modal.onClose();
                  upgradeModal.onOpen();
                }}
              />
            </form>
          </TabPanel>

          {/* ── Tab 2: Send Invite (existing flow) ───────────────── */}
          <TabPanel id="invite">
            {success ? (
              <div className="space-y-5 py-1">
                {/* Success header — three states: emailed, link-only, email-failed */}
                <div className="text-center py-2">
                  {emailDeliveryFailed ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-2">
                        <AlertTriangle
                          className="w-6 h-6 text-amber-600 dark:text-amber-400"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      </div>
                      <p className="font-semibold text-[var(--foreground)]">
                        Email couldn&apos;t be delivered
                      </p>
                      <p className="text-sm text-muted mt-1">
                        The invitation is valid — share the link below directly with your athlete.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
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
                      <p className="font-semibold text-[var(--foreground)]">
                        {sentViaEmail ? "Invitation sent!" : "Invite link created!"}
                      </p>
                      <p className="text-sm text-muted mt-1">
                        {sentViaEmail
                          ? "Email delivered. You can also share the link directly."
                          : "Share this one-time link with your athlete."}
                      </p>
                    </>
                  )}
                </div>

                {/* Action buttons */}
                <div className="space-y-2">
                  {canShare && (
                    <button
                      onClick={shareLink}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-500 text-white font-semibold text-sm py-3.5 hover:bg-primary-600 active:bg-primary-700 transition-colors min-h-[48px]"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                      Send via Text or App
                    </button>
                  )}

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
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Copied to clipboard
                      </>
                    ) : (
                      <>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy Invite Link
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-muted text-center">One-time use. Expires in 7 days.</p>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleInviteAnother}
                    className="flex-1 min-h-[40px]"
                  >
                    Invite another
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={modal.onClose}
                    className="flex-1 min-h-[40px]"
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mode toggle */}
                <div className="flex rounded-xl bg-surface-100 dark:bg-surface-800 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("email");
                      setError("");
                    }}
                    className={cn(
                      "flex-1 text-sm font-medium py-2 rounded-lg transition-all",
                      mode === "email"
                        ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                        : "text-muted hover:text-[var(--foreground)]"
                    )}
                  >
                    Send Email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("link");
                      setError("");
                    }}
                    className={cn(
                      "flex-1 text-sm font-medium py-2 rounded-lg transition-all",
                      mode === "link"
                        ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                        : "text-muted hover:text-[var(--foreground)]"
                    )}
                  >
                    Get a Link
                  </button>
                </div>

                {mode === "email" ? (
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                      error={error}
                    />
                    <PlanLimitBanner
                      athleteCount={athleteCount}
                      planLimit={planLimit}
                      currentPlan={currentPlan}
                      onUpgrade={() => {
                        modal.onClose();
                        upgradeModal.onOpen();
                      }}
                    />
                  </form>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted">
                      Generate a one-time invite link to send over text, WhatsApp, or any messaging
                      app.
                    </p>
                    <button
                      type="button"
                      onClick={handleGenerateLink}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-500 text-white font-semibold text-sm py-3.5 hover:bg-primary-600 active:bg-primary-700 transition-colors min-h-[48px] disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                          Generate Invite Link
                        </>
                      )}
                    </button>
                    {error && (
                      <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
                    )}
                    <PlanLimitBanner
                      athleteCount={athleteCount}
                      planLimit={planLimit}
                      currentPlan={currentPlan}
                      onUpgrade={() => {
                        modal.onClose();
                        upgradeModal.onOpen();
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </TabPanel>
        </Tabs>
      </Modal>
    </>
  );
}
