"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { StuckSession } from "@/lib/data/training-hub";

/* ─── Stuck Sessions ────────────────────────────────────────────────────────
   Fix for tester feedback 2026-04-10 ("shows 4 active with no way to finish
   them"). Renders IN_PROGRESS rows across all three session models with an
   End action that hits the right endpoint per row.
   ──────────────────────────────────────────────────────────────────────── */

const DAY_FMT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};

function formatDate(ymd: string): string {
  return new Date(ymd + "T12:00:00").toLocaleDateString("en-US", DAY_FMT);
}

/** Maps the session kind to the End endpoint. */
function endEndpointFor(s: StuckSession): { url: string; init: RequestInit } {
  if (s.kind === "assignment") {
    return {
      url: `/api/throws/assignments/${s.id}`,
      init: {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ action: "end" }),
      },
    };
  }
  if (s.kind === "training-session") {
    return {
      url: `/api/athlete/sessions/${s.id}/end`,
      init: {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({}),
      },
    };
  }
  // program-session — configId is always present for athlete-endable rows
  // (coach-programmed ProgramSessions are filtered out in the data fetcher).
  return {
    url: `/api/athlete/self-program/${s.selfProgramConfigId}/session/${s.id}/end`,
    init: {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({}),
    },
  };
}

export function StuckSessions({ sessions }: { sessions: StuckSession[] }) {
  const router = useRouter();
  const toast = useToast();
  const [endingId, setEndingId] = useState<string | null>(null);

  if (sessions.length === 0) return null;

  async function handleEnd(s: StuckSession) {
    if (endingId) return; // precondition: one at a time
    setEndingId(s.id);
    try {
      const { url, init } = endEndpointFor(s);
      const res = await fetch(url, init);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) {
        const msg = payload.error || `Failed to end session (${res.status})`;
        toast.error(msg);
        return;
      }
      toast.success("Session ended");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error — please try again");
    } finally {
      setEndingId(null);
    }
  }

  return (
    <section className="space-y-2" aria-labelledby="stuck-sessions-heading">
      <div className="flex items-baseline justify-between">
        <h2
          id="stuck-sessions-heading"
          className="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5"
        >
          <AlertCircle
            size={14}
            strokeWidth={1.75}
            className="text-[var(--color-status-warning-fg)]"
            aria-hidden="true"
          />
          In progress
        </h2>
        <span className="text-[11px] text-muted tabular-nums">{sessions.length}</span>
      </div>

      <div className="card divide-y divide-[var(--card-border)] overflow-hidden">
        {sessions.map((s) => {
          const isEnding = endingId === s.id;
          return (
            <div
              key={`${s.kind}-${s.id}`}
              className="flex items-center gap-2 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
            >
              <Link href={s.href} className="flex-1 min-w-0 flex items-center gap-3 -m-3 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">{s.name}</p>
                  <p className="text-xs text-muted">
                    {formatDate(s.date)} · {s.sessionType}
                  </p>
                </div>
                <ChevronRight
                  size={14}
                  strokeWidth={1.75}
                  className="text-muted shrink-0"
                  aria-hidden="true"
                />
              </Link>
              <OverflowMenu
                ariaLabel={`${s.name} actions`}
                items={[
                  {
                    label: isEnding ? "Ending…" : "End session",
                    icon: <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true" />,
                    onSelect: () => handleEnd(s),
                    disabled: isEnding,
                  },
                ]}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
