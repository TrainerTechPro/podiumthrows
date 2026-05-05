"use client";

import {
  forwardRef,
  ReactNode,
  useCallback,
  useId,
  useMemo,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { AlertCircle, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseNumericInput, parseIntegerInput } from "@/lib/forms/parse-numeric";

type HtmlInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "min" | "max" | "step" | "size"
>;

export interface NumberInputProps extends HtmlInputProps {
  value: number | null;
  onChange: (next: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  unit?: string;
  leftIcon?: ReactNode;
  showSteppers?: boolean;
  allowNegative?: boolean;
  className?: string;
  /** Override classes on the inner <input>. Use for hero-display typography. */
  inputClassName?: string;
  id?: string;
}

function isIntegerStep(step: number | undefined): boolean {
  if (step == null) return true;
  return Number.isInteger(step);
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    value,
    onChange,
    min,
    max,
    step,
    label,
    helper,
    error,
    required,
    unit,
    leftIcon,
    showSteppers = false,
    allowNegative = false,
    placeholder,
    disabled,
    id: externalId,
    className,
    inputClassName,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const isInt = isIntegerStep(step);
  const parser = isInt ? parseIntegerInput : parseNumericInput;
  const stepValue = step ?? 1;

  const inputMode = isInt ? "numeric" : "decimal";

  const displayValue = value == null ? "" : String(value);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "") {
        onChange(null);
        return;
      }
      const parsed = parser(raw);
      if (parsed == null) {
        onChange(null);
        return;
      }
      if (!allowNegative && parsed < 0) return;
      onChange(parsed);
    },
    [onChange, parser, allowNegative]
  );

  const clamp = useCallback(
    (n: number): number => {
      let next = n;
      if (min != null && next < min) next = min;
      if (max != null && next > max) next = max;
      return next;
    },
    [min, max]
  );

  const canDecrement = useMemo(() => {
    const baseline = value ?? 0;
    if (min != null && baseline <= min) return false;
    if (!allowNegative && baseline <= 0) return false;
    return true;
  }, [value, min, allowNegative]);

  const canIncrement = useMemo(() => {
    const baseline = value ?? 0;
    if (max != null && baseline >= max) return false;
    return true;
  }, [value, max]);

  const handleStep = useCallback(
    (direction: 1 | -1) => {
      const baseline = value ?? 0;
      const next = clamp(baseline + direction * stepValue);
      if (next === baseline) return;
      if (!allowNegative && next < 0) return;
      onChange(next);
    },
    [value, stepValue, clamp, onChange, allowNegative]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (canIncrement) handleStep(1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (canDecrement) handleStep(-1);
      }
    },
    [handleStep, canIncrement, canDecrement]
  );

  const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && (
            <span className="ml-1 text-danger-500 dark:text-danger-400" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className="relative flex items-stretch">
        {showSteppers && (
          <button
            type="button"
            onClick={() => handleStep(-1)}
            disabled={disabled || !canDecrement}
            aria-label={`Decrease ${label ?? "value"}`}
            className={cn(
              "flex items-center justify-center px-3 rounded-l-xl border border-r-0 border-[var(--card-border)]",
              "bg-[var(--muted-bg)] text-[var(--muted)] shrink-0",
              "hover:bg-surface-100 dark:hover:bg-surface-800/50 transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--muted-bg)]"
            )}
          >
            <Minus size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        )}

        {leftIcon && !showSteppers && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500">
            {leftIcon}
          </div>
        )}

        <input
          {...rest}
          ref={ref}
          id={id}
          type="number"
          role="spinbutton"
          inputMode={inputMode}
          disabled={disabled}
          placeholder={placeholder}
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value ?? undefined}
          min={min}
          max={max}
          step={step}
          className={cn(
            "input flex-1 min-w-0 tabular-nums",
            showSteppers && "rounded-none border-x-0 text-center",
            !showSteppers && unit && "rounded-r-none",
            !showSteppers && leftIcon && "pl-10",
            error &&
              "border-danger-500 dark:border-danger-500 focus-visible:ring-danger-500/50 focus-visible:border-danger-500",
            inputClassName
          )}
        />

        {showSteppers ? (
          <button
            type="button"
            onClick={() => handleStep(1)}
            disabled={disabled || !canIncrement}
            aria-label={`Increase ${label ?? "value"}`}
            className={cn(
              "flex items-center justify-center px-3 rounded-r-xl border border-l-0 border-[var(--card-border)]",
              "bg-[var(--muted-bg)] text-[var(--muted)] shrink-0",
              "hover:bg-surface-100 dark:hover:bg-surface-800/50 transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--muted-bg)]"
            )}
          >
            <Plus size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          unit && (
            <div className="flex items-center px-3 rounded-r-xl border border-l-0 border-[var(--card-border)] bg-[var(--muted-bg)] text-sm text-[var(--muted)] shrink-0">
              {unit}
            </div>
          )
        )}
      </div>

      {error && (
        <p
          id={`${id}-error`}
          className="text-xs text-danger-500 dark:text-danger-400 flex items-center gap-1.5"
        >
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </p>
      )}
      {!error && helper && (
        <p id={`${id}-helper`} className="text-xs text-muted">
          {helper}
        </p>
      )}
    </div>
  );
});
