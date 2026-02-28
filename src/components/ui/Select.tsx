"use client";

import {
  useState,
  useRef,
  useEffect,
  useId,
  KeyboardEvent,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, X } from "lucide-react";

export interface SelectOption<T = string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectProps<T = string> {
  options: SelectOption<T>[];
  value?: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  /** Show a "clear" X button when a value is selected */
  clearable?: boolean;
  className?: string;
  id?: string;
}

export function Select<T extends string | number = string>({
  options,
  value,
  onChange,
  placeholder = "Select…",
  label,
  error,
  helper,
  required,
  disabled,
  searchable = false,
  clearable = false,
  className,
  id: externalId,
}: SelectProps<T>) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = searchable && query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.description?.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !listboxRef.current?.contains(target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* Escape key */
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setQuery(""); triggerRef.current?.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  /* Focus search when opening */
  useEffect(() => {
    if (open && searchable) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open, searchable]);

  const handleSelect = (opt: SelectOption<T>) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("" as T);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="ml-1 text-danger-500" aria-hidden="true">*</span>}
        </label>
      )}

      {/* Trigger */}
      <div className="relative">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={!!error}
          onClick={() => { if (!disabled) setOpen((v) => !v); }}
          onKeyDown={handleKeyDown}
          className={cn(
            "input w-full flex items-center justify-between text-left gap-2 cursor-pointer",
            error && "border-danger-500 focus:ring-danger-500/50 focus:border-danger-500",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className={cn("flex items-center gap-2 min-w-0 flex-1", !selected && "text-surface-400")}>
            {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
            <span className="truncate">{selected ? selected.label : placeholder}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {clearable && value && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors p-0.5 rounded"
                aria-label="Clear selection"
              >
                <X size={12} strokeWidth={2.5} aria-hidden="true" />
              </span>
            )}
            <ChevronDown
              size={14}
              strokeWidth={2.5}
              className={cn("text-surface-400 transition-transform duration-150", open && "rotate-180")}
              aria-hidden="true"
            />
          </span>
        </button>

        {/* Dropdown */}
        {open && (
          <div
            className={cn(
              "absolute z-20 mt-1.5 w-full bg-[var(--card-bg)] border border-[var(--card-border)]",
              "rounded-xl shadow-xl overflow-hidden",
              "animate-[slideDown_120ms_cubic-bezier(0.4,0,0.2,1)]"
            )}
          >
            {searchable && (
              <div className="px-2 pt-2 pb-1 border-b border-[var(--card-border)]">
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="input py-1.5 text-sm"
                  aria-label="Search options"
                />
              </div>
            )}

            <ul
              ref={listboxRef}
              role="listbox"
              aria-label={label}
              className="max-h-60 overflow-y-auto custom-scrollbar py-1"
            >
              {filtered.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted">No options found</li>
              ) : (
                filtered.map((opt) => (
                  <li
                    key={String(opt.value)}
                    role="option"
                    aria-selected={opt.value === value}
                    aria-disabled={opt.disabled}
                    onClick={() => handleSelect(opt)}
                    className={cn(
                      "flex items-start gap-3 px-3 py-2 cursor-pointer text-sm transition-colors",
                      opt.disabled && "opacity-40 cursor-not-allowed",
                      !opt.disabled &&
                        (opt.value === value
                          ? "bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300"
                          : "hover:bg-surface-100 dark:hover:bg-surface-800 text-[var(--foreground)]")
                    )}
                  >
                    {opt.icon && (
                      <span className="mt-0.5 shrink-0 text-surface-400">{opt.icon}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{opt.label}</div>
                      {opt.description && (
                        <div className="text-xs text-muted mt-0.5 truncate">{opt.description}</div>
                      )}
                    </div>
                    {opt.value === value && (
                      <span className="shrink-0 mt-0.5 text-primary-500">
                        <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
      )}
      {!error && helper && (
        <p className="text-xs text-muted">{helper}</p>
      )}
    </div>
  );
}

