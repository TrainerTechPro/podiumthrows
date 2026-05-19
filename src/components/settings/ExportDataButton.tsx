"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/**
 * Triggers GET /api/me/export and saves the response as a JSON file.
 * Two feedback channels per CLAUDE.md §Code Quality rule 7: the button's
 * loading spinner during the request, and a toast on completion.
 */
export function ExportDataButton() {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/me/export");
      const isJson = res.headers.get("content-type")?.includes("application/json");

      if (!res.ok) {
        const message = isJson
          ? ((await res.json()) as { error?: string }).error ||
            "We couldn't prepare your export. Try again in a moment — if the issue continues, email support."
          : "We couldn't prepare your export. Try again in a moment — if the issue continues, email support.";
        toast.error(message);
        return;
      }

      const blob = await res.blob();
      const filename =
        res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        "podium-export.json";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Your data is downloading");
    } catch {
      toast.error("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleClick}
      loading={loading}
      variant="secondary"
      leftIcon={<Download size={16} strokeWidth={1.75} aria-hidden="true" />}
    >
      Download my data
    </Button>
  );
}
