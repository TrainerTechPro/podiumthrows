import { ToastProvider } from "@/components/ui/Toast";

export default function FullscreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="fixed inset-0 bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
        {children}
      </div>
    </ToastProvider>
  );
}
