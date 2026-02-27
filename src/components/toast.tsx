"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";

type ToastType = "success" | "info" | "warning" | "error";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  dismissing: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

let nextId = 0;

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case "success":
      return (
        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "info":
      return (
        <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "warning":
      return (
        <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case "error":
      return (
        <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

function getToastClasses(type: ToastType, dismissing: boolean): string {
  const base = "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border cursor-pointer relative overflow-hidden min-w-0";
  const anim = dismissing ? "animate-toast-out" : "animate-slide-in";

  switch (type) {
    case "success":
      return `${base} ${anim} bg-green-50 border-green-200 text-green-800`;
    case "info":
      return `${base} ${anim} bg-blue-50 border-blue-200 text-blue-800`;
    case "warning":
      return `${base} ${anim} bg-amber-50 border-amber-200 text-amber-800`;
    case "error":
      return `${base} ${anim} bg-red-50 border-red-200 text-red-800`;
  }
}

function getProgressBarClass(type: ToastType): string {
  const base = "absolute bottom-0 left-0 h-0.5 animate-toast-progress";

  switch (type) {
    case "success":
      return `${base} bg-green-400`;
    case "info":
      return `${base} bg-blue-400`;
    case "warning":
      return `${base} bg-amber-400`;
    case "error":
      return `${base} bg-red-400`;
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, dismissing: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = ++nextId;
      setToasts((prev) => {
        const next = [...prev, { id, message, type, dismissing: false }];
        if (next.length > 3) {
          return next.slice(next.length - 3);
        }
        return next;
      });
      setTimeout(() => {
        dismissToast(id);
      }, 4000);
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* bottom-24 on mobile to clear tab bar, bottom-4 on desktop */}
      <div className="fixed bottom-24 lg:bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={getToastClasses(t.type, t.dismissing)}
            onClick={() => dismissToast(t.id)}
            role="alert"
            style={{ pointerEvents: "auto" }}
          >
            <ToastIcon type={t.type} />
            <span className="text-sm font-medium flex-1">{t.message}</span>
            {!t.dismissing && <div className={getProgressBarClass(t.type)} />}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
