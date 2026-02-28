"use client";

/**
 * Legacy toast compatibility layer.
 * Re-exports useToast from the canonical Toast provider with a
 * simplified `toast(message, type?)` API for backward compatibility.
 */

import { useToast as useNewToast } from "@/components/ui/Toast";

export { ToastProvider } from "@/components/ui/Toast";

export function useToast() {
  const ctx = useNewToast();

  function toast(message: string, type: "success" | "info" | "warning" | "error" = "success") {
    switch (type) {
      case "success": ctx.success(message); break;
      case "error":   ctx.error(message);   break;
      case "warning": ctx.warning(message); break;
      case "info":    ctx.info(message);    break;
    }
  }

  return { toast };
}
