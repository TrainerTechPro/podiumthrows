"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/components";
import { useToast } from "@/components/toast";
import { csrfHeaders } from "@/lib/csrf-client";

/* ─── Types ───────────────────────────────────────────────────────────────── */

export interface InvitationRow {
  id: string;
  email: string | null;
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
  PENDING: { label: "Pending", variant: "warning" },
  ACCEPTED: { label: "Accepted", variant: "success" },
  REVOKED: { label: "Revoked", variant: "neutral" },
  EXPIRED: { label: "Expired", variant: "neutral" },
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

/* ─── Component ───────────────────────────────────────────────────────────── */

export function InvitationsClient({ initialInvitations }: Props) {
  const [invitations, setInvitations] = useState<InvitationRow[]>(initialInvitations);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const { confirm, Dialog: ConfirmDialogPortal } = useConfirm();
  const { toast } = useToast();

  const pending = invitations.filter(
    (i) => i.status === "PENDING" && !isExpired(i.expiresAt, i.status)
  );
  const rest = invitations.filter(
    (i) => i.status !== "PENDING" || isExpired(i.expiresAt, i.status)
  );

  function revokeInvitation(inv: InvitationRow) {
    confirm({
      title: `Revoke invitation${inv.email ? ` to ${inv.email}` : ""}?`,
      description: "The link will no longer work.",
      confirmLabel: "Revoke",
      variant: "danger",
      onConfirm: async () => {
        setRevokingId(inv.id);
        try {
          const res = await fetch(`/api/invitations/${inv.id}`, {
            method: "PATCH",
            headers: csrfHeaders(),
          });
          if (!res.ok) throw new Error("Failed to revoke");
          setInvitations((prev) =>
            prev.map((i) => (i.id === inv.id ? { ...i, status: "REVOKED" } : i))
          );
          toast("Invitation revoked", "success");
        } catch {
          toast("Failed to revoke invitation. Please try again.", "error");
        } finally {
          setRevokingId(null);
        }
      },
    });
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
        description="Invite athletes by email or shareable link. They'll create their account and join your roster automatically."
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
              <div key={inv.id} role="listitem" className="card px-4 py-3 space-y-3">
                {/* Top row: icon + email/label + badge + actions */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full ${inv.email ? "bg-primary-500/10" : "bg-primary-500/10"} flex items-center justify-center shrink-0`}
                    aria-hidden="true"
                  >
                    {inv.email ? (
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
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--primary-500)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate">
                      {inv.email ?? "Link invite"}
                    </p>
                    <p className="text-xs text-muted">
                      Sent {formatDate(inv.createdAt)} · Expires {formatDate(inv.expiresAt)}
                    </p>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                </div>

                {/* Actions row — stacks on mobile.
                    Copy-link affordance was removed when invitation tokens were hashed:
                    the raw token only exists in the recipient's email. To re-share a link,
                    revoke and create a new invite. */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pl-0 sm:pl-12">
                  <p className="flex-1 text-xs text-muted px-3 py-2 sm:py-1.5 text-center sm:text-left">
                    {inv.email
                      ? "Link delivered by email. Revoke to re-issue."
                      : "Shareable link was shown when this invite was created. Revoke to re-issue."}
                  </p>
                  <button
                    onClick={() => revokeInvitation(inv)}
                    disabled={revokingId === inv.id}
                    aria-label={`Revoke invitation${inv.email ? ` for ${inv.email}` : ""}`}
                    className="px-3 py-2.5 sm:py-1.5 rounded-lg text-sm sm:text-xs font-semibold transition-colors border bg-[var(--surface)] text-muted border-[var(--border)] hover:text-danger-600 hover:border-danger-500/30 hover:bg-danger-500/5 active:bg-danger-500/10 disabled:opacity-50 min-h-[44px] sm:min-h-0"
                  >
                    {revokingId === inv.id ? "Revoking..." : "Revoke"}
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
              const effectiveStatus = isExpired(inv.expiresAt, inv.status) ? "EXPIRED" : inv.status;
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
                    {inv.email ? (
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
                    ) : (
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
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate">
                      {inv.email ?? "Link invite"}
                    </p>
                    <p className="text-xs text-muted">Sent {formatDate(inv.createdAt)}</p>
                  </div>
                  <Badge variant={config.variant}>{config.label}</Badge>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <ConfirmDialogPortal />
    </div>
  );
}
