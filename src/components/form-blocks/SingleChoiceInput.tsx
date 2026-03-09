"use client";

import { useState } from "react";
import type { SingleChoiceBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function SingleChoiceInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<SingleChoiceBlock>) {
  const [otherText, setOtherText] = useState("");
  const options = block.randomize
    ? [...block.options].sort(() => Math.random() - 0.5)
    : block.options;

  const errorId = error ? `sc-error-${block.id}` : undefined;

  return (
    <fieldset
      className="space-y-2"
      aria-describedby={errorId}
    >
      {block.label && (
        <legend className="sr-only">{block.label}</legend>
      )}

      <div role="radiogroup" aria-label={block.label || "Choose one"} className="space-y-2">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => !disabled && onChange(opt.value)}
              disabled={disabled}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                selected
                  ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30"
                  : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-primary-500/50"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                  selected
                    ? "border-primary-500 bg-primary-500"
                    : "border-[var(--card-border)]"
                }`}
                aria-hidden="true"
              />
              <span className="min-w-0 break-words">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {block.allowOther && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="radio"
            aria-checked={typeof value === "string" && !block.options.some((o) => o.value === value)}
            onClick={() => !disabled && onChange(otherText || "__other__")}
            disabled={disabled}
            aria-label="Other option"
            className={`shrink-0 w-4 h-4 rounded-full border-2 ${
              typeof value === "string" &&
              !block.options.some((o) => o.value === value)
                ? "border-primary-500 bg-primary-500"
                : "border-[var(--card-border)]"
            }`}
          />
          <input
            type="text"
            value={otherText}
            onChange={(e) => {
              setOtherText(e.target.value);
              if (e.target.value) onChange(e.target.value);
            }}
            placeholder="Other..."
            disabled={disabled}
            aria-label="Other answer"
            className="flex-1 px-3 py-2 rounded-lg text-sm border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 disabled:opacity-50"
          />
        </div>
      )}

      {error && (
        <p id={errorId} className="text-xs text-danger-500 dark:text-danger-400" role="alert">{error}</p>
      )}
    </fieldset>
  );
}
