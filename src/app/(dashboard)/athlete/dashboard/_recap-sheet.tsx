"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Trophy, Flame, Activity, Loader2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { logger } from "@/lib/logger";

type RecapPayload = {
  weekStart: string;
  weekEnd: string;
  sessionsLogged: number;
  sessionsScheduled: number;
  throwsLogged: number;
  avgIntensity: number | null;
  prs: { event: string; implement: string; distance: number }[];
  streakEnd: number;
  streakDelta: number;
  readinessAvg: number | null;
  shoutout: string;
  nextWeekPreview: { sessionsCount: number; keyDate: string | null };
};

function eventLabel(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRange(startISO: string, endISO: string): string {
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
}

/**
 * Mounts on /athlete/dashboard. When `?recap=YYYY-MM-DD` is present (or
 * `recap=latest` from the in-app notification fallback), fetches the
 * preview for that week and pops the recap sheet. Closing the sheet
 * strips the query param so refresh doesn't reopen the same recap.
 */
export function RecapSheet() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recapParam = searchParams.get("recap");

  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RecapPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recapParam) {
      setOpen(false);
      return;
    }

    let cancelled = false;
    setOpen(true);
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (recapParam !== "latest") params.set("week", recapParam);

    fetch(`/api/recap/preview?${params.toString()}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !payload.success) {
          setError(payload.error || `Couldn't load recap (${res.status})`);
          return;
        }
        setData(payload.data as RecapPayload);
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error("recap preview fetch failed", {
          context: "athlete/dashboard/recap-sheet",
          error: err,
        });
        setError("Network error — try again");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [recapParam]);

  function dismiss() {
    setOpen(false);
    // Strip the recap param so a refresh doesn't reopen the sheet.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("recap");
    const qs = next.toString();
    router.replace(qs ? `/athlete/dashboard?${qs}` : "/athlete/dashboard");
  }

  if (!recapParam) return null;

  return (
    <Sheet
      open={open}
      onClose={dismiss}
      side="bottom"
      size="lg"
      title="Your week"
      description={data ? formatRange(data.weekStart, data.weekEnd) : "Loading…"}
    >
      {loading && !data ? (
        <div className="py-12 flex items-center justify-center text-sm text-muted">
          <Loader2 className="animate-spin mr-2" size={16} strokeWidth={1.75} aria-hidden="true" />
          Pulling your numbers…
        </div>
      ) : error ? (
        <p className="py-8 text-sm text-danger-500">{error}</p>
      ) : data ? (
        <div className="space-y-5">
          {/* Hero number */}
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-500/80">
              {data.prs.length > 0
                ? "New PR"
                : data.streakEnd > 0
                  ? "Current streak"
                  : "Sessions logged"}
            </p>
            <p
              className="font-heading text-4xl font-bold text-amber-400 mt-1 tabular-nums"
              style={{ letterSpacing: "-0.5px" }}
            >
              {data.prs.length > 0
                ? `${data.prs[0].distance.toFixed(2)}m`
                : data.streakEnd > 0
                  ? `${data.streakEnd} days`
                  : data.sessionsLogged}
            </p>
            <p className="text-sm text-amber-200/80 mt-1.5 italic leading-snug">{data.shoutout}</p>
          </div>

          {/* Stats grid */}
          <dl className="grid grid-cols-2 gap-3">
            <Stat
              icon={<Activity size={14} strokeWidth={1.75} aria-hidden="true" />}
              label="Sessions"
            >
              {data.sessionsLogged}
              {data.sessionsScheduled > 0 && (
                <span className="text-sm text-muted ml-1">/ {data.sessionsScheduled}</span>
              )}
            </Stat>
            <Stat icon={<Trophy size={14} strokeWidth={1.75} aria-hidden="true" />} label="Throws">
              {data.throwsLogged}
            </Stat>
            <Stat icon={<Flame size={14} strokeWidth={1.75} aria-hidden="true" />} label="Streak">
              {data.streakEnd}d
              {data.streakDelta > 0 && (
                <span className="text-sm text-success-500 ml-1">+{data.streakDelta}</span>
              )}
            </Stat>
            <Stat
              icon={<Activity size={14} strokeWidth={1.75} aria-hidden="true" />}
              label="Readiness"
            >
              {data.readinessAvg !== null ? data.readinessAvg.toFixed(1) : "—"}
              <span className="text-sm text-muted ml-0.5">/10</span>
            </Stat>
          </dl>

          {/* PR list */}
          {data.prs.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Personal bests this week
              </h3>
              <ul className="space-y-1">
                {data.prs.map((pr) => (
                  <li
                    key={`${pr.event}-${pr.implement}`}
                    className="flex items-baseline justify-between text-sm"
                  >
                    <span className="text-[var(--foreground)]">
                      {eventLabel(pr.event)} <span className="text-muted">({pr.implement})</span>
                    </span>
                    <span className="font-semibold text-amber-500 tabular-nums">
                      {pr.distance.toFixed(2)}m
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Next week */}
          <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-4">
            <p className="text-xs uppercase tracking-wider text-muted mb-1">Next week</p>
            <p className="text-sm text-[var(--foreground)]">
              {data.nextWeekPreview.sessionsCount > 0
                ? `${data.nextWeekPreview.sessionsCount} session${data.nextWeekPreview.sessionsCount === 1 ? "" : "s"} on the board.`
                : "Nothing scheduled yet — log one Monday to start strong."}
            </p>
          </div>

          <Link
            href="/athlete/throws/trends"
            onClick={dismiss}
            className="block text-center rounded-xl bg-amber-500 text-surface-950 font-semibold py-3 text-sm active:scale-[0.97] transition-transform"
          >
            See full trends
          </Link>
        </div>
      ) : null}
    </Sheet>
  );
}

function Stat({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] p-3">
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-heading text-2xl font-bold text-[var(--foreground)] tabular-nums">
        {children}
      </dd>
    </div>
  );
}
