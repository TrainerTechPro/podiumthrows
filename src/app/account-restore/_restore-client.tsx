"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";

interface Props {
  role: "COACH" | "ATHLETE";
}

export function RestoreClient({ role }: Props) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleRestore() {
    setLoading(true);
    try {
      const res = await fetch("/api/me/restore", {
        method: "POST",
        headers: csrfHeaders(),
      });
      const payload = (await res.json().catch(() => null)) as {
        success: boolean;
        error?: string;
      } | null;

      if (!res.ok || !payload?.success) {
        toast.error(payload?.error || "Could not restore account");
        setLoading(false);
        return;
      }

      toast.success("Welcome back");
      window.location.assign(role === "COACH" ? "/coach/dashboard" : "/athlete/dashboard");
    } catch {
      toast.error("Network error — try again in a moment");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleRestore} loading={loading} variant="primary" className="w-full">
        Restore my account
      </Button>
      <p className="text-xs text-muted text-center">
        Or close this tab — your account will be deleted automatically when the grace window ends.
      </p>
    </div>
  );
}
