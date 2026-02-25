import { requireCoachSession, PLAN_LIMITS } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { InviteAthleteButton } from "../athletes/_invite";
import type { PlanName } from "@/lib/stripe";

export const metadata = { title: "Invitations — Podium Throws" };

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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function isExpired(expiresAt: Date, status: string) {
  return status === "PENDING" && new Date(expiresAt) < new Date();
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default async function InvitationsPage() {
  let coach: Awaited<ReturnType<typeof requireCoachSession>>["coach"];
  try {
    const result = await requireCoachSession();
    coach = result.coach;
  } catch {
    redirect("/login");
  }

  const [invitations, athleteCount] = await Promise.all([
    prisma.invitation.findMany({
      where: { coachId: coach.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.athleteProfile.count({ where: { coachId: coach.id } }),
  ]);

  const planLimit = PLAN_LIMITS[coach.plan] ?? 3;
  const pending   = invitations.filter((i) => i.status === "PENDING" && !isExpired(i.expiresAt, i.status));
  const rest      = invitations.filter((i) => i.status !== "PENDING" || isExpired(i.expiresAt, i.status));

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Athlete Invitations
          </h1>
          <p className="text-sm text-muted mt-1">
            Invite athletes to join your roster via email.
            {planLimit !== Infinity && (
              <span className="ml-1">
                {athleteCount} / {planLimit} roster spots used.
              </span>
            )}
          </p>
        </div>
        <InviteAthleteButton
          athleteCount={athleteCount}
          planLimit={planLimit}
          currentPlan={coach.plan as PlanName}
        />
      </div>

      {/* Pending invitations */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Awaiting Response ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((inv) => (
              <div
                key={inv.id}
                className="card px-4 py-3 flex items-center gap-4"
              >
                {/* Icon */}
                <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
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

                {/* Email + date */}
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
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {rest.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            History
          </h2>
          <div className="space-y-2">
            {rest.map((inv) => {
              const effectiveStatus = isExpired(inv.expiresAt, inv.status)
                ? "EXPIRED"
                : inv.status;
              const config = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.REVOKED;

              return (
                <div
                  key={inv.id}
                  className="card px-4 py-3 flex items-center gap-4 opacity-75"
                >
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center shrink-0">
                    <svg
                      width="16"
                      height="16"
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

                  {/* Email + date */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate">
                      {inv.email}
                    </p>
                    <p className="text-xs text-muted">
                      Sent {formatDate(inv.createdAt)}
                    </p>
                  </div>

                  <Badge variant={config.variant}>{config.label}</Badge>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {invitations.length === 0 && (
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
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          }
          title="No invitations sent yet"
          description="Invite athletes by email. They'll receive a link to create their account and join your roster."
          action={
            <InviteAthleteButton
              athleteCount={athleteCount}
              planLimit={planLimit}
              currentPlan={coach.plan as PlanName}
            />
          }
        />
      )}
    </div>
  );
}
