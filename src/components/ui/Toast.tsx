"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number; // ms, 0 = persist
  action?: { label: string; onClick: () => void };
}

type ToastInput = Omit<Toast, "id">;

interface ToastContextValue {
  toasts: Toast[];
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  success: (title: string, description?: string) => string;
  error:   (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info:    (title: string, description?: string) => string;
}

/* ─── Context ────────────────────────────────────────────────────────────── */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/* ─── Provider ───────────────────────────────────────────────────────────── */

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((input: ToastInput): string => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { id, ...input }]); // keep max 5
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (title: string, description?: string) =>
      toast({ variant: "success", title, description, duration: 4000 }),
    [toast]
  );
  const error = useCallback(
    (title: string, description?: string) =>
      toast({ variant: "error", title, description, duration: 6000 }),
    [toast]
  );
  const warning = useCallback(
    (title: string, description?: string) =>
      toast({ variant: "warning", title, description, duration: 5000 }),
    [toast]
  );
  const info = useCallback(
    (title: string, description?: string) =>
      toast({ variant: "info", title, description, duration: 4000 }),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss, success, error, warning, info }}>
      {children}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/* ─── Individual Toast Item ──────────────────────────────────────────────── */

const variantStyles: Record<ToastVariant, { icon: ReactNode; bar: string; container: string }> = {
  success: {
    icon: <SuccessIcon />,
    bar: "bg-success-500",
    container: "border-success-200 dark:border-success-500/30",
  },
  error: {
    icon: <ErrorIcon />,
    bar: "bg-danger-500",
    container: "border-danger-200 dark:border-danger-500/30",
  },
  warning: {
    icon: <WarningIcon />,
    bar: "bg-warning-500",
    container: "border-warning-200 dark:border-warning-500/30",
  },
  info: {
    icon: <InfoIcon />,
    bar: "bg-info-500",
    container: "border-info-200 dark:border-info-500/30",
  },
};

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Entrance animation
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Auto-dismiss
  useEffect(() => {
    if (!t.duration) return;
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, t.duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [t.duration, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  const { icon, bar, container } = variantStyles[t.variant];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "relative w-full max-w-sm bg-[var(--card-bg)] border rounded-xl shadow-lg overflow-hidden",
        "transition-all duration-300",
        visible
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-4",
        container
      )}
    >
      {/* Left color bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", bar)} />

      <div className="flex items-start gap-3 pl-5 pr-4 py-4">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">{t.title}</p>
          {t.description && (
            <p className="text-xs text-muted mt-0.5 leading-relaxed">{t.description}</p>
          )}
          {t.action && (
            <button
              onClick={t.action.onClick}
              className="mt-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            >
              {t.action.label}
            </button>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 mt-0.5 rounded p-0.5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
          aria-label="Dismiss"
        >
          <DismissIcon />
        </button>
      </div>
    </div>
  );
}

/* ─── Toaster (stacking container) ──────────────────────────────────────── */

function Toaster({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[60] flex flex-col-reverse gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>,
    document.body
  );
}

/* ─── Icons ──────────────────────────────────────────────────────────────── */

function SuccessIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function DismissIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
