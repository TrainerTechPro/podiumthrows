"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/* ─── Context ─────────────────────────────────────────────────────────── */

interface RadioGroupCtx {
  name: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  hasError: boolean;
  registerValue: (value: string, disabled: boolean) => void;
  unregisterValue: (value: string) => void;
  moveSelection: (fromValue: string, dir: 1 | -1) => void;
}

const RadioCtx = createContext<RadioGroupCtx | null>(null);

/* ─── RadioGroup ──────────────────────────────────────────────────────── */

export interface RadioGroupProps {
  value: string;
  onChange: (next: string) => void;
  children: ReactNode;
  /** Group label rendered above the options. */
  label?: ReactNode;
  /** Helper text below the group. Hidden when error is set. */
  helper?: string;
  /** Validation error — sets aria-invalid on the radiogroup. */
  error?: string;
  /** Disables every radio in the group. Per-radio disabled still respected. */
  disabled?: boolean;
  /** Required by a11y when label not provided. */
  "aria-label"?: string;
  className?: string;
  /** Internal name attribute for native grouping. Auto-generated if omitted. */
  name?: string;
}

export function RadioGroup({
  value,
  onChange,
  children,
  label,
  helper,
  error,
  disabled,
  className,
  name: nameProp,
  "aria-label": ariaLabel,
}: RadioGroupProps) {
  const generatedName = useId();
  const name = nameProp ?? generatedName;
  const groupId = useId();

  // Track child registration order for arrow-key nav.
  const orderRef = useRef<Array<{ value: string; disabled: boolean }>>([]);

  const registerValue = useCallback((v: string, isDisabled: boolean) => {
    const arr = orderRef.current;
    const existing = arr.findIndex((x) => x.value === v);
    if (existing >= 0) {
      arr[existing] = { value: v, disabled: isDisabled };
    } else {
      arr.push({ value: v, disabled: isDisabled });
    }
  }, []);

  const unregisterValue = useCallback((v: string) => {
    orderRef.current = orderRef.current.filter((x) => x.value !== v);
  }, []);

  const moveSelection = useCallback(
    (fromValue: string, dir: 1 | -1) => {
      const arr = orderRef.current;
      if (arr.length === 0) return;
      const startIdx = arr.findIndex((x) => x.value === fromValue);
      if (startIdx < 0) return;
      // Walk in dir, wrapping, until we hit a non-disabled entry that isn't ourselves.
      for (let step = 1; step <= arr.length; step++) {
        const idx = (startIdx + dir * step + arr.length * step) % arr.length;
        const candidate = arr[idx];
        if (!candidate.disabled && candidate.value !== fromValue) {
          onChange(candidate.value);
          return;
        }
      }
    },
    [onChange]
  );

  const ctx = useMemo<RadioGroupCtx>(
    () => ({
      name,
      value,
      onChange,
      disabled,
      hasError: !!error,
      registerValue,
      unregisterValue,
      moveSelection,
    }),
    [name, value, onChange, disabled, error, registerValue, unregisterValue, moveSelection]
  );

  const errorId = error ? `${groupId}-error` : undefined;
  const helperId = !error && helper ? `${groupId}-helper` : undefined;
  const describedBy = errorId ?? helperId;

  return (
    <div className={cn("w-full space-y-2", className)}>
      {label && (
        <div className="label" id={`${groupId}-label`}>
          {label}
        </div>
      )}
      <div
        role="radiogroup"
        aria-label={!label ? ariaLabel : undefined}
        aria-labelledby={label ? `${groupId}-label` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      >
        <RadioCtx.Provider value={ctx}>{children}</RadioCtx.Provider>
      </div>
      {error && (
        <p id={errorId} className="text-xs text-danger-500 dark:text-danger-400">
          {error}
        </p>
      )}
      {!error && helper && (
        <p id={helperId} className="text-xs text-muted">
          {helper}
        </p>
      )}
    </div>
  );
}

/* ─── Radio ───────────────────────────────────────────────────────────── */

export interface RadioProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "checked" | "onChange" | "value" | "name" | "size"
> {
  value: string;
  /** Visible label. Omit + provide aria-label for "bare" mode. */
  label?: ReactNode;
  /**
   * Suppress the 18px radio circle. Use when the surrounding card/pill
   * carries the selection state visually (border, background) and adding
   * a circle inside would clutter compact layouts (e.g. gender pills).
   */
  hideVisual?: boolean;
  className?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { value, label, disabled, hideVisual, className, id: externalId, ...rest },
  forwardedRef
) {
  const ctx = useContext(RadioCtx);
  if (!ctx) {
    throw new Error("<Radio> must be used inside <RadioGroup>");
  }

  const generatedId = useId();
  const id = externalId ?? generatedId;
  const isChecked = ctx.value === value;
  const isDisabled = ctx.disabled || disabled;

  // Register this radio with the group for keyboard nav order.
  const internalRef = useRef<HTMLInputElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef]
  );

  // Register on every render — registerValue is idempotent on (value, disabled).
  ctx.registerValue(value, !!isDisabled);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      ctx.moveSelection(value, 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      ctx.moveSelection(value, -1);
    }
  };

  const visual = (
    <span
      className={cn(
        "relative inline-flex items-center justify-center shrink-0",
        "w-[18px] h-[18px] rounded-full border transition-all duration-150",
        !isChecked && "bg-transparent border-surface-300 dark:border-surface-600",
        isChecked && "bg-transparent border-primary-500 border-[5px]",
        isDisabled && "opacity-40 cursor-not-allowed",
        ctx.hasError && !isChecked && "border-danger-500 dark:border-danger-500",
        "peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/40 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-[var(--background)]"
      )}
      aria-hidden="true"
    />
  );

  const inputEl = (
    <input
      {...rest}
      ref={setRefs}
      id={id}
      type="radio"
      name={ctx.name}
      value={value}
      checked={isChecked}
      onChange={() => {
        if (isDisabled) return;
        ctx.onChange(value);
      }}
      onKeyDown={handleKeyDown}
      disabled={isDisabled}
      className="peer sr-only"
    />
  );

  if (!label) {
    return (
      <span className={cn("relative inline-flex items-center", className)}>
        {inputEl}
        {!hideVisual && visual}
      </span>
    );
  }

  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex items-start gap-2.5 cursor-pointer select-none",
        isDisabled && "cursor-not-allowed",
        className
      )}
    >
      {hideVisual ? (
        // Visual suppressed — input still rendered (sr-only) for keyboard
        // and screen-reader semantics; surrounding pill/card carries selection.
        inputEl
      ) : (
        <span className="relative inline-flex items-center mt-0.5">
          {inputEl}
          {visual}
        </span>
      )}
      <span className="text-sm text-[var(--foreground)] leading-snug w-full">{label}</span>
    </label>
  );
});
