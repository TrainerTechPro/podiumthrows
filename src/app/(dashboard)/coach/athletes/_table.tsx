"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Timer, TrendingUp, Trophy } from "lucide-react";
import { Avatar, Badge, DataTable, type Column } from "@/components";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { AthleteRosterItem, ClaimStatus, AttentionReason } from "@/lib/data/coach";
import { CoachTestCaptureSheet } from "@/components/performance-tests/CoachTestCaptureSheet";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function formatRelativeFuture(iso: string | null): string {
  if (!iso) return "—";
  const target = new Date(iso).getTime();
  const diffDays = Math.round((target - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ─── Attention indicator — shared between table cell and mobile card ────── */

export const ATTENTION_META: Record<
  AttentionReason,
  { label: string; tone: "danger" | "warning" | "neutral" }
> = {
  INJURED: { label: "Injured", tone: "danger" },
  LOW_READINESS: { label: "Low readiness", tone: "danger" },
  NO_CHECKIN: { label: "No check-in 7d+", tone: "warning" },
  STALE_PLAN: { label: "No session 14d+", tone: "warning" },
  NEEDS_REVIEW: { label: "Needs review", tone: "warning" },
};

function AttentionCell({ row }: { row: AthleteRosterItem }) {
  if (!row.attentionReason) {
    return <span className="text-muted text-sm">—</span>;
  }
  const meta = ATTENTION_META[row.attentionReason];
  return <Badge variant={meta.tone}>{meta.label}</Badge>;
}

/* ─── Status pill ─────────────────────────────────────────────────────────── */

function StatusPill({ status }: { status: ClaimStatus }) {
  if (status === "CLAIMED") return null;
  if (status === "INVITED") {
    return (
      <Badge variant="warning" className="ml-1.5">
        Invited
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" className="ml-1.5">
      Not invited
    </Badge>
  );
}

/* ─── Cell renderers ─────────────────────────────────────────────────────── */

function AthleteCell({ row }: { row: AthleteRosterItem }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={`${row.firstName} ${row.lastName}`} src={row.avatarUrl} size="sm" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)] truncate flex items-center flex-wrap gap-y-0.5">
          <span className="truncate">
            {row.firstName} {row.lastName}
          </span>
          <StatusPill status={row.claimStatus} />
        </p>
      </div>
    </div>
  );
}

function EventsCell({ row }: { row: AthleteRosterItem }) {
  if (row.events.length === 0) {
    return <span className="text-muted text-sm">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {row.events.map((e) => (
        <Badge key={e} variant="neutral">
          {formatEventName(e)}
        </Badge>
      ))}
    </div>
  );
}

function ReadinessBreakdown({
  sleep,
  soreness,
  stress,
  energy,
}: {
  sleep: number;
  soreness: number;
  stress: number;
  energy: number;
}) {
  const factors = [
    { label: "Sleep", raw: sleep, wellness: sleep },
    { label: "Soreness", raw: soreness, wellness: 11 - soreness },
    { label: "Stress", raw: stress, wellness: 11 - stress },
    { label: "Energy", raw: energy, wellness: energy },
  ];

  return (
    <div className="flex items-end gap-0.5 h-3.5" aria-hidden="true">
      {factors.map((f) => {
        const color =
          f.wellness >= 8 ? "bg-emerald-500" : f.wellness >= 5 ? "bg-amber-500" : "bg-red-500";
        const heightPx = 2 + Math.round((f.wellness / 10) * 12);
        return (
          <span
            key={f.label}
            title={`${f.label}: ${f.raw}/10`}
            className={`w-[3px] rounded-sm ${color}`}
            style={{ height: `${heightPx}px` }}
          />
        );
      })}
    </div>
  );
}

function ReadinessCell({ row }: { row: AthleteRosterItem }) {
  const r = row.latestReadiness;
  if (!r) return <span className="text-muted text-sm">—</span>;

  const dotColor = r.score >= 8 ? "bg-emerald-500" : r.score >= 5 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
      <span className="text-sm font-semibold tabular-nums">{r.score.toFixed(1)}</span>
      <ReadinessBreakdown
        sleep={r.sleepQuality}
        soreness={r.soreness}
        stress={r.stressLevel}
        energy={r.energyMood}
      />
      <span className="sr-only">
        Sleep {r.sleepQuality} of 10, soreness {r.soreness} of 10, stress {r.stressLevel} of 10,
        energy {r.energyMood} of 10.
      </span>
    </div>
  );
}

function NextSessionCell({ row }: { row: AthleteRosterItem }) {
  if (!row.nextSession) {
    return <span className="text-muted text-sm">—</span>;
  }
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-[var(--foreground)] tabular-nums">
        {formatRelativeFuture(row.nextSession.scheduledDate)}
      </p>
      {row.nextSession.title && (
        <p className="text-xs text-muted truncate">{row.nextSession.title}</p>
      )}
    </div>
  );
}

function PRTrendCell({ row }: { row: AthleteRosterItem }) {
  if (row.prsLast30d === 0 && !row.lastPRDate) {
    return <span className="text-muted text-sm">—</span>;
  }
  if (row.prsLast30d > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-300">
        <TrendingUp size={14} strokeWidth={1.75} aria-hidden="true" />
        <span className="tabular-nums">{row.prsLast30d}</span>
        <span className="text-xs font-normal text-muted">in 30d</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
      <Trophy size={14} strokeWidth={1.75} aria-hidden="true" />
      <span>last PR {formatRelativeDate(row.lastPRDate)}</span>
    </span>
  );
}

function ActionCell() {
  return <ChevronRight size={18} strokeWidth={1.75} className="text-muted" aria-hidden="true" />;
}

/* ─── Last session / invite action cell ───────────────────────────────────── */

function LastSessionOrInviteCell({
  row,
  onSendInvite,
  onRevoke,
  busyId,
  copiedId,
}: {
  row: AthleteRosterItem;
  onSendInvite: (row: AthleteRosterItem) => void;
  onRevoke: (row: AthleteRosterItem) => void;
  busyId: string | null;
  copiedId: string | null;
}) {
  // Stop propagation so clicks here don't trigger the row-level navigation.
  const stop = (e: React.MouseEvent | React.KeyboardEvent) => e.stopPropagation();

  if (row.claimStatus === "PROXY") {
    return (
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          onSendInvite(row);
        }}
        onKeyDown={stop}
        disabled={busyId === row.id}
        className="text-xs font-semibold text-primary-600 dark:text-primary-300 hover:underline disabled:opacity-60 disabled:no-underline"
      >
        {busyId === row.id ? "Sending…" : copiedId === row.id ? "Link copied!" : "Send invite →"}
      </button>
    );
  }

  if (row.claimStatus === "INVITED") {
    return (
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          onRevoke(row);
        }}
        onKeyDown={stop}
        disabled={busyId === row.id}
        className="text-xs font-medium text-muted hover:text-red-600 dark:hover:text-red-400 disabled:opacity-60"
      >
        {busyId === row.id ? "Revoking…" : "Revoke invite"}
      </button>
    );
  }

  return (
    <span className="text-sm text-muted tabular-nums">
      {formatRelativeDate(row.lastSessionDate)}
    </span>
  );
}

/* ─── Table ──────────────────────────────────────────────────────────────── */

function getRowClassName(row: AthleteRosterItem): string | undefined {
  // Border accent matches attentionReason severity so the eye scans top-to-bottom
  // for the same signal the Attention column carries — DRY across visual channels.
  switch (row.attentionReason) {
    case "INJURED":
    case "LOW_READINESS":
      return "border-l-4 border-l-red-500";
    case "NO_CHECKIN":
    case "STALE_PLAN":
    case "NEEDS_REVIEW":
      return "border-l-4 border-l-amber-500";
    default:
      return undefined;
  }
}

export function AthletesTable({ data }: { data: AthleteRosterItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [logTestFor, setLogTestFor] = useState<AthleteRosterItem | null>(null);

  async function handleSendInvite(row: AthleteRosterItem) {
    setBusyId(row.id);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ mode: "link", athleteProfileId: row.id }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `Request failed (${res.status})`);
      }
      const link = `${window.location.origin}/athletes/claim/${payload.data.token}`;
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Invite link copied to clipboard");
        setCopiedId(row.id);
        setTimeout(() => setCopiedId(null), 3000);
      } catch {
        toast.info(`Invite created. Link: ${link}`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn’t create invite");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(row: AthleteRosterItem) {
    if (!row.pendingInvitationId) return;
    if (
      !confirm(`Revoke invite for ${row.firstName} ${row.lastName}? The link will stop working.`)
    ) {
      return;
    }
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/invitations/${row.pendingInvitationId}`, {
        method: "PATCH",
        headers: csrfHeaders(),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      toast.success("Invite revoked");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn’t revoke invite");
    } finally {
      setBusyId(null);
    }
  }

  // Column order matches the goal: athlete, event, readiness, last session,
  // next session, PR trend, attention needed, action. The mobile sideline
  // cards (rendered separately) cover the same ground with a different
  // information geometry — see _sideline-cards.tsx.
  const columns: Column<AthleteRosterItem>[] = [
    {
      key: "firstName",
      header: "Athlete",
      cell: (row) => <AthleteCell row={row} />,
      sortable: true,
    },
    {
      key: "events",
      header: "Event",
      cell: (row) => <EventsCell row={row} />,
    },
    {
      key: "latestReadiness",
      header: "Readiness",
      cell: (row) => <ReadinessCell row={row} />,
    },
    {
      key: "lastSessionDate",
      header: "Last session",
      cell: (row) => (
        <LastSessionOrInviteCell
          row={row}
          onSendInvite={handleSendInvite}
          onRevoke={handleRevoke}
          busyId={busyId}
          copiedId={copiedId}
        />
      ),
    },
    {
      key: "nextSession",
      header: "Next session",
      cell: (row) => <NextSessionCell row={row} />,
    },
    {
      key: "prsLast30d",
      header: "PR trend",
      cell: (row) => <PRTrendCell row={row} />,
      sortable: true,
    },
    {
      key: "attentionReason",
      header: "Attention",
      cell: (row) => <AttentionCell row={row} />,
    },
    {
      key: "logTest",
      header: "",
      cell: (row) =>
        row.claimStatus === "PROXY" ? null : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLogTestFor(row);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={`Log a performance test for ${row.firstName} ${row.lastName}`}
            title="Log performance test"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-muted hover:text-primary-500 hover:bg-primary-500/10 transition-colors"
          >
            <Timer size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        ),
      className: "w-10 text-right",
    },
    {
      key: "id",
      header: "",
      cell: () => <ActionCell />,
      className: "w-10 text-right",
    },
  ];

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        rowKey="id"
        searchable
        searchPlaceholder="Search by name…"
        pageSize={25}
        rowClassName={getRowClassName}
        onRowClick={(row) => router.push(`/coach/athletes/${row.id}`)}
        emptyTitle="No athletes match these filters"
        emptyDescription="Adjust the event, gender, class, or availability filters to broaden your roster."
      />
      <CoachTestCaptureSheet
        open={logTestFor != null}
        onClose={() => setLogTestFor(null)}
        athleteId={logTestFor?.id ?? ""}
        athleteName={logTestFor ? `${logTestFor.firstName} ${logTestFor.lastName}` : undefined}
      />
    </>
  );
}
