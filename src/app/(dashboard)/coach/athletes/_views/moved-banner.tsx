"use client";

import { useState, useEffect } from "react";
import { X, Info } from "lucide-react";

const DISMISS_KEY = "h1-throws-moved-dismissed";
const EXPIRES_AT = Date.parse("2026-05-15T00:00:00Z");

export function MovedBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (Date.now() > EXPIRES_AT) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div className="rounded-xl border border-primary-500/30 bg-primary-500/10 px-4 py-3 flex items-start gap-3 animate-fade-slide-in">
      <Info
        className="w-4 h-4 text-primary-500 shrink-0 mt-0.5"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <p className="text-sm text-[var(--foreground)] leading-snug flex-1">
        Throws enrollment moved to this tab. Everything you had is still here — deficit profiles,
        testing status, and auto-import from PRs.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="p-1 text-muted hover:text-[var(--foreground)] rounded-lg"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
