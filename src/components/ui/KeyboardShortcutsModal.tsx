"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { Search, HelpCircle } from "lucide-react";
import { Modal } from "./Modal";

const OPEN_EVENT = "podium:open-shortcuts";

export function openKeyboardShortcuts() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

interface Shortcut {
  /** Each entry is one key in the chord (rendered with `+` between). */
  keys: string[];
  label: string;
}

interface ShortcutGroup {
  title: string;
  icon: ReactNode;
  items: Shortcut[];
}

// Resolve modifier glyph at module scope — the platform doesn't change at runtime.
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

const ICON_PROPS = { size: 13, strokeWidth: 1.75, "aria-hidden": true } as const;

const GROUPS: ShortcutGroup[] = [
  {
    title: "Search",
    icon: <Search {...ICON_PROPS} />,
    items: [
      { keys: [MOD, "K"], label: "Open command palette" },
      { keys: ["Tab"], label: "Cycle category filter" },
      { keys: ["↑", "↓"], label: "Move between results" },
      { keys: ["↩"], label: "Open the highlighted result" },
      { keys: [MOD, "↩"], label: "See all matches in content" },
    ],
  },
  {
    title: "General",
    icon: <HelpCircle {...ICON_PROPS} />,
    items: [
      { keys: ["?"], label: "Show keyboard shortcuts" },
      { keys: ["Esc"], label: "Close any dialog or overlay" },
    ],
  },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Only trigger on a bare "?" — skip when modifier keys are held so we
      // don't intercept browser shortcuts like ⌘? (Help).
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      setOpen(true);
    }
    function onCustomOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onCustomOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onCustomOpen);
    };
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return (
    <Modal open={open} onClose={close} title="Keyboard shortcuts" size="md">
      <div className="space-y-5">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <span className="text-surface-400">{group.icon}</span>
              {group.title}
            </h3>
            <ul className="divide-y divide-[var(--card-border)]/40">
              {group.items.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="text-sm text-[var(--foreground)]">{item.label}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {item.keys.map((k, i) => (
                      <span key={`${item.label}-${i}`} className="flex items-center gap-1">
                        {i > 0 && (
                          <span className="text-[10px] text-surface-400" aria-hidden="true">
                            +
                          </span>
                        )}
                        <kbd className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded text-[11px] font-mono font-medium text-[var(--foreground)] bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                          {k}
                        </kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="text-xs text-muted pt-2 border-t border-[var(--card-border)]/40">
          Press{" "}
          <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium text-[var(--foreground)] bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
            ?
          </kbd>{" "}
          anywhere outside an input to open this panel.
        </p>
      </div>
    </Modal>
  );
}
