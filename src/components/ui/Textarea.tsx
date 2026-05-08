"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type HtmlTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "rows"
>;

export interface TextareaProps extends HtmlTextareaProps {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  /** Fixed row count when autoResize is false. Default 4. */
  rows?: number;
  /** Grow with content between minRows and maxRows. */
  autoResize?: boolean;
  /** Minimum rows when autoResize is true. Default 1. */
  minRows?: number;
  /** Maximum rows when autoResize is true. Default 8. */
  maxRows?: number;
  /** Override classes on the inner <textarea>. Use for bespoke styling. */
  inputClassName?: string;
  className?: string;
  id?: string;
}

// useLayoutEffect on the client, useEffect on the server (avoids SSR warning).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    value,
    onChange,
    label,
    helper,
    error,
    required,
    rows = 4,
    autoResize = false,
    minRows = 1,
    maxRows = 8,
    maxLength,
    placeholder,
    disabled,
    id: externalId,
    className,
    inputClassName,
    ...rest
  },
  forwardedRef
) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const internalRef = useRef<HTMLTextAreaElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef]
  );

  // Auto-resize: sync height to scrollHeight, clamped to maxRows.
  useIsoLayoutEffect(() => {
    if (!autoResize) return;
    const el = internalRef.current;
    if (!el) return;
    // Read line-height from computed style; fall back to 20px.
    const cs = window.getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || 20;
    const paddingY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const borderY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    const maxHeight = lineHeight * maxRows + paddingY + borderY;

    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, autoResize, maxRows]);

  const showCounter = typeof maxLength === "number";
  const remaining = showCounter ? Math.max(0, maxLength - value.length) : null;
  // Warn at 90% used or 10 chars left, whichever comes first.
  const atLimit =
    showCounter && (value.length >= maxLength * 0.9 || (maxLength > 10 && remaining! <= 10));

  const errorId = error ? `${id}-error` : undefined;
  const helperId = !error && helper ? `${id}-helper` : undefined;
  const counterId = showCounter ? `${id}-counter` : undefined;
  const describedBy = [errorId, helperId, counterId].filter(Boolean).join(" ") || undefined;

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

      <textarea
        {...rest}
        ref={setRefs}
        id={id}
        rows={autoResize ? minRows : rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "input w-full",
          autoResize && "resize-none",
          error &&
            "border-danger-500 dark:border-danger-500 focus-visible:ring-danger-500/50 focus-visible:border-danger-500",
          inputClassName
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
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
        {showCounter && (
          <p
            id={counterId}
            data-counter
            data-at-limit={atLimit ? "true" : "false"}
            className={cn(
              "text-xs tabular-nums shrink-0",
              atLimit ? "text-warning-500" : "text-muted"
            )}
          >
            {remaining} character{remaining === 1 ? "" : "s"} remaining
          </p>
        )}
      </div>
    </div>
  );
});
