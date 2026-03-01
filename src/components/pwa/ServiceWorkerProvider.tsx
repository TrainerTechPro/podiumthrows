"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { registerServiceWorker } from "@/lib/pwa/register-sw";
import { useOnlineStatus } from "@/lib/pwa/online-status";
import { OfflineIndicator } from "./OfflineIndicator";
import { InstallPrompt } from "./InstallPrompt";

interface SWContextValue {
  isOnline: boolean;
  swRegistration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
}

const SWContext = createContext<SWContextValue>({
  isOnline: true,
  swRegistration: null,
  updateAvailable: false,
});

export function useSWContext(): SWContextValue {
  return useContext(SWContext);
}

export function ServiceWorkerProvider({ children }: { children: ReactNode }) {
  const { isOnline } = useOnlineStatus();
  const [swRegistration, setSwRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    registerServiceWorker().then(({ registration, updateAvailable: hasUpdate }) => {
      setSwRegistration(registration);
      if (hasUpdate) setUpdateAvailable(true);
    });

    // Listen for new SW becoming available after initial registration
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // New SW took control — page may need refresh for latest assets
      });
    }
  }, []);

  return (
    <SWContext.Provider value={{ isOnline, swRegistration, updateAvailable }}>
      {children}
      <OfflineIndicator />
      <InstallPrompt />
    </SWContext.Provider>
  );
}
