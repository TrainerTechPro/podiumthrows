"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, XCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export type BlockedAthleteRow = {
  athleteId: string;
  athleteName: string;
  tier: "expired" | "never";
  days: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  blocked: BlockedAthleteRow[];
  /** Called when the coach acknowledges the override. Receives an optional reason. */
  onOverride: (reason: string) => void | Promise<void>;
  /** Loading indicator while the override is applied. */
  loading?: boolean;
}

export function AssessmentOverrideDialog({
  open,
  onClose,
  blocked,
  onOverride,
  loading = false,
}: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");

  // "never"-tier athletes cannot be overridden — must assess first.
  const hasNever = blocked.some((b) => b.tier === "never");
  const expiredCount = blocked.filter((b) => b.tier === "expired").length;
  const neverCount = blocked.filter((b) => b.tier === "never").length;
  const overrideDisabled = hasNever || loading;

  // If any athlete has never been assessed, send coach to the first such assessment page.
  const scheduleTarget = blocked.find((b) => b.tier === "never") ?? blocked[0];

  function handleScheduleRetest() {
    if (!scheduleTarget) return;
    router.push(`/coach/throws/assessment/${scheduleTarget.athleteId}`);
    onClose();
  }

  async function handleOverride() {
    if (overrideDisabled) return;
    await onOverride(reason.trim());
  }

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      preventClose={loading}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <AlertTriangle
            size={18}
            strokeWidth={1.75}
            className="text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <span>Bondarchuk assessment needed</span>
        </span>
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={handleScheduleRetest} disabled={loading}>
            Schedule {hasNever ? "assessment" : "re-test"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOverride}
            disabled={overrideDisabled}
            loading={loading}
            title={hasNever ? "Cannot override when an athlete has never been assessed" : undefined}
          >
            Override this session
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--foreground)]">
          Exercise recommendations depend on each athlete&rsquo;s Bondarchuk type classification.
          Stale classifications produce confident but wrong recommendations.
        </p>

        {expiredCount > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              Expired ({expiredCount})
            </p>
            <ul className="space-y-1">
              {blocked
                .filter((b) => b.tier === "expired")
                .map((b) => (
                  <li
                    key={b.athleteId}
                    className="flex items-center gap-2 text-sm text-[var(--foreground)]"
                  >
                    <AlertTriangle
                      size={14}
                      strokeWidth={1.75}
                      className="text-amber-600 dark:text-amber-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="flex-1">{b.athleteName}</span>
                    <span className="text-xs text-muted font-mono tabular-nums">{b.days}d ago</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {neverCount > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
              Never assessed ({neverCount}) &mdash; must assess before assigning
            </p>
            <ul className="space-y-1">
              {blocked
                .filter((b) => b.tier === "never")
                .map((b) => (
                  <li
                    key={b.athleteId}
                    className="flex items-center gap-2 text-sm text-[var(--foreground)]"
                  >
                    <XCircle
                      size={14}
                      strokeWidth={1.75}
                      className="text-red-600 dark:text-red-400 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="flex-1">{b.athleteName}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {!hasNever && (
          <label className="block">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Reason (optional)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              maxLength={500}
              rows={2}
              placeholder="e.g. re-test scheduled next week, proceeding with prior classification"
              className="mt-1 w-full text-sm rounded-lg bg-[var(--muted-bg)] border border-[var(--card-border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
        )}
      </div>
    </Modal>
  );
}
