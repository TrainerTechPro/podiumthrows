"use client";

import { useState, FormEvent } from "react";
import { Input } from "@/components";

interface ProfileFormProps {
  initial: {
    firstName: string;
    lastName: string;
    bio: string | null;
    organization: string | null;
  };
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const [firstName,    setFirstName]    = useState(initial.firstName);
  const [lastName,     setLastName]     = useState(initial.lastName);
  const [bio,          setBio]          = useState(initial.bio ?? "");
  const [organization, setOrganization] = useState(initial.organization ?? "");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError(null);

    try {
      const res = await fetch("/api/coach/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, bio: bio || null, organization: organization || null }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save changes.");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          label="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          disabled={loading}
        />
        <Input
          label="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <Input
        label="Organization / Team"
        value={organization}
        onChange={(e) => setOrganization(e.target.value)}
        placeholder="e.g. University of Oregon"
        disabled={loading}
      />

      <div className="space-y-1.5">
        <label className="label">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          placeholder="Tell athletes a little about yourself…"
          disabled={loading}
          className="input w-full resize-none"
        />
      </div>

      <div className="flex items-center gap-4 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? "Saving…" : "Save Changes"}
        </button>

        {success && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            ✓ Saved
          </span>
        )}
        {error && (
          <span className="text-sm text-red-500">{error}</span>
        )}
      </div>
    </form>
  );
}

/* ─── Upgrade Button ─────────────────────────────────────────────────────── */

export function UpgradeButton({ plan }: { plan: "PRO" | "ELITE" }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error("Could not start checkout.");
      const { url } = await res.json();
      window.location.href = url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button onClick={handleClick} disabled={loading} className="btn btn-primary">
        {loading ? "Redirecting…" : `Upgrade to ${plan === "PRO" ? "Pro" : "Elite"} →`}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

/* ─── Stripe Portal Button ───────────────────────────────────────────────── */

export function PortalButton({ hasStripe }: { hasStripe: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (!res.ok) throw new Error("Could not open billing portal.");
      const { url } = await res.json();
      window.location.href = url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  if (!hasStripe) {
    return (
      <p className="text-sm text-muted">
        No billing account linked. Upgrade to a paid plan to manage billing.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="btn btn-secondary"
      >
        {loading ? "Opening…" : "Manage Billing →"}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
