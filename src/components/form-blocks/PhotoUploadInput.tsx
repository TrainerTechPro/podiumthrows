"use client";

import type { PhotoUploadBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function PhotoUploadInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<PhotoUploadBlock>) {
  const url = (value as string) ?? "";

  return (
    <div className="space-y-2">
      {block.prompt && (
        <p className="text-xs text-muted">{block.prompt}</p>
      )}
      <div className="border-2 border-dashed border-[var(--card-border)] rounded-xl p-6 text-center">
        {url ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Uploaded"
              className="mx-auto max-h-48 rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={disabled}
              className="text-xs text-red-500 hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-muted">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p className="text-sm text-muted">Photo upload</p>
            <p className="text-[10px] text-muted">
              {block.maxSizeMb ? `Max ${block.maxSizeMb}MB` : "Upload a photo"}
            </p>
            <input
              type="url"
              value={url}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Paste image URL..."
              disabled={disabled}
              className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-50"
            />
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
      )}
    </div>
  );
}
