"use client";

import { useState, useEffect, useCallback } from "react";
import {
  cacheVideo,
  removeCachedVideo,
  isVideoCached,
} from "@/lib/pwa/video-cache";
import { useToast } from "@/components/ui/Toast";
import { Download, Check, Trash2, Loader2 } from "lucide-react";

interface OfflineVideoButtonProps {
  videoId: string;
  videoUrl: string;
  title: string;
  fileSizeMb?: number;
}

export function OfflineVideoButton({
  videoId,
  videoUrl,
  title,
  fileSizeMb = 0,
}: OfflineVideoButtonProps) {
  const [state, setState] = useState<
    "loading" | "idle" | "downloading" | "cached" | "removing"
  >("loading");
  const [progress, setProgress] = useState(0);
  const { success, error: showError } = useToast();

  // Check cache status on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("caches" in window)) {
      setState("idle");
      return;
    }
    isVideoCached(videoId).then((cached) => {
      setState(cached ? "cached" : "idle");
    });
  }, [videoId]);

  const handleDownload = useCallback(async () => {
    setState("downloading");
    setProgress(0);
    try {
      await cacheVideo(videoId, videoUrl, title, fileSizeMb, (pct) => {
        setProgress(pct);
      });
      setState("cached");
      success("Video saved offline", `"${title}" is available offline`);
    } catch (err) {
      setState("idle");
      showError(
        "Download failed",
        err instanceof Error ? err.message : "Could not cache video"
      );
    }
  }, [videoId, videoUrl, title, fileSizeMb, success, showError]);

  const handleRemove = useCallback(async () => {
    setState("removing");
    try {
      await removeCachedVideo(videoId);
      setState("idle");
      success("Removed", `"${title}" removed from offline storage`);
    } catch {
      setState("cached");
      showError("Error", "Could not remove cached video");
    }
  }, [videoId, title, success, showError]);

  // Don't render if Cache API not available
  if (typeof window !== "undefined" && !("caches" in window)) return null;

  if (state === "loading") return null;

  if (state === "cached") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
          <Check size={10} strokeWidth={3} />
          Offline
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleRemove();
          }}
          className="p-1 rounded-md text-[var(--color-text-3)] hover:text-red-500 dark:hover:text-red-400 transition-colors"
          title="Remove offline copy"
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  }

  if (state === "downloading") {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
        <div className="relative w-16 h-1.5 rounded-full bg-[var(--color-bg-subtle)] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-amber-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] text-[var(--color-text-3)] tabular-nums font-mono">
          {progress}%
        </span>
      </div>
    );
  }

  if (state === "removing") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-[var(--color-text-3)]">
        <Loader2 size={10} className="animate-spin" />
        Removing…
      </span>
    );
  }

  // idle
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleDownload();
      }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-[var(--color-text-3)] hover:text-[var(--color-gold-dark)] dark:hover:text-[var(--color-gold)] hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
      title={`Save offline${fileSizeMb ? ` (${fileSizeMb.toFixed(1)} MB)` : ""}`}
    >
      <Download size={10} />
      Save Offline
    </button>
  );
}
