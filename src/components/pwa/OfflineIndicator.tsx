"use client";

import { useOnlineStatus } from "@/lib/pwa/online-status";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="fixed left-0 right-0 z-30 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 dark:bg-amber-700 text-white text-xs font-medium animate-spring-up"
      style={{ top: "calc(3.25rem + env(safe-area-inset-top, 0px))" }}
    >
      <WifiOff size={14} strokeWidth={2.5} aria-hidden="true" />
      <span>You&apos;re offline — changes will sync when reconnected</span>
    </div>
  );
}
