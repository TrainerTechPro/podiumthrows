"use client";

import { useState, useEffect } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import Link from "next/link";

interface InvitationRow {
  id: string;
  email: string | null;
  token: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export default function ThrowsInvitePage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [recentInvites, setRecentInvites] = useState<InvitationRow[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/invitations")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.data)) {
          setRecentInvites(data.data.slice(0, 10));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingInvites(false));
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInviteLink("");
    setCopied(false);
    setEmailSent(false);
    setLoading(true);

    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate invite link");
        return;
      }
      const token = data.data?.token;
      const link = `${window.location.origin}/register?invite=${token}`;
      setInviteLink(link);
      setEmailSent(!!data.emailSent);
      const newInv: InvitationRow = data.data;
      setRecentInvites((prev) => [newInv, ...prev.slice(0, 9)]);
      setEmail("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(link: string, id?: string) {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const el = document.createElement("input");
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function buildLink(token: string) {
    return typeof window !== "undefined"
      ? `${window.location.origin}/register?invite=${token}`
      : `/register?invite=${token}`;
  }

  return (
    <div className="animate-spring-up space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <Link
          href="/coach/throws"
          aria-label="Back to Throws Dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors mb-3"
        >
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
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Throws Dashboard
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">
              Invite Athlete
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Generate a unique link or send an email invitation
            </p>
          </div>
        </div>
      </div>

      {/* Invite Form */}
      <form
        onSubmit={handleGenerate}
        className="card space-y-5"
        aria-label="Invite athlete form"
      >
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"
            aria-hidden="true"
          >
            <svg
              className="w-5 h-5 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              New Athlete Invite
            </h2>
            <p className="text-xs text-muted">
              Enter the athlete&apos;s email — they&apos;ll get an email and you&apos;ll get a link to share
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="invite-email"
            className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
          >
            Athlete email address
          </label>
          <input
            id="invite-email"
            type="email"
            className="input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="athlete@university.edu"
            required
            autoComplete="email"
            aria-describedby={error ? "invite-error" : undefined}
          />
        </div>

        {error && (
          <div
            id="invite-error"
            role="alert"
            className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="btn-primary w-full"
          aria-busy={loading}
        >
          {loading ? "Generating…" : "Generate Invite Link"}
        </button>
      </form>

      {/* Generated Link */}
      {inviteLink && (
        <div
          role="region"
          aria-label="Generated invite link"
          className="card border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10 space-y-3"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Invite link ready
            </h3>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              aria-label="Invite link"
              className="input text-xs flex-1 font-mono bg-[var(--surface)]"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => copyLink(inviteLink)}
              aria-label={copied ? "Link copied" : "Copy invite link"}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/60"
              }`}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-500">
            {emailSent
              ? "Email sent automatically. The link expires in 7 days."
              : "Share this link with your athlete. It expires in 7 days."}
          </p>
        </div>
      )}

      {/* Recent Invites */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Recent Invites
          </h2>
          <Link
            href="/coach/athletes?tab=invitations"
            className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
          >
            View all invitations
          </Link>
        </div>

        {loadingInvites ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading invitations">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        ) : recentInvites.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">
            No invites sent yet. Generate one above!
          </p>
        ) : (
          <div className="space-y-2" role="list" aria-label="Recent invitations">
            {recentInvites.map((inv) => {
              const link = buildLink(inv.token);
              const isPending =
                inv.status === "PENDING" && new Date(inv.expiresAt) > new Date();

              return (
                <div
                  key={inv.id}
                  role="listitem"
                  className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface)]"
                >
                  <div
                    className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-400 shrink-0"
                    aria-hidden="true"
                  >
                    {inv.email ? inv.email[0].toUpperCase() : "L"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">
                      {inv.email ?? "Link invite"}
                    </p>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        inv.status === "ACCEPTED"
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                          : isPending
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                          : "bg-[var(--surface-raised)] text-muted"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  {isPending && (
                    <button
                      onClick={() => copyLink(link, inv.id)}
                      aria-label={
                        copiedId === inv.id
                          ? "Link copied"
                          : `Copy invite link${inv.email ? ` for ${inv.email}` : ""}`
                      }
                      className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 px-2 py-1 rounded hover:bg-amber-500/10 transition-colors"
                    >
                      {copiedId === inv.id ? "Copied!" : "Copy Link"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
