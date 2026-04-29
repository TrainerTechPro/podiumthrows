"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bug,
  HelpCircle,
  Lightbulb,
  Heart,
  Image as ImageIcon,
  Camera,
  Loader2,
  X,
} from "lucide-react";
import { Sheet, type SheetSide } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import { reportApiError } from "@/lib/form-errors";
import {
  installConsoleErrorCollector,
  getRecentConsoleErrors,
} from "@/lib/feedback/console-errors";

export type FeedbackType = "BUG" | "CONFUSION" | "FEATURE" | "PRAISE";

const TYPE_OPTIONS: ReadonlyArray<{
  id: FeedbackType;
  label: string;
  icon: typeof Bug;
  hint: string;
  placeholder: string;
}> = [
  {
    id: "BUG",
    label: "Bug",
    icon: Bug,
    hint: "Something broke",
    placeholder: "What broke? Steps to reproduce help us fix it faster.",
  },
  {
    id: "CONFUSION",
    label: "Confusing",
    icon: HelpCircle,
    hint: "Unclear UI",
    placeholder: "What's unclear? What did you expect vs what you saw?",
  },
  {
    id: "FEATURE",
    label: "Idea",
    icon: Lightbulb,
    hint: "Feature request",
    placeholder: "What would you like to see? How would it help you?",
  },
  {
    id: "PRAISE",
    label: "Praise",
    icon: Heart,
    hint: "This works great",
    placeholder: "What's working well?",
  },
];

const MIN_BODY = 10;
const MAX_BODY = 4000;
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024; // matches server schema

export interface FeedbackSheetProps {
  open: boolean;
  onClose: () => void;
  /** "bottom" for athlete (thumb-zone), "right" for coach (desk register). */
  side: SheetSide;
}

/**
 * Compress a data-URL PNG/JPEG to at most `maxEdge` px on its longest side
 * and re-encode as JPEG q=0.82. Keeps payloads under the 8MB server cap.
 * Returns the original data URL on any failure (caller still sends it).
 */
async function compressDataUrl(dataUrl: string, maxEdge = 1080): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    const longest = Math.max(img.width, img.height);
    if (longest <= maxEdge) return dataUrl;
    const scale = maxEdge / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return dataUrl;
  }
}

/**
 * Capture the current page using html-to-image (lazy-loaded). Filters out
 * the feedback FAB and sheet itself so the screenshot reflects what the
 * user was looking at, not the modal on top of it. Returns null on any
 * failure (cross-origin iframe, OKLCH parser hiccup, etc.) — caller falls
 * back to "text-only" silently.
 */
async function captureCurrentPage(): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(document.body, {
      pixelRatio: 1,
      cacheBust: true,
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;
        if (node.dataset.feedbackOverlay === "true") return false;
        return true;
      },
    });
    return await compressDataUrl(dataUrl);
  } catch {
    return null;
  }
}

export function FeedbackSheet({ open, onClose, side }: FeedbackSheetProps) {
  const pathname = usePathname();
  const toast = useToast();

  const [type, setType] = useState<FeedbackType>("BUG");
  const [body, setBody] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bodyError, setBodyError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    installConsoleErrorCollector();
  }, []);

  // Focus the textarea when the sheet opens — Sheet's own focus trap will
  // pick up the first focusable, but textarea is the natural target here.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const reset = useCallback(() => {
    setType("BUG");
    setBody("");
    setScreenshot(null);
    setBodyError(null);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(reset, 300);
  }, [onClose, reset]);

  const handleFile = useCallback(
    (file: File | null) => {
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
      reader.onload = async () => {
        if (typeof reader.result !== "string") return;
        const compressed = await compressDataUrl(reader.result);
        if (compressed.length > MAX_SCREENSHOT_BYTES * 1.4) {
          toast.error("Compressed image still too large — try a tighter crop");
          return;
        }
        setScreenshot(compressed);
      };
      reader.readAsDataURL(file);
    },
    [toast]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
      if (item) {
        e.preventDefault();
        handleFile(item.getAsFile());
      }
    },
    [handleFile]
  );

  const handleCapture = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    // Briefly close the sheet so it isn't in the screenshot. We re-open
    // after capture completes regardless of outcome.
    onClose();
    try {
      // Wait two frames for the sheet's exit transition to flush.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const dataUrl = await captureCurrentPage();
      if (dataUrl) {
        setScreenshot(dataUrl);
        toast.success("Screenshot captured");
      } else {
        toast.warning("Couldn't capture this page — attach a screenshot manually");
      }
    } finally {
      setCapturing(false);
    }
  }, [capturing, onClose, toast]);

  const handleSubmit = useCallback(async () => {
    const trimmed = body.trim();
    if (trimmed.length < MIN_BODY) {
      setBodyError(`Add at least ${MIN_BODY} characters so we can act on it`);
      return;
    }
    setBodyError(null);
    setSubmitting(true);
    try {
      const viewport =
        typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : null;
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;
      const consoleErrors = getRecentConsoleErrors();
      const url = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");

      const res = await fetch("/api/feedback/beta", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          type,
          body: trimmed,
          url,
          userAgent,
          viewport,
          consoleErrors: consoleErrors.length > 0 ? consoleErrors : null,
          screenshot: screenshot ?? null,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        reportApiError({ res, payload }, toast);
        return;
      }
      toast.success("Thanks — your feedback was logged");
      handleClose();
    } catch (err) {
      reportApiError({ err }, toast);
    } finally {
      setSubmitting(false);
    }
  }, [body, pathname, screenshot, toast, type, handleClose]);

  const charCount = body.length;
  const charNearLimit = charCount > MAX_BODY * 0.9;
  const submitDisabled = submitting || body.trim().length < MIN_BODY;
  const activeOption = TYPE_OPTIONS.find((o) => o.id === type) ?? TYPE_OPTIONS[0];

  return (
    <div data-feedback-overlay="true">
      <Sheet
        open={open && !capturing}
        onClose={handleClose}
        side={side}
        size="md"
        title="Send feedback"
        description="Bugs, ideas, confusion, praise — all of it helps."
        footer={
          <>
            <Button variant="ghost" size="md" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitDisabled}
            >
              Send feedback
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Type chips */}
          <div>
            <div role="radiogroup" aria-label="Feedback type" className="grid grid-cols-4 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = opt.id === type;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setType(opt.id)}
                    className={[
                      "flex flex-col items-center gap-1 px-2 py-3 rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
                      active
                        ? "border-primary-500 bg-primary-500/10 text-primary-700 dark:text-primary-400"
                        : "border-[var(--card-border)] text-muted hover:border-[var(--color-border-strong)] hover:text-[var(--foreground)]",
                    ].join(" ")}
                  >
                    <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted mt-2">{activeOption.hint}</p>
          </div>

          {/* Body */}
          <div>
            <label htmlFor="feedback-body" className="sr-only">
              What happened?
            </label>
            <textarea
              id="feedback-body"
              ref={textareaRef}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                if (bodyError && e.target.value.trim().length >= MIN_BODY) setBodyError(null);
              }}
              onPaste={handlePaste}
              rows={5}
              maxLength={MAX_BODY}
              placeholder={activeOption.placeholder}
              aria-invalid={bodyError ? "true" : undefined}
              aria-describedby={bodyError ? "feedback-body-error" : undefined}
              className="input w-full resize-none text-sm"
            />
            <div className="flex items-center justify-between mt-1 gap-3">
              {bodyError ? (
                <p id="feedback-body-error" className="text-[11px] text-danger-500">
                  {bodyError}
                </p>
              ) : (
                <p className="text-[11px] text-muted">
                  Paste a screenshot here, or use the buttons below.
                </p>
              )}
              <p
                className={[
                  "text-[10px] tabular-nums shrink-0",
                  charNearLimit ? "text-warning-500" : "text-muted",
                ].join(" ")}
              >
                {charCount} / {MAX_BODY}
              </p>
            </div>
          </div>

          {/* Screenshot */}
          {screenshot ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshot}
                alt="Screenshot attached"
                className="w-full max-h-48 object-contain rounded-lg border border-[var(--card-border)] bg-surface-50 dark:bg-surface-900"
              />
              <button
                type="button"
                onClick={() => setScreenshot(null)}
                aria-label="Remove screenshot"
                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <X size={12} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCapture}
                disabled={capturing}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-[var(--card-border)] text-xs text-muted hover:border-primary-500/40 hover:text-primary-500 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              >
                {capturing ? (
                  <Loader2
                    size={14}
                    strokeWidth={1.75}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Camera size={14} strokeWidth={1.75} aria-hidden="true" />
                )}
                {capturing ? "Capturing…" : "Capture this page"}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-[var(--card-border)] text-xs text-muted hover:border-primary-500/40 hover:text-primary-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              >
                <ImageIcon size={14} strokeWidth={1.75} aria-hidden="true" />
                Attach image
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

          <p className="text-[10px] text-muted leading-snug">
            We&apos;ll send the page URL, your role, viewport size, and recent console errors so we
            can triage. Anything in the screenshot is your call.
          </p>
        </div>
      </Sheet>
    </div>
  );
}
