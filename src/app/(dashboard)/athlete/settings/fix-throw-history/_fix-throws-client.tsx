"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertCircle, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ImplementPicker, type ImplementCatalogRow } from "@/components/throws/ImplementPicker";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

interface FixGroup {
  event: string;
  weightKg: number;
  unit: string;
  original: number | null;
  throwCount: number;
  bestGuessImplementId: string | null;
  bestGuessLabel: string | null;
  bestGuessKind: "exact" | "tolerated" | "ambiguous" | "none";
  candidates: Array<{ id: string; label: string; primaryUnit: string }>;
}

interface MigrationStatusOk {
  success: true;
  data: {
    totalUnassigned: number;
    totalAmbiguous: number;
    groups: FixGroup[];
  };
}
interface MigrationStatusErr {
  success: false;
  error: string;
}

interface RelabelOk {
  success: true;
  data: { updated: number };
}
interface RelabelErr {
  success: false;
  error: string;
}

const EVENT_LABEL: Record<string, string> = {
  SHOT_PUT: "Shot put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

function formatGroupWeight(g: FixGroup): string {
  if (g.unit === "lbs" || g.unit === "lb") {
    if (g.original != null) return `${g.original} lb`;
    return `${g.weightKg.toFixed(2)} kg`;
  }
  return `${g.weightKg} kg`;
}

export function FixThrowHistoryClient({
  athleteId,
  backHref = "/athlete/settings",
  backLabel = "Back to settings",
  title = "Fix throw history",
  intro = "Older throws were stored with raw kg values, losing the original unit. Confirm the catalog match for each group below so PRs use the right label.",
}: {
  athleteId: string;
  backHref?: string;
  backLabel?: string;
  title?: string;
  intro?: string;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<MigrationStatusOk["data"] | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<FixGroup | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/athletes/${athleteId}/migration-status`, {
        credentials: "same-origin",
      });
      const payload = (await res.json()) as MigrationStatusOk | MigrationStatusErr;
      if (!res.ok || !payload.success) {
        setErrorMsg(payload.success ? `Failed (${res.status})` : payload.error);
        setStatus("error");
        return;
      }
      setData(payload.data);
      setStatus("ready");
    } catch (err) {
      logger.error("Fix page status fetch failed", {
        context: "athlete/settings/fix-throw-history",
        error: err,
      });
      setErrorMsg(err instanceof Error ? err.message : "Network error — please try again");
      setStatus("error");
    }
  }, [athleteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAssign = useCallback(
    async (group: FixGroup, implementId: string, label: string) => {
      const key = `${group.event}|${group.weightKg}`;
      setBusyKey(key);
      try {
        const res = await fetch(`/api/throws/relabel-by-weight`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...csrfHeaders(),
          },
          credentials: "same-origin",
          body: JSON.stringify({
            athleteId,
            fromWeightKg: group.weightKg,
            toImplementId: implementId,
          }),
        });
        const payload = (await res.json()) as RelabelOk | RelabelErr;
        if (!res.ok || !payload.success) {
          toast.error(payload.success ? `Failed (${res.status})` : payload.error);
          return;
        }
        toast.success(
          `${payload.data.updated} throw${payload.data.updated === 1 ? "" : "s"} relabeled to ${label}`
        );
        await refresh();
      } catch (err) {
        logger.error("Fix page assign failed", {
          context: "athlete/settings/fix-throw-history",
          error: err,
        });
        toast.error(err instanceof Error ? err.message : "Network error — please try again");
      } finally {
        setBusyKey(null);
      }
    },
    [athleteId, refresh, toast]
  );

  const handlePickerSelect = useCallback(
    (row: ImplementCatalogRow) => {
      if (!pickerFor) return;
      void handleAssign(pickerFor, row.id, row.displayLabel);
      setPickerFor(null);
    },
    [pickerFor, handleAssign]
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          {backLabel}
        </Link>
        <h1 className="font-heading text-2xl font-semibold text-[var(--foreground)] mt-2">
          {title}
        </h1>
        <p className="text-sm text-muted mt-1 max-w-prose">{intro}</p>
      </div>

      {status === "loading" && (
        <div className="space-y-2" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 w-full rounded-xl bg-surface-200/60 dark:bg-surface-800/60 shimmer"
            />
          ))}
        </div>
      )}

      {status === "error" && errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/40 bg-danger-500/5 px-4 py-3 text-sm text-danger-600 dark:text-danger-400"
        >
          {errorMsg}
        </div>
      )}

      {status === "ready" && data && (
        <>
          {data.totalUnassigned === 0 ? (
            <div className="card flex flex-col items-center text-center py-10 px-6 gap-3">
              <div className="w-11 h-11 rounded-xl bg-success-500/10 flex items-center justify-center">
                <CheckCircle2
                  size={20}
                  strokeWidth={1.75}
                  className="text-success-500"
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--foreground)]">
                  All throws assigned
                </p>
                <p className="text-sm text-muted mt-1">Nothing here needs your attention.</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                {data.totalUnassigned} throws across {data.groups.length} group
                {data.groups.length === 1 ? "" : "s"}
              </p>

              <div className="space-y-2">
                {data.groups.map((group) => {
                  const key = `${group.event}|${group.weightKg}`;
                  const busy = busyKey === key;
                  const isAuto =
                    group.bestGuessKind === "exact" || group.bestGuessKind === "tolerated";
                  return (
                    <div
                      key={key}
                      className={cn("card px-4 py-3 flex items-center gap-3", busy && "opacity-60")}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {EVENT_LABEL[group.event] ?? group.event} ·{" "}
                          <span className="font-mono tabular-nums">{formatGroupWeight(group)}</span>{" "}
                          ·{" "}
                          <span className="text-muted font-normal">
                            {group.throwCount} throw{group.throwCount === 1 ? "" : "s"}
                          </span>
                        </p>
                        <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
                          {isAuto ? (
                            <>
                              Best guess:{" "}
                              <span className="font-mono tabular-nums text-[var(--foreground)]">
                                {group.bestGuessLabel}
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertCircle
                                size={12}
                                strokeWidth={1.75}
                                aria-hidden="true"
                                className="text-warning-500"
                              />
                              {group.bestGuessKind === "ambiguous"
                                ? `Ambiguous (${group.candidates.length} matches)`
                                : "No catalog match"}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAuto && group.bestGuessImplementId && group.bestGuessLabel && (
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={busy}
                            onClick={() =>
                              handleAssign(
                                group,
                                group.bestGuessImplementId!,
                                group.bestGuessLabel!
                              )
                            }
                          >
                            Confirm
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          leftIcon={<MoreHorizontal size={14} strokeWidth={1.75} />}
                          onClick={() => setPickerFor(group)}
                        >
                          Pick
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      <ImplementPicker
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        athleteId={athleteId}
        side="bottom"
        onSelect={handlePickerSelect}
        title={
          pickerFor
            ? `Pick implement for ${EVENT_LABEL[pickerFor.event] ?? pickerFor.event} ${formatGroupWeight(pickerFor)}`
            : "Pick implement"
        }
      />
    </div>
  );
}
