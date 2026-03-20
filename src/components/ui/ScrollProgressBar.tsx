"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Thin fixed bar at the top of the viewport that fills based on scroll position.
 * Uses rAF for smooth 60fps updates. Only renders when the page is scrollable.
 * Respects `prefers-reduced-motion` (shows static bar at current position, no transition).
 */
export function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);
  const [scrollable, setScrollable] = useState(false);
  const rafId = useRef(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function update() {
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const maxScroll = docHeight - winHeight;

      if (maxScroll <= 0) {
        setScrollable(false);
        return;
      }

      setScrollable(true);
      setProgress(Math.min(1, window.scrollY / maxScroll));
    }

    function onScroll() {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(update);
    }

    // Initial check
    update();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update, { passive: true });

    return () => {
      cancelAnimationFrame(rafId.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!scrollable) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
          boxShadow: "0 0 8px rgba(245, 158, 11, 0.4)",
          borderRadius: "0 2px 2px 0",
          transition: reducedMotion.current ? "none" : "width 100ms ease-out",
        }}
      />
    </div>
  );
}
