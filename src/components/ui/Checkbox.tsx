"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type HtmlCheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "checked" | "onChange" | "size"
>;

export interface CheckboxProps extends HtmlCheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Visible label. Omit + provide aria-label for "bare" mode (parent owns click). */
  label?: ReactNode;
  helper?: string;
  error?: string;
  required?: boolean;
  /** Tri-state — shows a dash glyph. The DOM input gets indeterminate=true. */
  indeterminate?: boolean;
  className?: string;
  id?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    checked,
    onChange,
    label,
    helper,
    error,
    required,
    indeterminate = false,
    disabled,
    id: externalId,
    className,
    ...rest
  },
  forwardedRef
) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const internalRef = useRef<HTMLInputElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef]
  );

  // indeterminate is a property, not an attribute — must be set via JS.
  useEffect(() => {
    if (internalRef.current) {
      internalRef.current.indeterminate = indeterminate && !checked;
    }
  }, [indeterminate, checked]);

  const errorId = error ? `${id}-error` : undefined;
  const helperId = !error && helper ? `${id}-helper` : undefined;
  const describedBy = errorId ?? helperId;

  const showCheck = checked && !indeterminate;
  const showDash = indeterminate && !checked;

  const visual = (
    <span
      className={cn(
        "relative inline-flex items-center justify-center shrink-0",
        "w-[18px] h-[18px] rounded border transition-[background-color,border-color,box-shadow] duration-150",
        // Unchecked
        !checked && !indeterminate && "bg-transparent border-surface-300 dark:border-surface-600",
        // Checked or indeterminate — amber fill
        (checked || indeterminate) &&
          "bg-primary-500 border-primary-500 shadow-[0_0_0_1px_var(--color-brand)]",
        // Disabled
        disabled && "opacity-40 cursor-not-allowed",
        // Error border (only when not checked — checked/indeterminate already amber)
        error && !checked && !indeterminate && "border-danger-500 dark:border-danger-500",
        // Focus ring (when sibling input focused)
        "peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/40 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-[var(--background)]"
      )}
      aria-hidden="true"
    >
      {showCheck && <Check size={12} strokeWidth={3} className="text-black" />}
      {showDash && <Minus size={12} strokeWidth={3} className="text-black" />}
    </span>
  );

  const inputEl = (
    <input
      {...rest}
      ref={setRefs}
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => {
        if (disabled) return;
        onChange(e.target.checked);
      }}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className="peer sr-only"
    />
  );

  // Bare mode — no visible label, parent owns click target.
  if (!label) {
    return (
      <span className={cn("relative inline-flex items-center", className)}>
        {inputEl}
        {visual}
      </span>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <label
        htmlFor={id}
        className={cn(
          "inline-flex items-start gap-2.5 cursor-pointer select-none",
          disabled && "cursor-not-allowed"
        )}
      >
        <span className="relative inline-flex items-center mt-0.5">
          {inputEl}
          {visual}
        </span>
        <span className="text-sm text-[var(--foreground)] leading-snug">
          {label}
          {required && (
            <span className="ml-1 text-danger-500 dark:text-danger-400" aria-hidden="true">
              *
            </span>
          )}
        </span>
      </label>
      {(error || helper) && (
        <p
          id={errorId ?? helperId}
          className={cn(
            "text-xs mt-1 ml-7",
            error ? "text-danger-500 dark:text-danger-400" : "text-muted"
          )}
        >
          {error ?? helper}
        </p>
      )}
    </div>
  );
});
