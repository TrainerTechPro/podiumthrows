"use client";

import { forwardRef, InputHTMLAttributes, KeyboardEvent, useCallback, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, disabled, onKeyDown, onKeyUp, onBlur, ...props }, ref) {
    const [revealed, setRevealed] = useState(false);
    const [capsOn, setCapsOn] = useState(false);

    // Track caps-lock from any key event the user might generate while
    // typing. Cleared on blur so the warning doesn't linger.
    const syncCaps = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
      try {
        setCapsOn(e.getModifierState("CapsLock"));
      } catch {
        // ok: getModifierState isn't on ancient browsers — silently
        // omit the indicator. No telemetry needed; the password input
        // still functions.
        setCapsOn(false);
      }
    }, []);

    return (
      <div className="relative">
        <input
          ref={ref}
          type={revealed ? "text" : "password"}
          disabled={disabled}
          className={cn("input pr-11", className)}
          aria-describedby={capsOn ? "password-capslock-warning" : undefined}
          onKeyDown={(e) => {
            syncCaps(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            syncCaps(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCapsOn(false);
            onBlur?.(e);
          }}
          {...props}
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          disabled={disabled}
          aria-pressed={revealed}
          aria-label={revealed ? "Hide password" : "Show password"}
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2",
            "inline-flex items-center justify-center",
            "h-7 w-7 rounded-md",
            "text-surface-400 hover:text-[var(--foreground)]",
            "transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {revealed ? (
            <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
        {capsOn && (
          <p
            id="password-capslock-warning"
            role="status"
            className="mt-1.5 text-caption text-status-warning-fg"
          >
            Caps Lock is on
          </p>
        )}
      </div>
    );
  }
);
