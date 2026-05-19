import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Printer } from "lucide-react";
import { AddAthleteButton } from "./_invite";
import { BulkInviteBar } from "./_bulk-invite-bar";
import { CsvImportButton } from "./_csv-import-button";
import { TeamFilter } from "./_team-filter";
import { RosterClient } from "./_roster-client";
import { RosterEmptyState } from "./_empty-state";
import { ThrowsView } from "./_views/throws-view";
import { MovedBanner } from "./_views/moved-banner";
import {
  requireCoachSession,
  getAthleteRoster,
  PLAN_LIMITS,
  type AthleteRosterItem,
} from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { PlanName } from "@/lib/stripe";
import { InvitationsClient } from "../invitations/_invitations-client";
import { AthleteLogsList } from "../athlete-logs/_athlete-logs-client";

type Tab = "roster" | "invitations" | "throws" | "self-logs";

type RosterFilter = "missing-readiness" | "needs-review" | null;

export default async function AthletesPage({
  searchParams,
}: {
  searchParams: { tab?: string; teamId?: string; moved?: string; filter?: string };
}) {
  const { coach } = await requireCoachSession();
  const tab: Tab =
    searchParams.tab === "invitations"
      ? "invitations"
      : searchParams.tab === "throws"
        ? "throws"
        : searchParams.tab === "self-logs"
          ? "self-logs"
          : "roster";
  const rosterFilter: RosterFilter =
    searchParams.filter === "missing-readiness"
      ? "missing-readiness"
      : searchParams.filter === "needs-review"
        ? "needs-review"
        : null;

  // Fetch teams for the filter dropdown
  const teams = await prisma.team.findMany({
    where: { coachId: coach.id },
    select: {
      id: true,
      name: true,
      parentTeamId: true,
      order: true,
      _count: { select: { members: true } },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  const teamOptions = teams.map((t) => ({
    id: t.id,
    name: t.name,
    parentTeamId: t.parentTeamId,
    order: t.order,
    memberCount: t._count.members,
  }));

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
    } catch (err) {
      // ignore parse error
      logger.debug("ignore parse error", {
        context: "src/app/(dashboard)/coach/athletes/page.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
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
  let rosterLoadFailed = false;
  try {
    roster = await getAthleteRoster(coach.id, resolvedTeamId ?? undefined);
  } catch (err) {
    // Fail-soft: render the rest of the page with an explicit banner so
    // the coach sees their team filter, invite buttons, etc., but also
    // knows the roster didn't load. An empty array with no banner (the
    // prior behavior) was indistinguishable from "coach has no athletes"
    // which misled users during a brief DB outage.
    logger.error("Failed to load coach roster", {
      context: "coach/athletes",
      metadata: { coachId: coach.id, teamId: resolvedTeamId },
      error: err,
    });
    roster = [];
    rosterLoadFailed = true;
  }

  const planLimit = PLAN_LIMITS[coach.plan];

  // Apply weekly-loop filter (drives the "This week" tile links on the
  // coach dashboard — see tasks/mvp-weekly-loop.md).
  let filteredRoster = roster;
  if (rosterFilter === "missing-readiness") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    filteredRoster = roster.filter((a) => {
      if (!a.latestReadiness) return true;
      return new Date(a.latestReadiness.date).getTime() < sevenDaysAgo.getTime();
    });
  } else if (rosterFilter === "needs-review") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentCompletions, recentNotes] = await Promise.all([
      prisma.throwsAssignment.findMany({
        where: {
          athlete: { coachId: coach.id },
          completedAt: { gte: sevenDaysAgo },
          status: { in: ["COMPLETED", "PARTIAL"] },
        },
        select: { athleteId: true },
        distinct: ["athleteId"],
      }),
      prisma.coachNote.findMany({
        where: { coachProfileId: coach.id, createdAt: { gte: sevenDaysAgo } },
        select: { athleteProfileId: true },
        distinct: ["athleteProfileId"],
      }),
    ]);
    const completed = new Set(recentCompletions.map((c) => c.athleteId));
    const reviewed = new Set(recentNotes.map((n) => n.athleteProfileId));
    filteredRoster = roster.filter((a) => completed.has(a.id) && !reviewed.has(a.id));
  }

  // Sort by attentionReason severity so the coach scans top-to-bottom and
  // sees who needs them today first. Lexicographic name sort within bucket
  // keeps roster order stable when nothing is flagged.
  const ATTENTION_RANK: Record<string, number> = {
    INJURED: 0,
    LOW_READINESS: 1,
    NO_CHECKIN: 2,
    STALE_PLAN: 3,
    NEEDS_REVIEW: 4,
  };
  const sorted = [...filteredRoster].sort((a, b) => {
    const aRank = a.attentionReason ? ATTENTION_RANK[a.attentionReason] : 99;
    const bRank = b.attentionReason ? ATTENTION_RANK[b.attentionReason] : 99;
    if (aRank !== bRank) return aRank - bRank;
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

  // Self-logged athlete sessions — only fetched when the tab needs them.
  // Mirrors the legacy /coach/athlete-logs page query; commit 5 redirects
  // /coach/athlete-logs → /coach/athletes?tab=self-logs.
  const selfLoggedSessions =
    tab === "self-logs"
      ? await prisma.athleteThrowsSession.findMany({
          where: { athlete: { coachId: coach.id } },
          orderBy: { date: "desc" },
          take: 100,
          include: {
            drillLogs: { orderBy: { createdAt: "asc" } },
            athlete: { select: { firstName: true, lastName: true, id: true } },
          },
        })
      : [];

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
        <div className="flex items-center gap-2 flex-wrap">
          {teamOptions.length > 0 && (
            <TeamFilter teams={teamOptions} currentTeamId={resolvedTeamId} />
          )}
          <Link
            href={
              resolvedTeamId
                ? `/coach/athletes/print?teamId=${encodeURIComponent(resolvedTeamId)}`
                : "/coach/athletes/print"
            }
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-[var(--foreground)] border border-[var(--card-border)] hover:border-primary-500/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            aria-label="Open print view of roster"
          >
            <Printer size={14} strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden sm:inline">Print roster</span>
          </Link>
          <CsvImportButton
            athleteCount={roster.length}
            planLimit={planLimit}
            selectedTeamId={
              resolvedTeamId && resolvedTeamId !== "unassigned" ? resolvedTeamId : undefined
            }
          />
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

      {/* Tier-1 tab bar — Roster / Self-Logs / Competitions.
          Roster + Self-Logs are URL-state on this page; Competitions is a
          sibling route at /coach/athletes/competitions and links there.
          Throws + Invitations remain accessible via legacy ?tab= URLs and
          via sidebar children — they're Tier 2, not in this header. */}
      <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
        {(
          [
            { id: "roster", label: "Roster", kind: "url-state" },
            { id: "self-logs", label: "Self-Logs", kind: "url-state" },
            { id: "competitions", label: "Competitions", kind: "sibling-route" },
          ] as const
        ).map((t) => {
          const params = new URLSearchParams();
          if (t.kind === "url-state" && t.id !== "roster") params.set("tab", t.id);
          if (resolvedTeamId) params.set("teamId", resolvedTeamId);
          const qs = params.toString();
          const href =
            t.kind === "sibling-route"
              ? "/coach/athletes/competitions"
              : qs
                ? `/coach/athletes?${qs}`
                : "/coach/athletes";
          // Competitions pill is "active" only when the user is on the sibling
          // page — but this server component doesn't know the current pathname,
          // so the pill stays passive on /coach/athletes. Coaches who land on
          // /coach/athletes/competitions see its own page chrome.
          const isActive = t.kind === "url-state" && tab === t.id;
          return (
            <Link
              key={t.id}
              href={href}
              replace={t.kind === "url-state"}
              className={`flex-1 text-center py-2 px-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                isActive
                  ? "bg-white dark:bg-surface-700 text-[var(--foreground)] shadow-sm"
                  : "text-muted hover:text-[var(--foreground)]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {tab === "throws" && searchParams.moved === "1" && <MovedBanner />}

      {/* Pending-invitation hint — used to live in the Invitations tab pill
          badge; without that pill, surface the count inline so coaches still
          see it from the Roster view. */}
      {tab === "roster" && pendingCount > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--card-border)] px-4 py-2.5 text-sm">
          <span className="text-muted">
            <strong className="text-[var(--foreground)] tabular-nums">{pendingCount}</strong>{" "}
            pending invitation{pendingCount === 1 ? "" : "s"}
          </span>
          <Link
            href="/coach/athletes/invitations"
            className="text-primary-500 hover:underline font-medium"
          >
            Review →
          </Link>
        </div>
      )}

      {/* Roster tab */}
      {tab === "roster" && (
        <>
          {rosterLoadFailed && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-3 animate-fade-slide-in">
              <AlertTriangle
                className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <div className="text-sm text-red-700 dark:text-red-400 leading-snug">
                <p className="font-semibold">Couldn&apos;t load your roster</p>
                <p className="text-xs mt-0.5 opacity-80">
                  Refresh to retry. If this keeps happening, contact support.
                </p>
              </div>
            </div>
          )}
          {rosterFilter && (
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 flex items-center justify-between gap-3 animate-fade-slide-in">
              <p className="text-sm text-[var(--foreground)]">
                <strong className="font-semibold">Filtered:</strong>{" "}
                {rosterFilter === "missing-readiness"
                  ? "Athletes with no readiness check-in in the last 7 days"
                  : "Athletes who completed a session this week with no coach note"}{" "}
                <span className="text-muted">
                  · {sorted.length} {sorted.length === 1 ? "athlete" : "athletes"}
                </span>
              </p>
              <Link
                href={
                  resolvedTeamId ? `/coach/athletes?teamId=${resolvedTeamId}` : "/coach/athletes"
                }
                className="text-xs font-medium text-primary-500 hover:underline shrink-0"
              >
                Clear filter ×
              </Link>
            </div>
          )}
          {!rosterFilter && needsAttention > 0 && (
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
          {roster.length === 0 && !rosterLoadFailed ? (
            <RosterEmptyState />
          ) : (
            <Suspense fallback={null}>
              <RosterClient data={sorted} />
            </Suspense>
          )}
        </>
      )}

      {/* Invitations tab */}
      {tab === "invitations" && (
        <>
          <BulkInviteBar data={sorted} />
          <InvitationsClient
            initialInvitations={invitations.map((inv) => ({
              ...inv,
              expiresAt: inv.expiresAt.toISOString(),
              createdAt: inv.createdAt.toISOString(),
            }))}
          />
        </>
      )}

      {/* Throws tab — legacy URL-state branch. Sidebar now points at
          /coach/athletes/throws (sibling); this branch keeps bookmarked
          ?tab=throws URLs working until commit 5 redirects. */}
      {tab === "throws" && (
        <ThrowsView
          teamId={resolvedTeamId && resolvedTeamId !== "unassigned" ? resolvedTeamId : null}
        />
      )}

      {/* Self-Logs tab — Tier 1, URL-state. Lifted from /coach/athlete-logs
          (legacy still serves; commit 5 redirects). */}
      {tab === "self-logs" && (
        <AthleteLogsList sessions={JSON.parse(JSON.stringify(selfLoggedSessions))} />
      )}
    </div>
  );
}
