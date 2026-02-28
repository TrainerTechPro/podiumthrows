"use client";

import {
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  /** Footer content (action buttons) */
  footer?: ReactNode;
  size?: ModalSize;
  /** Prevent closing via backdrop click or Escape */
  preventClose?: boolean;
  children?: ReactNode;
  className?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm:   "max-w-sm",
  md:   "max-w-md",
  lg:   "max-w-lg",
  xl:   "max-w-2xl",
  full: "max-w-[95vw] h-[90vh] flex flex-col",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = "md",
  preventClose = false,
  children,
  className,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Lock body scroll */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* Escape key */
  useEffect(() => {
    if (!open || preventClose) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, preventClose, onClose]);

  /* Focus trap */
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length) focusable[0].focus();
  }, [open]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!preventClose && e.target === overlayRef.current) onClose();
    },
    [preventClose, onClose]
  );

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[6px] animate-fade-in"
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "relative w-full bg-[var(--card-bg)] border border-[var(--card-border)]",
          "rounded-2xl shadow-2xl animate-spring-up",
          size === "full" && "overflow-hidden",
          sizeClasses[size],
          className
        )}
        tabIndex={-1}
      >
        {/* Header */}
        {(title || !preventClose) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[var(--card-border)]">
            <div className="min-w-0">
              {title && (
                <h2
                  id="modal-title"
                  className="text-base font-semibold text-[var(--foreground)]"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm text-muted mt-1">{description}</p>
              )}
            </div>
            {!preventClose && (
              <button
                onClick={onClose}
                className="shrink-0 rounded-lg p-1.5 text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 dark:hover:text-surface-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                aria-label="Close"
              >
                <X size={16} strokeWidth={2.5} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div
          className={cn(
            "px-6 py-5",
            size === "full" && "flex-1 overflow-y-auto"
          )}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--card-border)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ─── useModal hook ─────────────────────────────────────────────────────── */

import { useState } from "react";

export function useModal(initial = false) {
  const [open, setOpen] = useState(initial);
  return {
    open,
    onOpen:  () => setOpen(true),
    onClose: () => setOpen(false),
    toggle:  () => setOpen((v) => !v),
  };
}
