"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components";
import { Play, SkipForward } from "lucide-react";
import { useToast } from "@/components/toast";
import { csrfHeaders } from "@/lib/csrf-client";

interface AssignmentActionsProps {
  assignmentId: string;
  canStart: boolean;
  isInProgress: boolean;
}

export function AssignmentActions({
  assignmentId,
  canStart,
  isInProgress,
}: AssignmentActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(action: "start" | "skip") {
    setLoading(action);
    try {
      const res = await fetch(`/api/throws/assignments/${assignmentId}`, {
        method: "PUT",
        // Explicit Content-Type so middleware + server parsers pick up the
        // body correctly; previously only csrfHeaders() was spread.
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        toast(data?.error || `Something went wrong (${res.status})`, "error");
        return;
      }

      if (action === "start") {
        toast("Workout started!", "success");
        router.push(`/athlete/throws/${assignmentId}?view=live`);
      } else {
        toast("Session skipped", "info");
        router.push("/athlete/dashboard");
      }
    } catch (err) {
      console.error("assignment action failed", err);
      toast(err instanceof Error ? err.message : "Network error", "error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {(canStart || isInProgress) && (
        <Button
          variant="primary"
          className="flex-1"
          onClick={() => handleAction("start")}
          disabled={loading !== null}
          leftIcon={<Play size={16} strokeWidth={1.75} aria-hidden="true" />}
        >
          {isInProgress ? "Continue Workout" : "Start Live Workout"}
        </Button>
      )}
      {!isInProgress && (
        <Button
          variant="ghost"
          className="flex-1 sm:flex-none"
          onClick={() => handleAction("skip")}
          disabled={loading !== null}
          leftIcon={<SkipForward size={16} strokeWidth={1.75} aria-hidden="true" />}
        >
          Skip Session
        </Button>
      )}
    </div>
  );
}
