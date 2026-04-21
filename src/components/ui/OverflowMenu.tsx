"use client";

import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

export interface OverflowMenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  /** Red/destructive styling (delete, end, etc). */
  destructive?: boolean;
  /** Disable the item without removing it — keeps menu position stable. */
  disabled?: boolean;
}

interface OverflowMenuProps {
  items: OverflowMenuItem[];
  /** Accessible label for the trigger button, e.g. "Session actions". */
  ariaLabel: string;
  /** Override button size. Defaults to 32px square. */
  className?: string;
}

export function OverflowMenu({ items, ariaLabel, className }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  // Open: focus first enabled item. Close: return focus to trigger.
  useEffect(() => {
    if (!open) return;
    const firstEnabled = items.findIndex((i) => !i.disabled);
    const idx = firstEnabled < 0 ? 0 : firstEnabled;
    setFocusIdx(idx);
    itemRefs.current[idx]?.focus();
  }, [open, items]);

  // Click-outside: close the menu. Ignores clicks on the trigger because the
  // trigger's own onClick already toggles; handling it here too would re-open.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function moveFocus(direction: 1 | -1) {
    const n = items.length;
    if (n === 0) return;
    // Skip disabled items when navigating with arrows.
    let next = focusIdx;
    for (let tries = 0; tries < n; tries++) {
      next = (next + direction + n) % n;
      if (!items[next].disabled) break;
    }
    setFocusIdx(next);
    itemRefs.current[next]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveFocus(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus(-1);
      return;
    }
    if (e.key === "Tab") {
      // Tab out of the menu = close it. Let the browser move focus naturally.
      setOpen(false);
    }
  }

  return (
    <div className={`relative inline-block ${className ?? ""}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          // Card/Link parents often intercept clicks. Stop the event from
          // propagating so an overflow menu sitting inside a clickable card
          // doesn't also trigger the card's navigation.
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[var(--color-text-secondary)] hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-[var(--color-text-primary)] transition-colors"
      >
        <MoreVertical size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
          className="absolute right-0 top-full mt-1 min-w-[180px] rounded-lg border border-[var(--color-border-default)] bg-[var(--surface-overlay)] shadow-lg z-30 py-1 overflow-hidden"
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              tabIndex={focusIdx === i ? 0 : -1}
              onClick={(e) => {
                e.stopPropagation();
                if (item.disabled) return;
                setOpen(false);
                // Defer to next tick so the menu close animation doesn't
                // conflict with any dialog/toast the onSelect may open.
                setTimeout(() => item.onSelect(), 0);
              }}
              className={
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors min-h-[36px] " +
                (item.disabled
                  ? "text-[var(--color-text-secondary)] opacity-50 cursor-not-allowed"
                  : item.destructive
                    ? "text-[var(--color-status-danger-fg)] hover:bg-[var(--color-status-danger-bg)]"
                    : "text-[var(--color-text-primary)] hover:bg-surface-100 dark:hover:bg-surface-800")
              }
            >
              {item.icon && (
                <span aria-hidden="true" className="shrink-0">
                  {item.icon}
                </span>
              )}
              <span className="flex-1">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
