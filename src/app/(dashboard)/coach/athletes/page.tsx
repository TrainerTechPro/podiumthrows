import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { AddAthleteButton } from "./_invite";
import { TeamFilter } from "./_team-filter";
import { RosterClient } from "./_roster-client";
import { ThrowsView } from "./_views/throws-view";
import { MovedBanner } from "./_views/moved-banner";
import {
  requireCoachSession,
  getAthleteRoster,
  PLAN_LIMITS,
  type AthleteRosterItem,
} from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import type { PlanName } from "@/lib/stripe";
import { InvitationsClient } from "../invitations/_invitations-client";

type Tab = "roster" | "invitations" | "throws";

export default async function AthletesPage({
  searchParams,
}: {
  searchParams: { tab?: string; teamId?: string; moved?: string };
}) {
  const { coach } = await requireCoachSession();
  const tab: Tab =
    searchParams.tab === "invitations"
      ? "invitations"
      : searchParams.tab === "throws"
        ? "throws"
        : "roster";

  // Fetch teams for the filter dropdown
  const teams = await prisma.team.findMany({
    where: { coachId: coach.id },
    select: { id: true, name: true, _count: { select: { members: true } } },
    orderBy: { createdAt: "asc" },
  });
  const teamOptions = teams.map((t) => ({ id: t.id, name: t.name, memberCount: t._count.members }));

  // Resolve teamId: URL param takes precedence, then saved preference
  let resolvedTeamId = searchParams.teamId ?? null;
  if (!resolvedTeamId) {
    try {
      const prefs = JSON.parse((coach.preferences as string) || "{}");
      if (prefs.lastTeamId && teams.some((t) => t.id === prefs.lastTeamId)) {
        resolvedTeamId = prefs.lastTeamId;
      } else if (prefs.lastTeamId === "unassigned") {
        resolvedTeamId = "unassigned";
      }
    } catch {
      /* ignore parse error */
    }
  }
  // Validate that selected team still exists (might have been deleted)
  if (
    resolvedTeamId &&
    resolvedTeamId !== "unassigned" &&
    !teams.some((t) => t.id === resolvedTeamId)
  ) {
    resolvedTeamId = null;
  }

  let roster: AthleteRosterItem[];
  try {
    roster = await getAthleteRoster(coach.id, resolvedTeamId ?? undefined);
  } catch {
    roster = [];
  }

  const planLimit = PLAN_LIMITS[coach.plan];

  // Sort: lowest readiness first (needs attention), no check-in last
  const sorted = [...roster].sort((a, b) => {
    const aScore = a.latestReadiness?.score ?? 999;
    const bScore = b.latestReadiness?.score ?? 999;
    if (aScore !== bScore) return aScore - bScore;
    return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
  });

  const lowCount = roster.filter((a) => a.latestReadiness && a.latestReadiness.score < 5).length;
  const noCheckInCount = roster.filter((a) => !a.latestReadiness).length;
  const needsAttention = lowCount + noCheckInCount;

  // Fetch invitations for the invitations tab.
  // `token` is intentionally not selected — the DB stores only the SHA-256
  // hash, so the value is useless to the client. The raw token lives only
  // in the recipient's email.
  const invitations =
    tab === "invitations"
      ? await prisma.invitation.findMany({
          where: { coachId: coach.id },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            email: true,
            status: true,
            expiresAt: true,
            createdAt: true,
          },
        })
      : [];

  const pendingCount =
    tab === "roster"
      ? await prisma.invitation.count({ where: { coachId: coach.id, status: "PENDING" } })
      : invitations.filter((i) => i.status === "PENDING").length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Athletes</h1>
          <p className="text-sm text-muted mt-0.5">
            {roster.length} {roster.length === 1 ? "athlete" : "athletes"}
            {resolvedTeamId ? " in this group" : " on your roster"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {teamOptions.length > 0 && (
            <TeamFilter teams={teamOptions} currentTeamId={resolvedTeamId} />
          )}
          <AddAthleteButton
            athleteCount={roster.length}
            planLimit={planLimit}
            currentPlan={coach.plan as PlanName}
            selectedTeamId={
              resolvedTeamId && resolvedTeamId !== "unassigned" ? resolvedTeamId : undefined
            }
          />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
        {[
          { id: "roster" as const, label: "Roster", badge: undefined as number | undefined },
          { id: "throws" as const, label: "Throws", badge: undefined },
          {
            id: "invitations" as const,
            label: "Invitations",
            badge: pendingCount > 0 ? pendingCount : undefined,
          },
        ].map((t) => {
          const params = new URLSearchParams();
          if (t.id !== "roster") params.set("tab", t.id);
          if (resolvedTeamId) params.set("teamId", resolvedTeamId);
          const qs = params.toString();
          return (
            <Link
              key={t.id}
              href={qs ? `/coach/athletes?${qs}` : "/coach/athletes"}
              replace
              className={`flex-1 text-center py-2 px-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                tab === t.id
                  ? "bg-white dark:bg-surface-700 text-[var(--foreground)] shadow-sm"
                  : "text-muted hover:text-[var(--foreground)]"
              }`}
            >
              {t.label}
              {t.badge != null && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-500 text-white">
                  {t.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {tab === "throws" && searchParams.moved === "1" && <MovedBanner />}

      {/* Roster tab */}
      {tab === "roster" && (
        <>
          {needsAttention > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-3 animate-fade-slide-in">
              <AlertTriangle
                className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <p className="text-sm text-red-700 dark:text-red-400 leading-snug">
                {lowCount > 0 && noCheckInCount > 0 ? (
                  <>
                    <strong>{lowCount}</strong> {lowCount === 1 ? "athlete has" : "athletes have"}{" "}
                    low readiness and <strong>{noCheckInCount}</strong>{" "}
                    {noCheckInCount === 1 ? "hasn't" : "haven't"} checked in recently.
                  </>
                ) : lowCount > 0 ? (
                  <>
                    <strong>{lowCount}</strong> {lowCount === 1 ? "athlete has" : "athletes have"} a
                    readiness score below 5 — consider adjusting training load.
                  </>
                ) : (
                  <>
                    <strong>{noCheckInCount}</strong>{" "}
                    {noCheckInCount === 1 ? "athlete hasn't" : "athletes haven't"} submitted a
                    readiness check-in yet.
                  </>
                )}
              </p>
            </div>
          )}
          <Suspense fallback={null}>
            <RosterClient data={sorted} />
          </Suspense>
        </>
      )}

      {/* Invitations tab */}
      {tab === "invitations" && (
        <InvitationsClient
          initialInvitations={invitations.map((inv) => ({
            ...inv,
            expiresAt: inv.expiresAt.toISOString(),
            createdAt: inv.createdAt.toISOString(),
          }))}
        />
      )}

      {/* Throws tab */}
      {tab === "throws" && (
        <ThrowsView
          teamId={resolvedTeamId && resolvedTeamId !== "unassigned" ? resolvedTeamId : null}
        />
      )}
    </div>
  );
}
