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
import { CheckCircle2, XCircle, AlertTriangle, Info, X, Trophy } from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type ToastVariant = "success" | "error" | "warning" | "info" | "celebration";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number; // ms, 0 = persist
  action?: { label: string; onClick: () => void };
  /** Large highlight value for celebration toasts (e.g. "18.42m") */
  highlight?: string;
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
  celebration: (title: string, opts?: { description?: string; highlight?: string; duration?: number }) => string;
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
  const celebration = useCallback(
    (title: string, opts?: { description?: string; highlight?: string; duration?: number }) =>
      toast({
        variant: "celebration",
        title,
        description: opts?.description,
        highlight: opts?.highlight,
        duration: opts?.duration ?? 6000,
      }),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss, success, error, warning, info, celebration }}>
      {children}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/* ─── Variant Styles ─────────────────────────────────────────────────────── */

const toastIconProps = { size: 18, strokeWidth: 2.5, "aria-hidden": true as const };

const variantConfig: Record<
  ToastVariant,
  { icon: ReactNode; bar: string; container: string; progress: string }
> = {
  success: {
    icon: <CheckCircle2 {...toastIconProps} className="text-success-500" />,
    bar: "bg-success-500",
    container: "border-success-200 dark:border-success-500/30",
    progress: "bg-success-500",
  },
  error: {
    icon: <XCircle {...toastIconProps} className="text-danger-500" />,
    bar: "bg-danger-500",
    container: "border-danger-200 dark:border-danger-500/30",
    progress: "bg-danger-500",
  },
  warning: {
    icon: <AlertTriangle {...toastIconProps} className="text-warning-500" />,
    bar: "bg-warning-500",
    container: "border-warning-200 dark:border-warning-500/30",
    progress: "bg-warning-500",
  },
  info: {
    icon: <Info {...toastIconProps} className="text-info-500" />,
    bar: "bg-info-500",
    container: "border-info-200 dark:border-info-500/30",
    progress: "bg-info-500",
  },
  celebration: {
    icon: <Trophy {...toastIconProps} className="text-primary-500" />,
    bar: "bg-gradient-to-b from-primary-400 to-primary-600",
    container: "border-primary-300 dark:border-primary-500/40",
    progress: "bg-primary-500",
  },
};

/* ─── CSS-Only Confetti Particles ─────────────────────────────────────────── */

const CONFETTI_COLORS = ["#f59e0b", "#fbbf24", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6"];

function CelebrationConfetti() {
  // 12 particles that burst outward from the left icon area
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360;
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * (40 + (i % 3) * 15);
    const dy = Math.sin(rad) * (30 + (i % 2) * 20);
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const size = 4 + (i % 3) * 2;
    const delay = (i % 4) * 60;
    return { dx, dy, color, size, delay };
  });

  return (
    <>
      {particles.map((p, i) => (
        <span
          key={i}
          className="toast-confetti-particle"
          style={{
            position: "absolute",
            left: 20,
            top: "50%",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: i % 2 === 0 ? "1px" : "50%",
            // CSS custom properties for the keyframe
            "--dx": `${p.dx}px`,
            "--dy": `${p.dy}px`,
            animationDelay: `${p.delay}ms`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

/* ─── Individual Toast Item ──────────────────────────────────────────────── */

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Trigger entrance
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("visible"));
    });
  }, []);

  // Auto-dismiss
  useEffect(() => {
    if (!t.duration) return;
    timerRef.current = setTimeout(() => {
      setPhase("exit");
      setTimeout(onDismiss, 200);
    }, t.duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [t.duration, onDismiss]);

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase("exit");
    setTimeout(onDismiss, 200);
  };

  const isCelebration = t.variant === "celebration";
  const { icon, bar, container, progress } = variantConfig[t.variant];
  const skip = reducedMotion.current;

  // Entrance/exit transforms differ by viewport
  // Mobile: slide up from bottom, Desktop: slide in from right
  const enterClass = skip
    ? "opacity-100"
    : phase === "enter"
      ? "opacity-0 max-sm:translate-y-full sm:translate-x-8 sm:scale-95"
      : phase === "exit"
        ? "opacity-0 max-sm:translate-y-4 sm:translate-x-8 sm:scale-95"
        : "opacity-100 translate-y-0 translate-x-0 scale-100";

  const transitionClass = skip
    ? ""
    : phase === "exit"
      ? "transition-all duration-200 ease-in"
      : "transition-all duration-250 ease-out";

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "relative overflow-hidden",
        // Mobile: full width. Desktop: max-w-sm
        "w-full sm:w-auto sm:max-w-sm",
        // Base card style
        isCelebration
          ? "bg-gradient-to-r from-primary-50 via-primary-50/80 to-amber-50 dark:from-primary-950/60 dark:via-primary-950/40 dark:to-amber-950/30 border rounded-xl shadow-lg"
          : "bg-[var(--card-bg)] border rounded-xl shadow-lg",
        enterClass,
        transitionClass,
        container
      )}
    >
      {/* Left color bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-xl", bar)} />

      {/* Confetti burst for celebration variant */}
      {isCelebration && !skip && <CelebrationConfetti />}

      <div className="flex items-start gap-3 pl-5 pr-4 py-4 relative">
        <span className={cn("mt-0.5 shrink-0", isCelebration && !skip && "toast-icon-pulse")}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-semibold text-[var(--foreground)]",
            isCelebration ? "text-base font-heading" : "text-sm"
          )}>
            {t.title}
          </p>
          {t.highlight && (
            <p className="text-2xl font-bold font-heading text-primary-600 dark:text-primary-400 tabular-nums mt-0.5">
              {t.highlight}
            </p>
          )}
          {t.description && (
            <p className={cn(
              "text-xs text-muted mt-0.5 leading-relaxed",
              isCelebration && "text-primary-700/70 dark:text-primary-300/70"
            )}>
              {t.description}
            </p>
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

      {/* Progress bar (auto-dismiss countdown) */}
      {t.duration && t.duration > 0 && !skip && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5">
          <div
            className={cn("h-full rounded-full", progress)}
            style={{
              animation: `toastProgress ${t.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Toaster (stacking container) ──────────────────────────────────────── */

function Toaster({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <>
      {/* Keyframe animations */}
      <style>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        @keyframes toastIconPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.15); }
        }
        @keyframes toastConfettiBurst {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
        }
        .toast-icon-pulse {
          animation: toastIconPulse 1.5s ease-in-out infinite;
        }
        .toast-confetti-particle {
          animation: toastConfettiBurst 600ms ease-out forwards;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .toast-icon-pulse { animation: none; }
          .toast-confetti-particle { animation: none; opacity: 0; }
        }
      `}</style>

      <div
        aria-label="Notifications"
        className={cn(
          "fixed z-[60] flex flex-col-reverse pointer-events-none",
          // Mobile: bottom center, full width with padding
          "bottom-4 left-4 right-4 gap-2",
          // Desktop: top-right corner, auto width
          "sm:top-4 sm:right-4 sm:bottom-auto sm:left-auto sm:gap-2"
        )}
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </>,
    document.body
  );
}
