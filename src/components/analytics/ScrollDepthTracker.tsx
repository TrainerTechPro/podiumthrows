"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * Drop into any long editorial page to emit `scroll_depth` at 25/50/75/100.
 * Each milestone fires at most once per page load. No visible output —
 * the component returns null.
 *
 * Implementation notes:
 *   • We compute the reachable scroll distance (doc height − viewport), so
 *     a page that barely scrolls doesn't misfire 100% the instant it loads.
 *   • Scroll listener is passive — never blocks frame commits.
 *   • Honors prefers-reduced-motion only for its own behavior (no-op); it
 *     still emits, because scroll depth is data, not animation.
 *   • Pauses emits when the page is hidden (tab-switched) so background
 *     scrolls from restoration don't pollute metrics.
 */
export function ScrollDepthTracker() {
  useEffect(() => {
    const milestones: Array<25 | 50 | 75 | 100> = [25, 50, 75, 100];
    const fired = new Set<number>();

    const compute = () => {
      if (document.visibilityState !== "visible") return;

      const doc = document.documentElement;
      const reachable = doc.scrollHeight - doc.clientHeight;
      if (reachable <= 0) return;

      const percent = Math.min(100, (window.scrollY / reachable) * 100);

      for (const m of milestones) {
        if (fired.has(m)) continue;
        if (percent >= m) {
          fired.add(m);
          track("scroll_depth", { percent: m, path: window.location.pathname });
        }
      }
    };

    // Fire an initial compute on mount — a page loaded mid-scroll (back/forward
    // restoration) should still register its milestones.
    compute();

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        compute();
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    document.addEventListener("visibilitychange", compute);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", compute);
    };
  }, []);

  return null;
}
