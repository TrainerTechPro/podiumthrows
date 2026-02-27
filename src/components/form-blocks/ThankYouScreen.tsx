"use client";

import type { ThankYouScreenBlock } from "@/lib/forms/types";

interface ThankYouScreenProps {
  block: ThankYouScreenBlock;
  onDone?: () => void;
}

export function ThankYouScreen({ block, onDone }: ThankYouScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 py-12">
      <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mb-6">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-green-500"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold font-heading text-[var(--foreground)] mb-3">
        {block.title}
      </h1>
      {block.subtitle && (
        <p className="text-base text-muted max-w-md mb-8">{block.subtitle}</p>
      )}
      {(block.buttonText || block.redirectUrl) && (
        <button
          type="button"
          onClick={() => {
            if (block.redirectUrl) {
              window.location.href = block.redirectUrl;
            } else if (onDone) {
              onDone();
            }
          }}
          className="px-8 py-3 rounded-xl bg-primary-500 text-white font-semibold text-base hover:bg-primary-600 active:scale-[0.98] transition-all shadow-lg shadow-primary-500/25"
        >
          {block.buttonText || "Done"}
        </button>
      )}
    </div>
  );
}
