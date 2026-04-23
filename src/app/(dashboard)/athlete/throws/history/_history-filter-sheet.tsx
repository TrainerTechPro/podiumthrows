"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export type FilterVariant = "range" | "event" | "implement" | "pr";

interface Props {
  open: boolean;
  variant: FilterVariant;
  onClose: () => void;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function HistoryFilterSheet({ open, variant, onClose, children }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus the close button when the sheet opens.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Handle Escape AND trap focus inside the panel while open.
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      ); // visible only

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        // Shift-Tab on the first element wraps to last.
        if (document.activeElement === first || !panel.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab on the last element wraps to first.
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  // Use animate-spring-up (exists in tailwind config) instead of animate-slide-up-sheet (does not exist).
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Filter: ${variant}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      {/* Sheet — --surface-overlay per CLAUDE.md §Overlay Surfaces (portaled
          content can't rely on parent opacity; dedicated raised token keeps
          it readable in dark mode). */}
      <div
        ref={panelRef}
        className={`relative w-full bg-[var(--surface-overlay)] border-t border-[var(--card-border)] rounded-t-2xl p-5 pb-8 max-h-[75vh] overflow-y-auto ${
          prefersReducedMotion ? "" : "animate-spring-up"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-section font-heading text-[var(--foreground)]">Filter</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="p-2 -m-2 text-muted hover:text-[var(--foreground)]"
            aria-label="Close filter"
          >
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
