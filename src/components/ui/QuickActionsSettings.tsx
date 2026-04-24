"use client";

import { useState, useEffect } from "react";
import { CircleDot, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

const STORAGE_KEY = "podium-quick-actions";

/**
 * Embeddable settings section for enabling/disabling the Quick Actions FAB.
 * Reads and writes to localStorage, dispatches a custom event so the FAB
 * component can pick up changes without a page reload.
 */
export function QuickActionsSettings({ role }: { role: "COACH" | "ATHLETE" }) {
  const [enabled, setEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}-${role.toLowerCase()}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        setEnabled(parsed.enabled ?? true);
      }
    } catch (err) {
      // ignore
      logger.debug("ignore", {
        context: "src/components/ui/QuickActionsSettings.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
  }, [role]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}-${role.toLowerCase()}`);
      const existing = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        `${STORAGE_KEY}-${role.toLowerCase()}`,
        JSON.stringify({ ...existing, enabled: next })
      );
      window.dispatchEvent(new CustomEvent("quick-actions-prefs-change"));
    } catch (err) {
      // ignore
      logger.debug("ignore", {
        context: "src/components/ui/QuickActionsSettings.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
  }

  if (!mounted) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Quick Actions</h2>
      <div className="card p-4 flex items-center gap-3">
        <CircleDot
          size={20}
          strokeWidth={1.75}
          className="text-primary-500 shrink-0"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">Quick Actions Button</p>
          <p className="text-xs text-muted">
            Floating shortcut button for common actions.
            {enabled
              ? " Tap the gear icon on the button to customize."
              : " Enable to show the floating button."}
          </p>
        </div>
        <button
          onClick={toggle}
          className={cn(
            "p-1 rounded-lg transition-colors",
            enabled ? "text-primary-500" : "text-muted"
          )}
          aria-label={enabled ? "Disable quick actions" : "Enable quick actions"}
        >
          {enabled ? (
            <ToggleRight size={28} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <ToggleLeft size={28} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      </div>
    </section>
  );
}
