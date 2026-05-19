"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

import { logger } from "@/lib/logger";
interface SaveResumeBarProps {
  questionnaireId: string;
  answers: Record<string, unknown>;
  enabled: boolean;
}

export function SaveResumeBar({ questionnaireId, answers, enabled }: SaveResumeBarProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedRef = useRef<string>("");

  // Keep the latest `answers` reachable from the unmount effect without
  // re-binding the cleanup on every keystroke. Previously the cleanup
  // closed over whatever `saveDraft` was at mount, silently losing
  // recent typing on navigate-away.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const saveDraft = useCallback(async () => {
    const current = answersRef.current;
    const serialized = JSON.stringify(current);
    if (serialized === lastSavedRef.current) return;

    setStatus("saving");
    try {
      const res = await fetch(`/api/athlete/questionnaires/${questionnaireId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ draftAnswers: current }),
      });
      if (res.ok) {
        lastSavedRef.current = serialized;
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
      }
    } catch (err) {
      logger.error("draft save failed", { context: "form-renderer/SaveResumeBar", error: err });
      setStatus("error");
    }
  }, [questionnaireId]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!enabled) return;
    timerRef.current = setInterval(saveDraft, 30000);
    return () => clearInterval(timerRef.current);
  }, [enabled, saveDraft]);

  // Save on unmount — reads `answersRef.current` so it captures the
  // athlete's latest typing even if the interval hadn't fired yet.
  useEffect(() => {
    if (!enabled) return;
    return () => {
      void saveDraft();
    };
  }, [enabled, saveDraft]);

  if (!enabled || status === "idle") return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)] shadow-card text-xs text-muted flex items-center gap-2 animate-fade-in"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {status === "saving" && (
        <>
          <div className="w-3 h-3 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          <span>Saving draft…</span>
        </>
      )}
      {status === "saved" && (
        <>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-green-500"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Draft saved</span>
        </>
      )}
      {status === "error" && <span className="text-danger-500">Failed to save draft</span>}
    </div>
  );
}
