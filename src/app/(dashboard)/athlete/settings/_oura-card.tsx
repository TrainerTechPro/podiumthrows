"use client";

import { useState, useEffect } from "react";
import { Circle, RefreshCw, Unlink, AlertTriangle } from "lucide-react";
import { Button, Badge, ConfirmDialog } from "@/components";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import { cn } from "@/lib/utils";

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface OuraCardProps {
  connected: boolean;
  syncMode?: string;
  lastSyncAt?: string | null;
  needsReauth?: boolean;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function OuraCard({ connected, syncMode: initialSyncMode, lastSyncAt, needsReauth: initialNeedsReauth }: OuraCardProps) {
  const { success, error: toastError, warning } = useToast();
  const [syncMode, setSyncMode] = useState(initialSyncMode ?? "ASSISTED");
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastSync, setLastSync] = useState(lastSyncAt ?? null);
  const [needsReauth, setNeedsReauth] = useState(initialNeedsReauth ?? false);

  // Show toast on initial mount if ?oura=connected was handled by parent
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("oura") === "connected") {
      setNeedsReauth(false);
      success("Oura Ring Connected", "Your Oura Ring is now linked to your account.");
    } else if (params.get("oura") === "error") {
      const reason = params.get("reason") || "unknown";
      toastError("Oura Ring Connection Failed", `Error: ${reason.replace(/_/g, " ")}`);
    }
    // Clean up query params without a reload
    if (params.has("oura")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("oura");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Handlers ─────────────────────────────────────────── */

  async function handleSyncModeChange(mode: "AUTO" | "ASSISTED") {
    if (mode === syncMode) return;
    const prev = syncMode;
    setSyncMode(mode);
    try {
      const res = await fetch("/api/oura/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ updateSyncMode: mode }),
      });
      if (!res.ok) {
        setSyncMode(prev);
        toastError("Failed to update sync mode");
      }
    } catch {
      setSyncMode(prev);
      toastError("Failed to update sync mode");
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/oura/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
      });
      if (res.ok) {
        setLastSync(new Date().toISOString());
        setNeedsReauth(false);
        success("Oura Ring Synced", "Your latest data has been imported.");
      } else {
        const data = await res.json().catch(() => null);
        if (data?.error === "reauth_required") {
          setNeedsReauth(true);
          warning("Oura Ring Reconnection Needed", "Your authorization has expired. Tap Reconnect to fix this.");
        } else {
          toastError("Sync failed", data?.detail ?? "Please try again in a moment.");
        }
      }
    } catch {
      toastError("Sync failed", "Network error. Check your connection.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/oura/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
      });
      if (res.ok) {
        success("Oura Ring Disconnected", "Your Oura Ring integration has been removed.");
        window.location.reload();
      } else {
        toastError("Failed to disconnect");
      }
    } catch {
      toastError("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  /* ── Disconnected State ───────────────────────────────── */

  if (!connected) {
    return (
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Circle size={20} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
          <h3 className="font-heading font-semibold text-[var(--foreground)]">Oura Ring Integration</h3>
        </div>
        <p className="text-sm text-muted leading-relaxed">
          Connect your Oura Ring to automatically sync readiness, sleep, and HRV data with your
          readiness check-ins.
        </p>
        <Button
          variant="primary"
          onClick={() => {
            window.location.href = "/api/oura/authorize";
          }}
        >
          Connect Oura Ring
        </Button>
      </div>
    );
  }

  /* ── Connected State ──────────────────────────────────── */

  return (
    <>
      <div className="card p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Circle size={20} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
            <h3 className="font-heading font-semibold text-[var(--foreground)]">
              Oura Ring Integration
            </h3>
          </div>
          {needsReauth ? (
            <Badge variant="warning" dot>
              Needs Reconnection
            </Badge>
          ) : (
            <Badge variant="success" dot>
              Connected
            </Badge>
          )}
        </div>

        {/* Last sync */}
        {lastSync && !needsReauth && <p className="text-xs text-muted">Last synced {relativeTime(lastSync)}</p>}

        {/* Reauth banner */}
        {needsReauth && (
          <div className="rounded-lg bg-warning-500/10 border border-warning-500/30 p-3 flex items-start gap-3">
            <AlertTriangle size={16} strokeWidth={1.75} className="text-warning-500 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)]">Authorization expired</p>
              <p className="text-xs text-muted mt-0.5">
                Your Oura Ring connection needs to be re-authorized. This takes about 10 seconds.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-2"
                onClick={() => { window.location.href = "/api/oura/authorize"; }}
              >
                Reconnect Oura Ring
              </Button>
            </div>
          </div>
        )}

        {/* Sync mode toggle */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Sync Mode</p>
          <div className="bg-[var(--muted-bg)] p-1 rounded-xl flex gap-1">
            {(
              [
                { value: "AUTO", label: "Auto", desc: "Automatic daily check-ins" },
                { value: "ASSISTED", label: "Assisted", desc: "Pre-fills your check-in" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSyncModeChange(opt.value)}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200",
                  syncMode === opt.value
                    ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-card"
                    : "text-muted hover:text-[var(--foreground)]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            {syncMode === "AUTO"
              ? "Oura Ring data automatically creates your daily readiness check-in."
              : "Oura Ring data pre-fills your check-in form for you to review and submit."}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            loading={syncing}
            leftIcon={<RefreshCw size={14} strokeWidth={1.75} aria-hidden="true" />}
            onClick={handleSync}
          >
            Sync Now
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger-500"
            loading={disconnecting}
            leftIcon={<Unlink size={14} strokeWidth={1.75} aria-hidden="true" />}
            onClick={() => setConfirmOpen(true)}
          >
            Disconnect
          </Button>
        </div>
      </div>

      {/* Confirm disconnect dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDisconnect}
        title="Disconnect Oura Ring?"
        description="This will remove the Oura Ring integration from your account. Your existing readiness data will be preserved, but new syncs will stop."
        confirmLabel="Disconnect"
        variant="danger"
        loading={disconnecting}
      />
    </>
  );
}
