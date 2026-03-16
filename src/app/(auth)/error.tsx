"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AuthError({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="card p-8 text-center space-y-5">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      {/* Copy */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">
          Something went wrong
        </h2>
        <p className="text-sm text-muted">
          We couldn&apos;t load this page. Please try again.
          {error.digest && (
            <span className="block mt-1 font-mono text-xs opacity-60">
              Error ID: {error.digest}
            </span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--card-border)] text-sm font-medium text-[var(--foreground)] hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
