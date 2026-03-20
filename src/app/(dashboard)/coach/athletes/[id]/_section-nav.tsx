"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "overview",  label: "Overview"  },
  { id: "training",  label: "Training"  },
  { id: "throws",    label: "Throws"    },
  { id: "readiness", label: "Readiness" },
  { id: "wellness",  label: "Wellness"  },
  { id: "goals",     label: "Goals"     },
];

export function SectionNav({ initialSection }: { initialSection?: string }) {
  const [active, setActive] = useState(initialSection ?? "overview");
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Scroll to initial section on mount (backwards compat for ?tab= links)
  useEffect(() => {
    if (initialSection && initialSection !== "overview") {
      const el = document.getElementById(initialSection);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        window.history.replaceState(null, "", `${window.location.pathname}#${initialSection}`);
      }
    }
  }, [initialSection]);

  // IntersectionObserver for scroll spy
  useEffect(() => {
    const elements = SECTIONS
      .map((s) => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];
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

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      window.history.replaceState(null, "", `${window.location.pathname}#${id}`);
    }
  }

  return (
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
  );
}
