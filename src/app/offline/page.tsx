import type { Metadata } from "next";
import Link from "next/link";
import { CloudOff } from "lucide-react";
import { OfflineRetryButton } from "./OfflineRetryButton";

export const metadata: Metadata = {
  title: "Offline — Podium Throws",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-[var(--background)] text-[var(--foreground)]">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500/10">
          <CloudOff size={32} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
        </div>

        <h1 className="text-2xl font-semibold mb-3">You&apos;re offline</h1>

        <p className="text-sm text-muted leading-relaxed mb-8">
          No connection right now. Anything you logged is queued — it&apos;ll sync the moment
          you&apos;re back online.
        </p>

        <div className="flex flex-col gap-2">
          <OfflineRetryButton />
          <Link
            href="/athlete/dashboard"
            className="text-sm text-muted hover:text-[var(--foreground)] transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
