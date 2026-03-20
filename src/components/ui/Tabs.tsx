"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  HTMLAttributes,
  ReactNode,
  KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";

/* ─── Context ────────────────────────────────────────────────────────────── */

interface TabsContextValue {
  active: string;
  prev: string;
  setActive: (id: string) => void;
  registerTrigger: (id: string, el: HTMLButtonElement | null) => void;
}

const TabsContext = createContext<TabsContextValue>({
  active: "",
  prev: "",
  setActive: () => {},
  registerTrigger: () => {},
});

/* ─── Root ───────────────────────────────────────────────────────────────── */

export interface TabsProps {
  defaultTab: string;
  onChange?: (id: string) => void;
  /** Controlled mode */
  activeTab?: string;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultTab, onChange, activeTab, children, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultTab);
  const [prev, setPrev] = useState(defaultTab);
  const active = activeTab ?? internal;

  const setActive = useCallback(
    (id: string) => {
      setPrev(active);
      if (!activeTab) setInternal(id);
      onChange?.(id);
    },
    [active, activeTab, onChange]
  );

  // Track previous for controlled mode too
  const prevActiveRef = useRef(active);
  useEffect(() => {
    if (active !== prevActiveRef.current) {
      setPrev(prevActiveRef.current);
      prevActiveRef.current = active;
    }
  }, [active]);

  // Trigger ref map for sliding indicator
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const registerTrigger = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) triggerRefs.current.set(id, el);
    else triggerRefs.current.delete(id);
  }, []);

  return (
    <TabsContext.Provider value={{ active, prev, setActive, registerTrigger }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

/* ─── Tab List ───────────────────────────────────────────────────────────── */

export interface TabListProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual style */
  variant?: "underline" | "pills" | "boxed";
}

export function TabList({ variant = "underline", className, children, ...props }: TabListProps) {
  const { active } = useContext(TabsContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Measure the active tab button for the sliding indicator
  useEffect(() => {
    const container = containerRef.current;
    if (!container || variant !== "underline") return;

    const activeBtn = container.querySelector<HTMLButtonElement>(`[aria-selected="true"]`);
    if (!activeBtn) return;

    const containerRect = container.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    setIndicator({
      left: btnRect.left - containerRect.left + container.scrollLeft,
      width: btnRect.width,
    });
  }, [active, variant]);

  const variants = {
    underline: "border-b border-[var(--card-border)] gap-0",
    pills:     "gap-1.5",
    boxed:     "bg-[var(--muted-bg)] p-1 rounded-xl gap-1",
  };

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={cn(
        "relative flex items-center overflow-x-auto scrollbar-none",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}

      {/* Sliding underline indicator */}
      {variant === "underline" && indicator && (
        <span
          className="absolute bottom-0 h-0.5 bg-primary-500 rounded-full"
          style={{
            left: indicator.left,
            width: indicator.width,
            transition: reducedMotion.current ? "none" : "left 250ms ease-out, width 250ms ease-out",
          }}
        />
      )}
    </div>
  );
}

/* ─── Tab Trigger ────────────────────────────────────────────────────────── */

export interface TabTriggerProps {
  id: string;
  children: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  badge?: ReactNode;
  className?: string;
  /** Must match the variant of the parent TabList */
  variant?: "underline" | "pills" | "boxed";
}

export function TabTrigger({
  id,
  children,
  disabled = false,
  icon,
  badge,
  className,
  variant = "underline",
}: TabTriggerProps) {
  const { active, setActive, registerTrigger } = useContext(TabsContext);
  const isActive = active === id;
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    registerTrigger(id, btnRef.current);
    return () => registerTrigger(id, null);
  }, [id, registerTrigger]);

  const baseStyles =
    "relative inline-flex items-center gap-2 text-sm font-medium transition-all duration-150 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 select-none disabled:opacity-40 disabled:cursor-not-allowed";

  const variantStyles = {
    underline: cn(
      "px-3 py-2.5 -mb-px border-b-2 border-transparent",
      isActive
        ? "text-primary-600 dark:text-primary-400"
        : "text-muted hover:text-[var(--foreground)]"
    ),
    pills: cn(
      "px-3.5 py-1.5 rounded-full",
      isActive
        ? "bg-primary-500 text-white shadow-sm"
        : "text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
    ),
    boxed: cn(
      "flex-1 justify-center px-3 py-1.5 rounded-lg",
      isActive
        ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-card"
        : "text-muted hover:text-[var(--foreground)]"
    ),
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!disabled) setActive(id);
    }
  };

  return (
    <button
      ref={btnRef}
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      id={`tab-${id}`}
      disabled={disabled}
      onClick={() => !disabled && setActive(id)}
      onKeyDown={handleKeyDown}
      className={cn(baseStyles, variantStyles[variant], className)}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
      {badge && <span>{badge}</span>}
    </button>
  );
}

/* ─── Tab Panel ──────────────────────────────────────────────────────────── */

export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
}

export function TabPanel({ id, children, className, ...props }: TabPanelProps) {
  const { active } = useContext(TabsContext);
  const isActive = active === id;
  const [phase, setPhase] = useState<"hidden" | "entering" | "visible">(
    isActive ? "visible" : "hidden"
  );
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (isActive) {
      if (reducedMotion.current) {
        setPhase("visible");
        return;
      }
      // Delay entrance so outgoing panel can fade first
      setPhase("entering");
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase("visible"));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      // Immediate hide (outgoing panel fades via CSS)
      const timer = setTimeout(() => setPhase("hidden"), 150);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  if (phase === "hidden" && !isActive) return null;

  const skip = reducedMotion.current;

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={phase === "hidden"}
      tabIndex={0}
      className={cn("focus:outline-none", className)}
      style={
        skip
          ? undefined
          : {
              opacity: phase === "visible" ? 1 : 0,
              transform: phase === "visible" ? "translateY(0)" : "translateY(8px)",
              transition:
                phase === "entering" || phase === "visible"
                  ? "opacity 200ms ease-out, transform 200ms ease-out"
                  : "opacity 150ms ease-in",
              willChange: phase !== "visible" ? "opacity, transform" : undefined,
            }
      }
      {...props}
    >
      {children}
    </div>
  );
}
