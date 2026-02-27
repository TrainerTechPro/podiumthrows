"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

type FontSize = "default" | "large" | "xl";

interface AccessibilityContextValue {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue>({
  fontSize: "default",
  setFontSize: () => {},
  reducedMotion: false,
  setReducedMotion: () => {},
});

const STORAGE_KEY = "accessibility-prefs";

interface AccessibilityPrefs {
  fontSize: FontSize;
  reducedMotion: boolean;
}

function applyClasses(prefs: AccessibilityPrefs) {
  const html = document.documentElement;

  // Font size classes
  html.classList.remove("font-large", "font-xl");
  if (prefs.fontSize === "large") {
    html.classList.add("font-large");
  } else if (prefs.fontSize === "xl") {
    html.classList.add("font-xl");
  }

  // Reduced motion class
  if (prefs.reducedMotion) {
    html.classList.add("reduce-motion");
  } else {
    html.classList.remove("reduce-motion");
  }
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>("default");
  const [reducedMotion, setReducedMotionState] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Read from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const prefs: AccessibilityPrefs = JSON.parse(stored);
        if (prefs.fontSize) setFontSizeState(prefs.fontSize);
        if (prefs.reducedMotion !== undefined) setReducedMotionState(prefs.reducedMotion);
        applyClasses(prefs);
      }
    } catch {
      // Ignore parse errors
    }
    setMounted(true);
  }, []);

  // Apply classes and save to localStorage when preferences change (after mount)
  useEffect(() => {
    if (!mounted) return;
    const prefs: AccessibilityPrefs = { fontSize, reducedMotion };
    applyClasses(prefs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage errors
    }
  }, [fontSize, reducedMotion, mounted]);

  const setFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size);
  }, []);

  const setReducedMotion = useCallback((enabled: boolean) => {
    setReducedMotionState(enabled);
  }, []);

  return (
    <AccessibilityContext.Provider value={{ fontSize, setFontSize, reducedMotion, setReducedMotion }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  return useContext(AccessibilityContext);
}
