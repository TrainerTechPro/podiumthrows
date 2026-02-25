"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  HTMLAttributes,
  ReactNode,
  KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";

/* ─── Context ────────────────────────────────────────────────────────────── */

interface TabsContextValue {
  active: string;
  setActive: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue>({
  active: "",
  setActive: () => {},
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
  const active = activeTab ?? internal;

  const setActive = (id: string) => {
    if (!activeTab) setInternal(id);
    onChange?.(id);
  };

  return (
    <TabsContext.Provider value={{ active, setActive }}>
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
  const variants = {
    underline: "border-b border-[var(--card-border)] gap-0",
    pills:     "gap-1.5",
    boxed:     "bg-[var(--muted-bg)] p-1 rounded-xl gap-1",
  };

  return (
    <div
      role="tablist"
      className={cn("flex items-center overflow-x-auto scrollbar-none", variants[variant], className)}
      {...props}
    >
      {children}
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
  const { active, setActive } = useContext(TabsContext);
  const isActive = active === id;

  const baseStyles =
    "relative inline-flex items-center gap-2 text-sm font-medium transition-all duration-150 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 select-none disabled:opacity-40 disabled:cursor-not-allowed";

  const variantStyles = {
    underline: cn(
      "px-3 py-2.5 -mb-px border-b-2",
      isActive
        ? "border-primary-500 text-primary-600 dark:text-primary-400"
        : "border-transparent text-muted hover:text-[var(--foreground)] hover:border-surface-300 dark:hover:border-surface-600"
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

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={!isActive}
      tabIndex={0}
      className={cn("focus:outline-none", isActive && "animate-[fadeIn_150ms_ease]", className)}
      {...props}
    >
      {isActive ? children : null}
    </div>
  );
}
