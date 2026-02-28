"use client";

import { forwardRef, InputHTMLAttributes, ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { Eye as EyeIcon, EyeOff as EyeOffIcon, AlertCircle } from "lucide-react";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  helper?: string;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helper,
      leftAddon,
      rightAddon,
      leftIcon,
      rightIcon,
      required,
      className,
      id,
      type = "text",
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    const inputType = isPassword ? (showPassword ? "text" : "password") : type;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
            {required && (
              <span className="ml-1 text-danger-500 dark:text-danger-400" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <div className="relative flex items-stretch">
          {/* Left addon (e.g. "https://") */}
          {leftAddon && (
            <div className="flex items-center px-3 rounded-l-xl border border-r-0 border-[var(--card-border)] bg-[var(--muted-bg)] text-sm text-[var(--muted)] shrink-0">
              {leftAddon}
            </div>
          )}

          {/* Left icon */}
          {leftIcon && !leftAddon && (
            <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={inputType}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined
            }
            className={cn(
              "input flex-1 min-w-0",
              leftAddon && "rounded-l-none",
              rightAddon && "rounded-r-none",
              leftIcon && "pl-10",
              (rightIcon || isPassword) && "pr-10",
              error &&
                "border-danger-500 dark:border-danger-500 focus:ring-danger-500/50 focus:border-danger-500",
              className
            )}
            {...props}
          />

          {/* Password toggle */}
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOffIcon size={16} strokeWidth={2} aria-hidden="true" /> : <EyeIcon size={16} strokeWidth={2} aria-hidden="true" />}
            </button>
          )}

          {/* Right icon (non-password) */}
          {rightIcon && !isPassword && (
            <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500">
              {rightIcon}
            </div>
          )}

          {/* Right addon (e.g. "kg") */}
          {rightAddon && (
            <div className="flex items-center px-3 rounded-r-xl border border-l-0 border-[var(--card-border)] bg-[var(--muted-bg)] text-sm text-[var(--muted)] shrink-0">
              {rightAddon}
            </div>
          )}
        </div>

        {error && (
          <p id={`${inputId}-error`} className="text-xs text-danger-500 dark:text-danger-400 flex items-center gap-1.5">
            <AlertCircle size={12} aria-hidden="true" />
            {error}
          </p>
        )}
        {!error && helper && (
          <p id={`${inputId}-helper`} className="text-xs text-muted">
            {helper}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

