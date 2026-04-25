"use client";

import { Check, Loader2, WifiOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── SaveStatusChip ────────────────────────────────────────────────────────
   Compact status indicator for forms with draft persistence + outbox-on-
   network-failure. Three primary states + one auth-needed state:

     - "Saving..."   — submit in flight (caller-controlled `isSaving`)
     - "Saved"       — last submit succeeded (online, no pending in outbox)
     - "Saved locally" — offline OR items pending in outbox
     - "Sign in to sync" — auth expired, queue parked (rare path)

   Reads from useOutboxStatus()'s shape: `{ pending, isOnline, authNeeded }`.
   Designed to live in the form chrome (next to the submit button or in the
   top bar) and stay quiet — this is informational, not an action.

   Distinct from quick-log's ConnectionChip (which counts queued throws in a
   purpose-built display); this one is for the generic outbox + form drafts.
   ────────────────────────────────────────────────────────────────────────── */

export interface SaveStatusChipProps {
  /** True while a submit fetch is in flight. */
  isSaving: boolean;
  /** Number of items in the generic outbox awaiting replay. */
  pending: number;
  /** Browser online state. */
  isOnline: boolean;
  /** True if the outbox replay parked on a 401 — user must re-auth. */
  authNeeded?: boolean;
  className?: string;
}

export function SaveStatusChip({
  isSaving,
  pending,
  isOnline,
  authNeeded,
  className,
}: SaveStatusChipProps) {
  if (authNeeded) {
    return (
      <Chip className={className} tone="warning" Icon={AlertTriangle} aria-live="polite">
        Sign in to sync
      </Chip>
    );
  }

  if (isSaving) {
    return (
      <Chip className={className} tone="muted" Icon={Loader2} spin aria-live="polite">
        Saving…
      </Chip>
    );
  }

  if (!isOnline || pending > 0) {
    const label =
      pending > 0
        ? pending === 1
          ? "Saved locally · 1 pending"
          : `Saved locally · ${pending} pending`
        : "Offline";
    return (
      <Chip className={className} tone="warning" Icon={WifiOff} aria-live="polite">
        {label}
      </Chip>
    );
  }

  return (
    <Chip className={className} tone="success" Icon={Check} aria-live="polite">
      Saved
    </Chip>
  );
}

interface ChipProps {
  children: React.ReactNode;
  Icon: typeof Check;
  tone: "success" | "muted" | "warning";
  spin?: boolean;
  className?: string;
  "aria-live"?: "polite" | "assertive";
}

function Chip({ children, Icon, tone, spin, className, ...rest }: ChipProps) {
  const toneClasses =
    tone === "success"
      ? "text-[var(--color-status-success-fg)] bg-[var(--color-status-success-bg)]"
      : tone === "warning"
        ? "text-[var(--color-status-warning-fg)] bg-[var(--color-status-warning-bg)]"
        : "text-[var(--muted)] bg-surface-100 dark:bg-surface-800";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        toneClasses,
        className
      )}
      {...rest}
    >
      <Icon
        size={12}
        strokeWidth={2}
        aria-hidden="true"
        className={spin ? "animate-spin" : undefined}
      />
      {children}
    </span>
  );
}
