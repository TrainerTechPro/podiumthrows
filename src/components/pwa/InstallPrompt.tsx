"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Download, Share } from "lucide-react";

const DISMISS_KEY = "pwa-install-dismissed";
const VISIT_COUNT_KEY = "pwa-visit-count";
const DISMISS_DAYS = 30;
const MIN_VISITS = 2;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Skip if already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((navigator as { standalone?: boolean }).standalone === true) return;

    // Track visits
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || "0", 10) + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));
    if (visitCount < MIN_VISITS) return;

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const daysSince =
        (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_DAYS) return;
    }

    // Detect iOS Safari
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as { MSStream?: unknown }).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Chrome/.test(ua);
    if (isiOS && isSafari) {
      setIsIOS(true);
      setShow(true);
      return;
    }

    // Android / Desktop Chrome — intercept beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPromptRef.current) return;
    await deferredPromptRef.current.prompt();
    const { outcome } = await deferredPromptRef.current.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    deferredPromptRef.current = null;
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe animate-spring-up">
      <div className="mx-auto max-w-md rounded-2xl border border-amber-200/20 dark:border-amber-700/30 bg-[var(--card-bg)]/95 backdrop-blur-xl shadow-2xl shadow-black/20">
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* App icon */}
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-lg font-bold text-white">P</span>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Install Podium Throws
              </h3>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">
                {isIOS
                  ? "Add to your home screen for offline access and a full-screen experience."
                  : "Get instant access, offline support, and a native app experience."}
              </p>
            </div>

            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1.5 rounded-lg text-muted hover:text-surface-700 dark:hover:text-surface-300 hover:bg-[var(--muted-bg)] transition-colors"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            {isIOS ? (
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--muted-bg)] text-xs text-surface-700 dark:text-surface-300">
                <span>Tap</span>
                <Share size={14} className="text-[#007AFF]" />
                <span>then &quot;Add to Home Screen&quot;</span>
              </div>
            ) : (
              <>
                <button
                  onClick={handleDismiss}
                  className="flex-1 btn-secondary text-xs py-2"
                >
                  Not now
                </button>
                <button
                  onClick={handleInstall}
                  className="flex-1 btn-primary text-xs py-2 flex items-center justify-center gap-1.5"
                >
                  <Download size={14} />
                  Install
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
