import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Trophy, AlertTriangle, LogOut } from "lucide-react";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hashInvitationToken } from "@/lib/invitation-token";

export const metadata = { title: "Claim your profile — Podium Throws" };

// Always render fresh — this is a one-time-per-click landing page and
// stale preview data would be confusing.
export const dynamic = "force-dynamic";

type ClaimState =
  | { kind: "valid"; coachName: string; athleteName: string; events: string[]; expiresAt: Date }
  | { kind: "expired"; coachName: string | null }
  | { kind: "accepted" }
  | { kind: "revoked" }
  | { kind: "not_found" };

async function loadClaimState(token: string): Promise<ClaimState> {
  // Defensive — the route param is arbitrary user input, so reject malformed
  // tokens without a DB roundtrip.
  if (!token || token.length > 256 || !/^[a-f0-9]+$/i.test(token)) {
    return { kind: "not_found" };
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token: hashInvitationToken(token) },
    include: {
      athleteProfile: { select: { firstName: true, lastName: true, events: true } },
      coach: { select: { firstName: true, lastName: true } },
    },
  });

  if (!invitation) return { kind: "not_found" };
  if (invitation.status === "ACCEPTED") return { kind: "accepted" };
  if (invitation.status === "REVOKED") return { kind: "revoked" };

  const coachName = `${invitation.coach.firstName} ${invitation.coach.lastName}`;

  if (invitation.expiresAt < new Date()) {
    return { kind: "expired", coachName };
  }

  if (!invitation.athleteProfile) {
    // Invitation exists but isn't bound to a profile — shouldn't happen in the
    // proxy-profile flow but treat it as "not found" rather than exposing the
    // inconsistency.
    return { kind: "not_found" };
  }

  return {
    kind: "valid",
    coachName,
    athleteName: `${invitation.athleteProfile.firstName} ${invitation.athleteProfile.lastName}`,
    events: invitation.athleteProfile.events as string[],
    expiresAt: invitation.expiresAt,
  };
}

function formatEvent(e: string): string {
  return e
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatExpiry(date: Date): string {
  const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 1) return "today";
  if (days === 2) return "tomorrow";
  return `in ${days} days`;
}

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await loadClaimState(token);
  const session = await getSession();

  if (state.kind === "not_found") notFound();

  return (
    <main className="min-h-dvh bg-surface-50 dark:bg-surface-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" strokeWidth={2} aria-hidden="true" />
          </div>
          <span className="font-heading font-bold text-lg text-[var(--foreground)]">
            Podium Throws
          </span>
        </div>

        {state.kind === "valid" && <ValidCard state={state} token={token} session={session} />}

        {state.kind === "expired" && <ExpiredCard coachName={state.coachName} />}

        {state.kind === "accepted" && <AcceptedCard />}

        {state.kind === "revoked" && <RevokedCard />}
      </div>
    </main>
  );
}

/* ─── Valid-invite card ──────────────────────────────────────────────────── */

function ValidCard({
  state,
  token,
  session,
}: {
  state: {
    kind: "valid";
    coachName: string;
    athleteName: string;
    events: string[];
    expiresAt: Date;
  };
  token: string;
  session: { role: string; email: string } | null;
}) {
  return (
    <div className="card p-6 sm:p-8 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">
          You&apos;ve been invited
        </p>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Claim your Podium Throws profile
        </h1>
        <p className="text-sm text-muted mt-2">
          <strong className="text-[var(--foreground)]">{state.coachName}</strong> invited you to
          join their roster.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--surface-raised)] p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Your profile</p>
        <p className="text-lg font-semibold text-[var(--foreground)]">{state.athleteName}</p>
        {state.events.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {state.events.map((e) => (
              <span
                key={e}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary-500/10 text-primary-700 dark:text-primary-300"
              >
                {formatEvent(e)}
              </span>
            ))}
          </div>
        )}
      </div>

      {session ? (
        <LoggedInWarning session={session} />
      ) : (
        <Link href={`/register?invite=${token}`} className="btn-primary w-full justify-center">
          Set up my account →
        </Link>
      )}

      <p className="text-xs text-muted text-center">
        Link expires {formatExpiry(state.expiresAt)}. If this isn&apos;t you, you can safely ignore
        it.
      </p>
    </div>
  );
}

function LoggedInWarning({ session }: { session: { role: string; email: string } }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <div className="text-sm text-[var(--foreground)]">
          <p className="font-semibold">You&apos;re signed in as {session.email}</p>
          <p className="text-xs text-muted mt-1">
            To claim this profile, log out first and then return to this link.
          </p>
        </div>
      </div>
      <Link href="/api/auth/logout" className="btn-secondary w-full justify-center text-sm gap-2">
        <LogOut className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
        Log out
      </Link>
    </div>
  );
}

/* ─── Error cards ────────────────────────────────────────────────────────── */

function ExpiredCard({ coachName }: { coachName: string | null }) {
  return (
    <div className="card p-6 sm:p-8 space-y-4 text-center">
      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
        <Mail
          className="w-6 h-6 text-amber-600 dark:text-amber-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>
      <div>
        <h1 className="text-xl font-bold font-heading text-[var(--foreground)]">
          This invite expired
        </h1>
        <p className="text-sm text-muted mt-2">
          {coachName
            ? `Ask ${coachName} to send you a new invitation link.`
            : "Ask your coach to send you a new invitation link."}
        </p>
      </div>
      <Link href="/login" className="btn-secondary w-full justify-center">
        Back to login
      </Link>
    </div>
  );
}

function AcceptedCard() {
  return (
    <div className="card p-6 sm:p-8 space-y-4 text-center">
      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
        <Trophy
          className="w-6 h-6 text-emerald-600 dark:text-emerald-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>
      <div>
        <h1 className="text-xl font-bold font-heading text-[var(--foreground)]">Already claimed</h1>
        <p className="text-sm text-muted mt-2">
          This profile has already been claimed. Log in to continue.
        </p>
      </div>
      <Link href="/login" className="btn-primary w-full justify-center">
        Log in
      </Link>
    </div>
  );
}

function RevokedCard() {
  return (
    <div className="card p-6 sm:p-8 space-y-4 text-center">
      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
        <AlertTriangle
          className="w-6 h-6 text-red-600 dark:text-red-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>
      <div>
        <h1 className="text-xl font-bold font-heading text-[var(--foreground)]">
          This invite was cancelled
        </h1>
        <p className="text-sm text-muted mt-2">
          Your coach revoked this invitation. Ask them for a new one if you still need access.
        </p>
      </div>
      <Link href="/login" className="btn-secondary w-full justify-center">
        Back to login
      </Link>
    </div>
  );
}
