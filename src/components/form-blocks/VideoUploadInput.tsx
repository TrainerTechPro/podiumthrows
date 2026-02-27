"use client";

import type { VideoUploadBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

export function VideoUploadInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<VideoUploadBlock>) {
  const url = (value as string) ?? "";

  return (
    <div className="space-y-2">
      {block.prompt && (
        <p className="text-xs text-muted">{block.prompt}</p>
      )}
      <div className="border-2 border-dashed border-[var(--card-border)] rounded-xl p-6 text-center">
        {url ? (
          <div className="space-y-2">
            <video
              src={url}
              controls
              className="mx-auto max-h-48 rounded-lg"
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
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="7" y2="7" />
              <line x1="2" y1="17" x2="7" y2="17" />
              <line x1="17" y1="7" x2="22" y2="7" />
              <line x1="17" y1="17" x2="22" y2="17" />
            </svg>
            <p className="text-sm text-muted">Video upload</p>
            <p className="text-[10px] text-muted">
              {block.maxSizeMb ? `Max ${block.maxSizeMb}MB` : "Upload a video"}
            </p>
            <input
              type="url"
              value={url}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Paste video URL..."
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
