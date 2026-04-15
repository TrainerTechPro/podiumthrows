"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function PrintActions({ backHref }: { backHref: string }) {
  return (
    <div className="no-print flex items-center gap-3 mb-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        Back to programming
      </Link>

      <button
        type="button"
        onClick={() => window.print()}
        className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
      >
        <Printer size={16} strokeWidth={1.75} aria-hidden="true" />
        Print
      </button>
    </div>
  );
}
