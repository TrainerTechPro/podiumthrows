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
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

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

const toastIconProps = { size: 18, strokeWidth: 2.5, "aria-hidden": true as const };

const variantStyles: Record<ToastVariant, { icon: ReactNode; bar: string; container: string }> = {
  success: {
    icon: <CheckCircle2 {...toastIconProps} className="text-success-500" />,
    bar: "bg-success-500",
    container: "border-success-200 dark:border-success-500/30",
  },
  error: {
    icon: <XCircle {...toastIconProps} className="text-danger-500" />,
    bar: "bg-danger-500",
    container: "border-danger-200 dark:border-danger-500/30",
  },
  warning: {
    icon: <AlertTriangle {...toastIconProps} className="text-warning-500" />,
    bar: "bg-warning-500",
    container: "border-warning-200 dark:border-warning-500/30",
  },
  info: {
    icon: <Info {...toastIconProps} className="text-info-500" />,
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
        "transition-all duration-300 ease-spring",
        visible
          ? "opacity-100 translate-x-0 scale-100"
          : "opacity-0 translate-x-8 scale-95",
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
          <X size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* ─── Toaster (stacking container) ──────────────────────────────────────── */

function Toaster({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

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

