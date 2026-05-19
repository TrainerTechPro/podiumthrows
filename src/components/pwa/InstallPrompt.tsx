"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import {
  migrateLegacyKeys,
  shouldShowInstallPrompt,
  markDismissed,
  markInstalled,
} from "@/lib/pwa/install-counters";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android" | "ios-safari" | "ios-other" | "desktop" | "unsupported";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unsupported";
  const ua = navigator.userAgent;
  const isiOS =
    /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome/.test(ua);

  if (isiOS && isSafari) return "ios-safari";
  if (isiOS) return "ios-other";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function InstallPrompt() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("unsupported");
  const [canInstall, setCanInstall] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  // Athlete-only. Coaches install rarely and from desktop; per CLAUDE.md
  // §Dual Product Identity, the athlete app is the install target.
  //
  // Auto-open is restricted to /athlete/dashboard — the "between-actions"
  // moment when the athlete just landed on home. Action routes (log-session,
  // quick-start, wellness, onboarding, the live training session) are mid-
  // task; popping a modal there steals focus from the primary action. The
  // browser-volunteered prompt still gets captured everywhere on /athlete,
  // so users who DO want to install via the address-bar icon are unaffected.
  const isAthleteRoute = pathname?.startsWith("/athlete/") ?? false;
  const isAutoOpenRoute = pathname === "/athlete/dashboard";

  useEffect(() => {
    if (!isAthleteRoute) return;
    migrateLegacyKeys();

    const detected = detectPlatform();
    setPlatform(detected);

    // iOS Safari has no `beforeinstallprompt` — show the share-button guide
    // directly when the gates pass AND we're on the landing/home route.
    if (detected === "ios-safari") {
      if (isAutoOpenRoute && shouldShowInstallPrompt()) setOpen(true);
      return;
    }

    // Android / desktop Chromium — wait for the browser to volunteer install.
    // Capture and defer so we can present our own UI.
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
      if (isAutoOpenRoute && shouldShowInstallPrompt()) setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Browser fired `appinstalled` — record + suppress forever.
    const installedHandler = () => {
      markInstalled();
      setOpen(false);
      deferredPromptRef.current = null;
      setCanInstall(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, [isAthleteRoute, isAutoOpenRoute]);

  const handleInstall = useCallback(async () => {
    const deferred = deferredPromptRef.current;
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      markInstalled();
    } else {
      markDismissed();
    }
    deferredPromptRef.current = null;
    setCanInstall(false);
    setOpen(false);
  }, []);

  const handleDismiss = useCallback(() => {
    markDismissed();
    setOpen(false);
  }, []);

  if (!isAthleteRoute || !open) return null;

  return (
    <Sheet
      open={open}
      onClose={handleDismiss}
      side="bottom"
      size="sm"
      title="Add Podium to your home screen"
      description="Open instantly. Log offline. Never miss a session."
    >
      <div className="flex items-center gap-4 mb-5">
        <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
          <span className="font-heading text-xl font-bold text-surface-950">P</span>
        </div>
        <div className="text-sm text-muted leading-relaxed">
          Installed apps launch faster, work offline, and live on your home screen — same as any
          native app.
        </div>
      </div>

      {platform === "ios-safari" && <IosSafariInstructions onDismiss={handleDismiss} />}
      {platform === "ios-other" && <IosOtherInstructions onDismiss={handleDismiss} />}
      {(platform === "android" || platform === "desktop") && (
        <AndroidDesktopActions
          onInstall={handleInstall}
          onDismiss={handleDismiss}
          canInstall={canInstall}
        />
      )}
    </Sheet>
  );
}

function IosSafariInstructions({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2.5 text-sm text-[var(--foreground)]">
        <Step number={1}>
          Tap the <ShareIcon /> Share button at the bottom of Safari
        </Step>
        <Step number={2}>
          Scroll down and tap <em className="font-medium not-italic">Add to Home Screen</em>{" "}
          <Plus
            size={14}
            strokeWidth={1.75}
            className="inline align-middle text-muted"
            aria-hidden="true"
          />
        </Step>
        <Step number={3}>Tap Add — Podium will live next to your other apps</Step>
      </ol>
      <button type="button" onClick={onDismiss} className="btn-secondary text-sm py-2.5 mt-2">
        Got it
      </button>
    </div>
  );
}

function IosOtherInstructions({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted leading-relaxed">
        Install only works in Safari on iOS. Open Podium in Safari, then use{" "}
        <span className="inline-flex items-center gap-1 text-[var(--foreground)]">
          <ShareIcon /> Share → Add to Home Screen
        </span>
        .
      </p>
      <button type="button" onClick={onDismiss} className="btn-secondary text-sm py-2.5 mt-2">
        Got it
      </button>
    </div>
  );
}

function AndroidDesktopActions({
  onInstall,
  onDismiss,
  canInstall,
}: {
  onInstall: () => void;
  onDismiss: () => void;
  canInstall: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={onDismiss} className="flex-1 btn-secondary text-sm py-2.5">
        Not now
      </button>
      <button
        type="button"
        onClick={onInstall}
        disabled={!canInstall}
        className="flex-1 btn-primary text-sm py-2.5 inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Download size={16} strokeWidth={1.75} aria-hidden="true" />
        Install
      </button>
    </div>
  );
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-500/15 text-primary-500 font-mono text-[11px] font-semibold">
        {number}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function ShareIcon() {
  return (
    <Share
      size={14}
      strokeWidth={1.75}
      className="inline align-middle text-[#007AFF]"
      aria-hidden="true"
    />
  );
}
