"use client";

/**
 * Floating beta-feedback button + modal. Mounted once per (dashboard)
 * layout (coach + athlete separately, since they have independent
 * layouts). Opens a modal where the tester picks a type, writes a
 * message, and optionally pastes/selects a screenshot. On submit, posts
 * to /api/feedback/beta with auto-captured page context.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  X,
  Bug,
  HelpCircle,
  Lightbulb,
  Heart,
  Image as ImageIcon,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import {
  installConsoleErrorCollector,
  getRecentConsoleErrors,
} from "@/lib/feedback/console-errors";
import { isFocusMode } from "@/components/layout/DashboardLayout";

type FeedbackType = "BUG" | "CONFUSION" | "FEATURE" | "PRAISE";

const TYPE_OPTIONS: Array<{
  id: FeedbackType;
  label: string;
  icon: typeof Bug;
  description: string;
}> = [
  { id: "BUG", label: "Bug", icon: Bug, description: "Something broke" },
  { id: "CONFUSION", label: "Confusing", icon: HelpCircle, description: "Unclear UI" },
  { id: "FEATURE", label: "Idea", icon: Lightbulb, description: "Feature request" },
  { id: "PRAISE", label: "Praise", icon: Heart, description: "This works great" },
];

export function BetaFeedbackButton() {
  const pathname = usePathname();
  const toast = useToast();

  // Hide on focused-task routes (log-session, onboarding, self-program create).
  // These flows have their own sticky save chrome; a floating feedback button
  // stacks awkwardly with it and the iOS keyboard. Feedback is still reachable
  // from every other screen. Hooks below still run to keep order stable.
  const hidden = isFocusMode(pathname);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("BUG");
  const [body, setBody] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Install the error collector once per page load so we have errors ready
  // when a user opens the modal, not just from the moment they open it.
  useEffect(() => {
    installConsoleErrorCollector();
  }, []);

  // Autofocus the textarea when the modal opens
  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const reset = useCallback(() => {
    setType("BUG");
    setBody("");
    setScreenshot(null);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Reset *after* the close animation to avoid a flicker
    setTimeout(reset, 300);
  }, [reset]);

  function handleFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Screenshot must be an image");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image over 15MB — try a smaller crop");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setScreenshot(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) {
      e.preventDefault();
      const file = item.getAsFile();
      handleFile(file);
    }
  }

  async function handleSubmit() {
    if (body.trim().length === 0) {
      toast.error("Please describe what happened first");
      return;
    }
    setSubmitting(true);
    try {
      const viewport =
        typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : null;
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;
      const consoleErrors = getRecentConsoleErrors();
      const res = await fetch("/api/feedback/beta", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          type,
          body: body.trim(),
          url: pathname ?? (typeof window !== "undefined" ? window.location.pathname : ""),
          userAgent,
          viewport,
          consoleErrors: consoleErrors.length > 0 ? consoleErrors : null,
          screenshot: screenshot ?? null,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        toast.error(payload?.error || "Couldn't submit. Please try again.");
        return;
      }
      toast.success("Thanks! Your feedback was logged.");
      close();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (hidden) return null;

  return (
    <>
      {/* Floating trigger — bottom-left. Vertical offset reads from the
          --fab-bottom-mobile / --fab-bottom-desktop CSS vars so the shell
          can control it: the athlete shell lifts the button above the
          BottomTabBar; the coach shell keeps the legacy offsets. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="fixed left-4 z-40 flex items-center gap-2 px-3 py-2 rounded-full bg-primary-500 text-black shadow-lg hover:scale-[1.03] active:scale-[0.97] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
        style={{
          bottom: "var(--fab-bottom, 1rem)",
        }}
      >
        <MessageSquare size={16} strokeWidth={2} aria-hidden="true" />
        <span className="text-sm font-semibold hidden sm:inline">Feedback</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Send feedback"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-[var(--surface-overlay)] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-fade-slide-in"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--card-border)]">
              <h2 className="text-base font-semibold text-[var(--foreground)]">Send feedback</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="p-1 rounded-lg text-muted hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                <X size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Type selector */}
              <div className="grid grid-cols-4 gap-2">
                {TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = opt.id === type;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setType(opt.id)}
                      className={[
                        "flex flex-col items-center gap-1 px-2 py-3 rounded-lg border text-xs font-medium transition-colors",
                        active
                          ? "border-primary-500 bg-primary-500/10 text-primary-700 dark:text-primary-400"
                          : "border-[var(--card-border)] text-muted hover:border-[var(--color-border-strong)] hover:text-[var(--foreground)]",
                      ].join(" ")}
                      aria-pressed={active}
                    >
                      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted -mt-2">
                {TYPE_OPTIONS.find((o) => o.id === type)?.description}
              </p>

              {/* Textarea */}
              <div>
                <label htmlFor="beta-feedback-body" className="sr-only">
                  What happened?
                </label>
                <textarea
                  id="beta-feedback-body"
                  ref={textareaRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onPaste={handlePaste}
                  rows={4}
                  maxLength={4000}
                  placeholder={
                    type === "BUG"
                      ? "What broke? Steps to reproduce help us fix it faster."
                      : type === "CONFUSION"
                        ? "What's unclear? What did you expect vs see?"
                        : type === "FEATURE"
                          ? "What would you like to see?"
                          : "What's working well?"
                  }
                  className="input w-full resize-none text-sm"
                />
                <p className="text-[10px] text-muted text-right mt-1 tabular-nums">
                  {body.length} / 4000
                </p>
              </div>

              {/* Screenshot */}
              {screenshot ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={screenshot}
                    alt="Screenshot attached"
                    className="w-full max-h-40 object-contain rounded-lg border border-[var(--card-border)]"
                  />
                  <button
                    type="button"
                    onClick={() => setScreenshot(null)}
                    aria-label="Remove screenshot"
                    className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 text-white hover:bg-black/80"
                  >
                    <X size={12} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-[var(--card-border)] text-xs text-muted hover:border-primary-500/40 hover:text-primary-500 transition-colors"
                  >
                    <ImageIcon size={14} strokeWidth={1.75} aria-hidden="true" />
                    Attach screenshot (or paste above)
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}

              {/* Disclosure — PII transparency */}
              <p className="text-[10px] text-muted leading-snug">
                We&apos;ll also send the page URL, your role, viewport size, and any recent console
                errors — these help us triage. Anything in the screenshot is your call.
              </p>
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 flex items-center gap-2">
              <button
                type="button"
                onClick={close}
                className="flex-1 py-2 px-3 rounded-xl text-sm font-medium text-muted hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || body.trim().length === 0}
                className="flex-1 py-2 px-3 rounded-xl text-sm font-semibold bg-primary-500 text-black hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Sending…" : "Send feedback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
