"use client";

import { forwardRef, InputHTMLAttributes, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, disabled, ...props }, ref) {
    const [revealed, setRevealed] = useState(false);

    return (
      <div className="relative">
        <input
          ref={ref}
          type={revealed ? "text" : "password"}
          disabled={disabled}
          className={cn("input pr-11", className)}
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
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {revealed ? (
            <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Eye size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);
