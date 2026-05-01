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

export function MigrationBanner({ athleteId }: { athleteId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/athletes/${athleteId}/migration-status`, { credentials: "same-origin" })
      .then(async (res) => {
        const payload = (await res.json()) as MigrationStatusOk | MigrationStatusErr;
        if (cancelled) return;
        if (!res.ok || !payload.success) return;
        setCount(payload.data.totalUnassigned);
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error("MigrationBanner fetch failed", {
          context: "components/throws/MigrationBanner",
          error: err,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  if (count == null || count === 0) return null;

  return (
    <Link
      href="/athlete/settings/fix-throw-history"
      className="mx-4 sm:mx-6 my-3 flex items-center gap-3 rounded-xl border border-primary-500/40 bg-primary-500/5 px-4 py-3 transition-colors hover:bg-primary-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
    >
      <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500/15 text-primary-600 dark:text-primary-400">
        <Wrench size={18} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {count} throw{count === 1 ? "" : "s"} need an implement assigned
        </p>
        <p className="text-xs text-muted mt-0.5">
          Confirm the catalog match so PRs use the right label.
        </p>
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
