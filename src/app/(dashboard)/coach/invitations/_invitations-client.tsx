"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

/* ─── Types ───────────────────────────────────────────────────────────────── */

export interface InvitationRow {
  id: string;
  email: string;
  token: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface Props {
  initialInvitations: InvitationRow[];
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "warning" | "success" | "neutral" | "danger" }
> = {
  PENDING:  { label: "Pending",  variant: "warning"  },
  ACCEPTED: { label: "Accepted", variant: "success"  },
  REVOKED:  { label: "Revoked",  variant: "neutral"  },
  EXPIRED:  { label: "Expired",  variant: "neutral"  },
};

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

function isExpired(expiresAt: string, status: string) {
  return status === "PENDING" && new Date(expiresAt) < new Date();
}

function buildInviteLink(token: string) {
  return `${window.location.origin}/register?invite=${token}`;
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function InvitationsClient({ initialInvitations }: Props) {
  const [invitations, setInvitations] = useState<InvitationRow[]>(initialInvitations);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const pending = invitations.filter(
    (i) => i.status === "PENDING" && !isExpired(i.expiresAt, i.status)
  );
  const rest = invitations.filter(
    (i) => i.status !== "PENDING" || isExpired(i.expiresAt, i.status)
  );

  async function copyLink(inv: InvitationRow) {
    const link = buildInviteLink(inv.token);
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
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function revokeInvitation(inv: InvitationRow) {
    if (!confirm(`Revoke invitation to ${inv.email}? The link will no longer work.`)) return;
    setRevokingId(inv.id);
    try {
      const res = await fetch(`/api/invitations/${inv.id}`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to revoke");
      setInvitations((prev) =>
        prev.map((i) => (i.id === inv.id ? { ...i, status: "REVOKED" } : i))
      );
    } catch {
      alert("Failed to revoke invitation. Please try again.");
    } finally {
      setRevokingId(null);
    }
  }

  if (invitations.length === 0) {
    return (
      <EmptyState
        icon={
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted"
            aria-hidden="true"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        }
        title="No invitations sent yet"
        description="Invite athletes by email. They'll receive a link to create their account and join your roster."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending */}
      {pending.length > 0 && (
        <section aria-labelledby="pending-heading" className="space-y-3">
          <h2
            id="pending-heading"
            className="text-xs font-semibold uppercase tracking-widest text-muted"
          >
            Awaiting Response ({pending.length})
          </h2>
          <div className="space-y-2" role="list" aria-label="Pending invitations">
            {pending.map((inv) => (
              <div
                key={inv.id}
                role="listitem"
                className="card px-4 py-3 space-y-3"
              >
                {/* Top row: icon + email + badge + actions */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate">
                      {inv.email}
                    </p>
                    <p className="text-xs text-muted">
                      Sent {formatDate(inv.createdAt)} · Expires {formatDate(inv.expiresAt)}
                    </p>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                </div>

                {/* Copy link row */}
                <div className="flex items-center gap-2 pl-12">
                  <div className="flex-1 min-w-0 rounded-md bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 overflow-hidden">
                    <span className="text-xs font-mono text-muted truncate block">
                      {buildInviteLink(inv.token)}
                    </span>
                  </div>
                  <button
                    onClick={() => copyLink(inv)}
                    aria-label={copiedId === inv.id ? "Link copied" : `Copy invite link for ${inv.email}`}
                    className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${
                      copiedId === inv.id
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--surface-raised)]"
                    }`}
                  >
                    {copiedId === inv.id ? "Copied!" : "Copy Link"}
                  </button>
                  <button
                    onClick={() => revokeInvitation(inv)}
                    disabled={revokingId === inv.id}
                    aria-label={`Revoke invitation for ${inv.email}`}
                    className="shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold transition-all border bg-[var(--surface)] text-muted border-[var(--border)] hover:text-red-600 hover:border-red-500/30 hover:bg-red-500/5 disabled:opacity-50"
                  >
                    {revokingId === inv.id ? "Revoking…" : "Revoke"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {rest.length > 0 && (
        <section aria-labelledby="history-heading" className="space-y-3">
          <h2
            id="history-heading"
            className="text-xs font-semibold uppercase tracking-widest text-muted"
          >
            History
          </h2>
          <div className="space-y-2" role="list" aria-label="Invitation history">
            {rest.map((inv) => {
              const effectiveStatus = isExpired(inv.expiresAt, inv.status)
                ? "EXPIRED"
                : inv.status;
              const config = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.REVOKED;

              return (
                <div
                  key={inv.id}
                  role="listitem"
                  className="card px-4 py-3 flex items-center gap-4 opacity-70"
                >
                  <div
                    className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-muted"
                      aria-hidden="true"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate">{inv.email}</p>
                    <p className="text-xs text-muted">Sent {formatDate(inv.createdAt)}</p>
                  </div>
                  <Badge variant={config.variant}>{config.label}</Badge>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
