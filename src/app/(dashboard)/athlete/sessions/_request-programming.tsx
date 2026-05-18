"use client";

import { useState } from "react";
import { Send, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { csrfHeaders } from "@/lib/csrf-client";
import { reportApiError } from "@/lib/form-errors";
import { logger } from "@/lib/logger";

const COOLDOWN_MS = 48 * 60 * 60 * 1000;

interface RequestProgrammingProps {
  lastRequestDate: string | null; // ISO date
  coachName: string;
  variant: "cold-start" | "between";
}

export function RequestProgramming({
  lastRequestDate,
  coachName,
  variant,
}: RequestProgrammingProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(() => {
    if (!lastRequestDate) return null;
    const until = new Date(new Date(lastRequestDate).getTime() + COOLDOWN_MS);
    return until.getTime() > Date.now() ? until.toISOString() : null;
  });

  const isOnCooldown = cooldownUntil != null && new Date(cooldownUntil).getTime() > Date.now();

  async function handleRequest() {
    setLoading(true);
    try {
      const res = await fetch("/api/athlete/request-programming", {
        method: "POST",
        headers: csrfHeaders(),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        setCooldownUntil(data.data?.cooldownUntil ?? null);
        toast.success(
          "Request sent!",
          `${coachName} has been notified with your training context.`
        );
        return;
      }

      // 429 with cooldown is expected, not an error — surface as info.
      if (res.status === 429 && data?.cooldownUntil) {
        setCooldownUntil(data.cooldownUntil);
        toast.warning(
          "Already requested",
          "Your coach was already notified. Please wait before requesting again."
        );
        return;
      }

      reportApiError({ res, payload: data }, toast, { onRetry: handleRequest });
    } catch (err) {
      logger.error("request-programming failed", {
        context: "athlete/sessions/request-programming",
        error: err,
      });
      reportApiError({ err }, toast, { onRetry: handleRequest });
    } finally {
      setLoading(false);
    }
  }

  const requestedDate = cooldownUntil
    ? new Date(new Date(cooldownUntil).getTime() - COOLDOWN_MS).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      className={cn(
        "card p-5 border-l-4",
        isOnCooldown ? "border-l-emerald-500/50" : "border-l-primary-500/50"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            isOnCooldown
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-primary-500/10 text-primary-500"
          )}
        >
          {isOnCooldown ? (
            <CheckCircle2 size={20} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Send size={20} strokeWidth={1.75} aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {isOnCooldown ? (
            <>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Request sent</h3>
              <p className="text-xs text-muted mt-1">
                {coachName} was notified on {requestedDate}. They&apos;ll program your next sessions
                soon.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {variant === "cold-start"
                  ? "Let your coach know you're ready to start training"
                  : "Your coach hasn't scheduled your next sessions yet"}
              </h3>
              <p className="text-xs text-muted mt-1">
                {variant === "cold-start"
                  ? `Send ${coachName} your profile data so they can build your first program.`
                  : `Request programming from ${coachName} — they'll receive your readiness, PRs, and goals to build your next sessions.`}
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-3"
                onClick={handleRequest}
                disabled={loading}
                leftIcon={
                  loading ? (
                    <Clock
                      size={14}
                      strokeWidth={1.75}
                      aria-hidden="true"
                      className="animate-spin"
                    />
                  ) : (
                    <Send size={14} strokeWidth={1.75} aria-hidden="true" />
                  )
                }
              >
                {loading ? "Sending..." : "Request Programming"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
