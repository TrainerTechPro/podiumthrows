"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

interface SaveResumeBarProps {
  questionnaireId: string;
  answers: Record<string, unknown>;
  enabled: boolean;
}

export function SaveResumeBar({
  questionnaireId,
  answers,
  enabled,
}: SaveResumeBarProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedRef = useRef<string>("");

  const saveDraft = useCallback(async () => {
    const serialized = JSON.stringify(answers);
    if (serialized === lastSavedRef.current) return;

    setStatus("saving");
    try {
      const res = await fetch(
        `/api/athlete/questionnaires/${questionnaireId}/draft`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ draftAnswers: answers }),
        }
      );
      if (res.ok) {
        lastSavedRef.current = serialized;
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }, [questionnaireId, answers]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!enabled) return;
    timerRef.current = setInterval(saveDraft, 30000);
    return () => clearInterval(timerRef.current);
  }, [enabled, saveDraft]);

  // Save on unmount
  useEffect(() => {
    if (!enabled) return;
    return () => {
      saveDraft();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled || status === "idle") return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)] shadow-card text-xs text-muted flex items-center gap-2 animate-fade-in">
      {status === "saving" && (
        <>
          <div className="w-3 h-3 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          <span>Saving draft...</span>
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
      {status === "error" && (
        <span className="text-danger-500">Failed to save draft</span>
      )}
    </div>
  );
}
