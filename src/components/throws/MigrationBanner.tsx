"use client";

/**
 * Dashboard banner that surfaces the Fix Old Throws workflow when the
 * athlete still has un-assigned throws after the catalog backfill.
 *
 * Renders nothing when totalUnassigned === 0 — self-hides post-migration.
 * Re-runs the fetch on mount of every dashboard render (force-dynamic +
 * router.refresh keeps it fresh).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Wrench } from "lucide-react";
import { logger } from "@/lib/logger";

interface MigrationStatusOk {
  success: true;
  data: { totalUnassigned: number; totalAmbiguous: number };
}
interface MigrationStatusErr {
  success: false;
  error: string;
}

export interface MigrationBannerProps {
  athleteId: string;
  /** Where the banner links to. Default: athlete-self Fix page. Coach
   *  surfaces should pass `/coach/athletes/${id}/fix-throws`. */
  href?: string;
  /** When set, the headline switches to the coach-on-behalf voice
   *  ("Riley has 5 throws…"). Omit for the athlete-self default
   *  ("5 throws need an implement assigned"). String-only so the prop
   *  serializes across the Server→Client boundary. */
  athleteFirstName?: string;
  description?: string;
}

export function MigrationBanner({
  athleteId,
  href = "/athlete/settings/fix-throw-history",
  athleteFirstName,
  description = "Confirm the catalog match so PRs use the right label.",
}: MigrationBannerProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/athletes/${athleteId}/migration-status`, {
      credentials: "same-origin",
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const payload = (await res.json()) as MigrationStatusOk | MigrationStatusErr;
        if (ctrl.signal.aborted) return;
        if (!res.ok || !payload.success) return;
        setCount(payload.data.totalUnassigned);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        // Network-level fetch failure during navigation — see PerformanceTestsTile.
        if (err instanceof TypeError) return;
        logger.error("MigrationBanner fetch failed", {
          context: "components/throws/MigrationBanner",
          error: err,
        });
      });
    return () => ctrl.abort();
  }, [athleteId]);

  if (count == null || count === 0) return null;

  const plural = count === 1 ? "" : "s";
  const headline = athleteFirstName
    ? `${athleteFirstName} has ${count} throw${plural} that need an implement assigned`
    : `${count} throw${plural} need an implement assigned`;

  return (
    <Link
      href={href}
      className="mx-4 sm:mx-6 my-3 flex items-center gap-3 rounded-xl border border-primary-500/40 bg-primary-500/5 px-4 py-3 transition-colors hover:bg-primary-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
    >
      <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500/15 text-primary-600 dark:text-primary-400">
        <Wrench size={18} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)]">{headline}</p>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
      <ChevronRight
        size={18}
        strokeWidth={1.75}
        className="shrink-0 text-muted"
        aria-hidden="true"
      />
    </Link>
  );
}
