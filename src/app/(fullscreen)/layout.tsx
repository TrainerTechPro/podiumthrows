import { ToastProvider } from "@/components/ui/Toast";

/**
 * Fullscreen route-group layout.
 *
 * The root layout sets `viewportFit: "cover"`, so the viewport extends
 * edge-to-edge UNDER the iPhone Dynamic Island / status bar and home
 * indicator. We compensate here by padding all four sides with the
 * `safe-area-inset-*` env vars so any fullscreen page (current or future)
 * renders inside the safe area without each page having to remember.
 *
 * Bottom sheets and any other `position: fixed` overlays inside child
 * pages remain pinned to the viewport (not this padded box), so they can
 * still draw to the screen edge and apply their own bottom inset.
 */
export default function FullscreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div
        className="fixed inset-0 bg-[var(--background)] text-[var(--foreground)] overflow-hidden"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        }}
      >
        {children}
      </div>
    </ToastProvider>
  );
}
