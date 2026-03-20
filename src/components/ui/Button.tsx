"use client";

import { forwardRef, useRef, useCallback, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: [
    "bg-primary-500 text-white",
    "hover:bg-primary-600 active:bg-primary-700",
    "focus:ring-primary-500/40",
    "shadow-sm hover:shadow",
  ].join(" "),
  secondary: [
    "bg-surface-100 dark:bg-surface-800",
    "text-surface-900 dark:text-surface-100",
    "border border-surface-200 dark:border-surface-700",
    "hover:bg-surface-200 dark:hover:bg-surface-700",
    "focus:ring-surface-400/40",
  ].join(" "),
  outline: [
    "bg-transparent border border-primary-500",
    "text-primary-600 dark:text-primary-400",
    "hover:bg-primary-50 dark:hover:bg-primary-500/10",
    "focus:ring-primary-500/40",
  ].join(" "),
  danger: [
    "bg-danger-500 text-white",
    "hover:bg-danger-600 active:bg-danger-700",
    "focus:ring-danger-500/40",
    "shadow-sm hover:shadow",
  ].join(" "),
  ghost: [
    "bg-transparent text-surface-700 dark:text-surface-300",
    "hover:bg-surface-100 dark:hover:bg-surface-800",
    "focus:ring-surface-400/40",
  ].join(" "),
};

const sizes: Record<ButtonSize, string> = {
  sm: "text-xs py-2 px-3 rounded-lg gap-1.5 min-h-[36px]",
  md: "text-sm py-3 px-4 rounded-xl gap-2 min-h-[44px]",
  lg: "text-base py-3 px-5 rounded-xl gap-2 min-h-[44px]",
};

/** Variants that get the full spring bounce */
const SPRING_VARIANTS = new Set<ButtonVariant>(["primary", "danger"]);

const Spinner = () => (
  <svg
    className="animate-spin h-3.5 w-3.5 shrink-0"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const innerRef = useRef<HTMLButtonElement | null>(null);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        const el = innerRef.current;
        if (el && !disabled && !loading) {
          const isSpring = SPRING_VARIANTS.has(variant);
          const cls = isSpring ? "btn-bounce-spring" : "btn-bounce-subtle";

          // Remove first to allow re-trigger
          el.classList.remove(cls);
          // Force reflow
          void el.offsetWidth;
          el.classList.add(cls);

          const onEnd = () => {
            el.classList.remove(cls);
            el.removeEventListener("animationend", onEnd);
          };
          el.addEventListener("animationend", onEnd);
        }
        onClick?.(e);
      },
      [variant, disabled, loading, onClick]
    );

    return (
      <button
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        disabled={disabled || loading}
        onClick={handleClick}
        className={cn(
          "inline-flex items-center justify-center font-medium select-none",
          "transition-[background-color,box-shadow,color] duration-150",
          "focus:outline-none focus:ring-2 focus:ring-offset-2",
          "focus:ring-offset-[var(--background)]",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? <Spinner /> : leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);
Button.displayName = "Button";
