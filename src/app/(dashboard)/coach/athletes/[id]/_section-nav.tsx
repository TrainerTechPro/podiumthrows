"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "training", label: "Training" },
  { id: "throws", label: "Throws" },
  { id: "performance", label: "Performance" },
  { id: "readiness", label: "Readiness" },
  { id: "wellness", label: "Wellness" },
  { id: "feedback", label: "Feedback" },
  { id: "goals", label: "Goals" },
  { id: "insights", label: "Insights" },
];

export function SectionNav({ initialSection }: { initialSection?: string }) {
  const [active, setActive] = useState(initialSection ?? "overview");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const mobileBarRef = useRef<HTMLDivElement>(null);

  // Scroll to initial section on mount (backwards compat for ?tab= links and
  // deep-link via hash). Hash takes precedence — both are valid entry points
  // from the dashboard's action queue or an email link.
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    const target =
      hash && SECTIONS.some((s) => s.id === hash)
        ? hash
        : initialSection && initialSection !== "overview"
          ? initialSection
          : null;
    if (target) {
      const el = document.getElementById(target);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        window.history.replaceState(null, "", `${window.location.pathname}#${target}`);
      }
    }
  }, [initialSection]);

  // IntersectionObserver scroll spy keeps the active section in sync with
  // what the coach is actually reading, so a mid-page link click from the
  // dashboard sets the right chip.
  useEffect(() => {
    const elements = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      Boolean
    ) as HTMLElement[];
    if (elements.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    elements.forEach((el) => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  }, []);

  // When the active chip changes, scroll the mobile chip bar so it's
  // visible — otherwise a coach reading section 6 sees "Overview" stuck
  // off-screen left.
  useEffect(() => {
    const bar = mobileBarRef.current;
    if (!bar) return;
    const chip = bar.querySelector<HTMLElement>(`[data-section-id="${active}"]`);
    if (chip) {
      chip.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [active]);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      window.history.replaceState(null, "", `${window.location.pathname}#${id}`);
    }
  }

  return (
    <>
      {/* Mobile / tablet sticky chip bar — for coach sideline use. Sits
          just below the top bar; horizontal scroll snaps each chip to
          center. Hidden on desktop where the right-rail nav is more
          appropriate for reading flow. */}
      <nav
        ref={mobileBarRef}
        aria-label="Section navigation"
        className="lg:hidden -mx-4 sm:-mx-6 sticky top-0 z-10 bg-[var(--background)] border-b border-[var(--card-border)] overflow-x-auto custom-scrollbar"
      >
        <ul className="flex gap-1 px-4 sm:px-6 py-2 min-w-max">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                data-section-id={s.id}
                onClick={() => scrollTo(s.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                  active === s.id
                    ? "bg-[var(--color-brand-subtle)] text-[var(--color-brand-strong)]"
                    : "text-muted hover:text-[var(--foreground)]"
                )}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Desktop: fixed right-rail vertical index. The coach uses this for
          reference reading; mobile chips would crowd the sideline view. */}
      <nav
        className="hidden lg:block fixed right-8 top-1/2 -translate-y-1/2 z-10"
        aria-label="Section navigation"
      >
        <ul className="space-y-0.5">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => scrollTo(s.id)}
                className={cn(
                  "block text-xs px-3 py-1.5 rounded-lg transition-colors text-left w-full",
                  active === s.id
                    ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/15 font-medium"
                    : "text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300"
                )}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
