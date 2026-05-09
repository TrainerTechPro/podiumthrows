"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type HtmlInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "size"
>;

export type DateInputVariant = "date" | "datetime-local" | "time";

export interface DateInputProps extends HtmlInputProps {
  /** ISO date string (YYYY-MM-DD for date, YYYY-MM-DDTHH:MM for datetime-local, HH:MM for time). */
  value: string | null;
  onChange: (next: string | null) => void;
  variant?: DateInputVariant;
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  /** Override classes on the inner <input>. */
  inputClassName?: string;
  className?: string;
  id?: string;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  {
    value,
    onChange,
    variant = "date",
    label,
    helper,
    error,
    required,
    disabled,
    placeholder,
    id: externalId,
    className,
    inputClassName,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  const errorId = error ? `${id}-error` : undefined;
  const helperId = !error && helper ? `${id}-helper` : undefined;
  const describedBy = errorId ?? helperId;

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

      <input
        {...rest}
        ref={ref}
        id={id}
        type={variant}
        value={value ?? ""}
        onChange={(e) => {
          if (disabled) return;
          const raw = e.target.value;
          onChange(raw === "" ? null : raw);
        }}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "input w-full",
          error &&
            "border-danger-500 dark:border-danger-500 focus-visible:ring-danger-500/50 focus-visible:border-danger-500",
          inputClassName
        )}
      />

      {error && (
        <p
          id={errorId}
          className="text-xs text-danger-500 dark:text-danger-400 flex items-center gap-1.5"
        >
          <AlertCircle size={12} aria-hidden="true" />
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
});
