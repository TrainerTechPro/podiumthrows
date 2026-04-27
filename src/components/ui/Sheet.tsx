"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

import { logger } from "@/lib/logger";
export type SheetSide = "bottom" | "right";
export type SheetSize = "sm" | "md" | "lg" | "full";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /**
   * Required. No default. Convention:
   * - Athlete pages pass `"bottom"` (thumb-zone, consumer register).
   * - Coach pages pass `"right"` (desk register, preserves canvas).
   * See CLAUDE.md §Design System Rules / Sheets.
   */
  side: SheetSide;
  /** Default: "md". Maps side-aware to max-height (bottom) or max-width (right). */
  size?: SheetSize;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  /** Disables Escape key and click-outside close. Focus trap remains active. */
  preventClose?: boolean;
  /** Grab-indicator pill at the top. Default: true for bottom, false for right. */
  showHandle?: boolean;
  /** Required when `title` is absent — `role=dialog` needs an accessible name. */
  ariaLabel?: string;
  children?: ReactNode;
  className?: string;
}

const EXIT_MS = 220;
const EXIT_REDUCED_MS = 120;

const BOTTOM_SIZE: Record<SheetSize, string> = {
  sm: "max-h-[40vh]",
  md: "max-h-[70vh]",
  lg: "max-h-[85vh]",
  full: "h-[100dvh] max-h-[100dvh]",
};

const RIGHT_SIZE: Record<SheetSize, string> = {
  sm: "w-full max-w-sm",
  md: "w-full max-w-md",
  lg: "w-full max-w-xl",
  full: "w-screen sm:max-w-2xl",
};

function getReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Sheet({
  open,
  onClose,
  side,
  size = "md",
  title,
  description,
  footer,
  preventClose = false,
  showHandle,
  ariaLabel,
  children,
  className,
}: SheetProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = getReducedMotion();
  }, []);

  if (
    typeof window !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    !title &&
    !ariaLabel
  ) {
    logger.warn("[Sheet] Provide `title` or `ariaLabel` for accessibility.", {
      context: "ui/Sheet",
    });
  }

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (reducedMotion.current) {
        setVisible(true);
        return;
      }
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
      };
    }
    setVisible(false);
    const delay = reducedMotion.current ? EXIT_REDUCED_MS : EXIT_MS;
    const t = setTimeout(() => setMounted(false), delay);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || preventClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mounted, preventClose, onClose]);

  useEffect(() => {
    if (!mounted || !visible) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[0].focus();
  }, [mounted, visible]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!preventClose && e.target === backdropRef.current) onClose();
    },
    [preventClose, onClose]
  );

  if (!mounted) return null;

  const isBottom = side === "bottom";
  const effectiveShowHandle = showHandle ?? isBottom;
  const sizeClass = isBottom ? BOTTOM_SIZE[size] : RIGHT_SIZE[size];

  const positionClass = isBottom
    ? "inset-x-0 bottom-0 mx-auto w-full max-w-2xl rounded-t-2xl"
    : "inset-y-0 right-0 h-full rounded-l-2xl";

  const hiddenTransform = isBottom
    ? "translate-y-full motion-reduce:translate-y-0"
    : "translate-x-full motion-reduce:translate-x-0";
  const visibleTransform = "translate-x-0 translate-y-0";

  const hasHeader = Boolean(title) || !preventClose;
  const labelledBy = title ? "sheet-title" : undefined;
  const accessibleName = title ? undefined : ariaLabel;

  return createPortal(
    <div className="fixed inset-0 z-50" data-state={visible ? "open" : "closed"} data-side={side}>
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        aria-hidden="true"
        className={cn(
          "absolute inset-0 bg-black/70",
          "transition-opacity duration-150 ease-linear motion-reduce:duration-100",
          visible ? "opacity-100" : "opacity-0"
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={accessibleName}
        tabIndex={-1}
        className={cn(
          "absolute flex flex-col bg-[var(--surface-overlay)] shadow-2xl",
          positionClass,
          sizeClass,
          "transition-[transform,opacity] duration-200 ease-out motion-reduce:duration-100",
          visible ? `${visibleTransform} opacity-100` : `${hiddenTransform} opacity-0`,
          className
        )}
      >
        {effectiveShowHandle && (
          <div className="sticky top-0 z-10 flex justify-center pt-3 pb-2 bg-[var(--surface-overlay)] rounded-t-2xl">
            <div
              aria-hidden="true"
              className="w-10 h-1 rounded-full bg-surface-300 dark:bg-surface-700"
            />
          </div>
        )}

        {hasHeader && (
          <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-[var(--card-border)]/40">
            <div className="min-w-0">
              {title && (
                <h2 id="sheet-title" className="text-base font-semibold text-[var(--foreground)]">
                  {title}
                </h2>
              )}
              {description && <p className="text-sm text-muted mt-1">{description}</p>}
            </div>
            {!preventClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 rounded-lg p-1.5 text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 dark:hover:text-surface-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              >
                <X size={16} strokeWidth={2.5} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar px-5 py-4">
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[var(--card-border)]/40">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function useSheet(initial = false) {
  const [open, setOpen] = useState(initial);
  return {
    open,
    onOpen: useCallback(() => setOpen(true), []),
    onClose: useCallback(() => setOpen(false), []),
    toggle: useCallback(() => setOpen((v) => !v), []),
  };
}
