"use client";

import { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AthleteError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[AthleteError]", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-5">

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
          <svg
            width="28"
            height="28"
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
          <h1 className="text-xl font-bold font-heading text-[var(--foreground)]">
            Something went wrong
          </h1>
          <p className="text-sm text-muted">
            An unexpected error occurred loading this page.
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-4" />
            </svg>
            Try again
          </button>

          <Link
            href="/athlete/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--card-border)] text-sm font-medium text-[var(--foreground)] hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
