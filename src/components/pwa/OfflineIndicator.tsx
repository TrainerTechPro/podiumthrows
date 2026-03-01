"use client";

import { useOnlineStatus } from "@/lib/pwa/online-status";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-14 left-0 right-0 z-30 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600/95 dark:bg-amber-700/95 text-white text-xs font-medium backdrop-blur-sm animate-spring-up">
      <WifiOff size={14} strokeWidth={2.5} />
      <span>
        You&apos;re offline — changes will sync when reconnected
      </span>
    </div>
  );
}
