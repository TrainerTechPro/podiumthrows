// Service Worker registration utility

export interface SWRegistrationResult {
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
}

export async function registerServiceWorker(): Promise<SWRegistrationResult> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return { registration: null, updateAvailable: false };
  }

  // Only register in production or when explicitly enabled
  const isDev = process.env.NODE_ENV === "development";
  const enableInDev = process.env.NEXT_PUBLIC_ENABLE_SW === "true";
  if (isDev && !enableInDev) {
    return { registration: null, updateAvailable: false };
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    let updateAvailable = false;

    // Check for updates
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          // New SW installed but waiting — an update is available
          updateAvailable = true;
        }
      });
    });

    return { registration, updateAvailable };
  } catch (error) {
    console.error("SW registration failed:", error);
    return { registration: null, updateAvailable: false };
  }
}

export function skipWaiting(): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage("SKIP_WAITING");
  }
}
