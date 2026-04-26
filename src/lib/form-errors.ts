/**
 * Form error parsing + UX helpers.
 *
 * Goal: every form submission failure is recoverable. No generic "Something
 * went wrong." Users get a code-specific, action-oriented message and (where
 * appropriate) a Try-again button.
 *
 * Wire-up at the call site:
 *
 *   try {
 *     const res = await fetch(url, { ... });
 *     const payload = await res.json().catch(() => null);
 *     if (!res.ok || !payload?.success) {
 *       const info = parseApiError({ res, payload });
 *       handleApiError(toast, info, { onRetry: () => handleSubmit() });
 *       if (info.fieldErrors) setFieldErrors(info.fieldErrors);
 *       return;
 *     }
 *     // success path
 *   } catch (err) {
 *     // network failure
 *     const info = parseApiError({ err });
 *     handleApiError(toast, info, { onRetry: () => handleSubmit() });
 *   }
 */

import type { useToast } from "@/components/ui/Toast";

export type ApiErrorCode =
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR"
  | "RATE_LIMIT"
  | "AUTH_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "SERVER_ERROR"
  | "UNKNOWN";

export interface ApiErrorInfo {
  code: ApiErrorCode;
  /** Action-oriented message for end users. Safe to render as-is. */
  message: string;
  /** Optional title for richer toasts; falls back to a code-derived label. */
  title?: string;
  /** Field-level errors when the server returned a Zod-style payload. */
  fieldErrors?: Record<string, string>;
  /** Original server message — useful for logging or debug surfaces. */
  rawError?: string;
  /** True when retrying the same request might succeed. */
  retryable: boolean;
  /** Used by offline-capable forms to downgrade to a "Saved locally" warning. */
  isNetworkError: boolean;
}

interface ParseInput {
  /** The Response object, if the request reached the server. */
  res?: Response;
  /** The parsed JSON payload from the response, if any. */
  payload?: unknown;
  /** A thrown error from the fetch (TypeError on network failure, etc.). */
  err?: unknown;
}

interface ApiErrorPayload {
  success?: boolean;
  error?: string;
  fieldErrors?: unknown;
  code?: string;
}

const ACTIONABLE_MESSAGES: Record<ApiErrorCode, { title: string; message: string }> = {
  NETWORK_ERROR: {
    title: "You're offline",
    message: "Connection issue — your work is kept locally and will sync when you're back online.",
  },
  VALIDATION_ERROR: {
    title: "Check the highlighted fields",
    message: "Some fields need a closer look — fix them and try again.",
  },
  RATE_LIMIT: {
    title: "Slow down",
    message: "You're submitting too fast — try again in a moment.",
  },
  AUTH_EXPIRED: {
    title: "Session expired",
    message: "Your session ended — sign back in to continue.",
  },
  FORBIDDEN: {
    title: "Not allowed",
    message: "You don't have permission to do that.",
  },
  NOT_FOUND: {
    title: "Not found",
    message: "Whatever you were trying to update is gone — refresh and try again.",
  },
  SERVER_ERROR: {
    title: "Our end broke",
    message: "Something went wrong on our end — we've logged it. Try again in a moment.",
  },
  UNKNOWN: {
    title: "Couldn't save",
    message: "We hit an unexpected snag. Try again — if it keeps happening, let us know.",
  },
};

const RETRYABLE_CODES: ReadonlySet<ApiErrorCode> = new Set([
  "NETWORK_ERROR",
  "RATE_LIMIT",
  "SERVER_ERROR",
  "UNKNOWN",
]);

function isFieldErrorsRecord(value: unknown): value is Record<string, string> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v !== "string") return false;
  }
  return true;
}

/**
 * Parse a structured ApiErrorInfo from any combination of:
 *   - a Response (the fetch resolved)
 *   - a parsed payload (the canonical { success: false, error: string } shape)
 *   - a thrown error (the fetch itself failed — network, abort, CORS)
 *
 * Always returns a value — never throws.
 */
export function parseApiError(input: ParseInput): ApiErrorInfo {
  const { res, payload, err } = input;

  // Network failure — fetch itself threw before reaching the server.
  if (err && !res) {
    const message =
      err instanceof TypeError
        ? ACTIONABLE_MESSAGES.NETWORK_ERROR.message
        : err instanceof Error
          ? err.message
          : ACTIONABLE_MESSAGES.UNKNOWN.message;
    return {
      code: "NETWORK_ERROR",
      title: ACTIONABLE_MESSAGES.NETWORK_ERROR.title,
      message,
      rawError: err instanceof Error ? err.message : String(err),
      retryable: true,
      isNetworkError: true,
    };
  }

  const status = res?.status ?? 0;
  const errorPayload = (payload as ApiErrorPayload | null) ?? null;
  const serverMessage = errorPayload?.error?.trim() || undefined;
  const fieldErrors = isFieldErrorsRecord(errorPayload?.fieldErrors)
    ? errorPayload.fieldErrors
    : undefined;

  let code: ApiErrorCode;
  if (status === 401) {
    code = "AUTH_EXPIRED";
  } else if (status === 403) {
    code = "FORBIDDEN";
  } else if (status === 404) {
    code = "NOT_FOUND";
  } else if (
    status === 422 ||
    (status === 400 && (fieldErrors || /validat/i.test(serverMessage ?? "")))
  ) {
    code = "VALIDATION_ERROR";
  } else if (status === 429) {
    code = "RATE_LIMIT";
  } else if (status >= 500) {
    code = "SERVER_ERROR";
  } else if (status >= 400) {
    // Other 4xx — treat as VALIDATION when we have a structured server message,
    // else UNKNOWN.
    code = serverMessage ? "VALIDATION_ERROR" : "UNKNOWN";
  } else {
    code = "UNKNOWN";
  }

  const fallback = ACTIONABLE_MESSAGES[code];
  // Prefer the server's own message for codes where the server probably
  // knows best (validation, forbidden). Use our action-oriented copy for
  // codes where the server message would be opaque ("Internal Server Error").
  const useServerMessage =
    code === "VALIDATION_ERROR" || code === "FORBIDDEN" || code === "NOT_FOUND";
  const message = useServerMessage && serverMessage ? serverMessage : fallback.message;

  return {
    code,
    title: fallback.title,
    message,
    fieldErrors,
    rawError: serverMessage,
    retryable: RETRYABLE_CODES.has(code),
    isNetworkError: false,
  };
}

/* ─── Toast helpers ─────────────────────────────────────────────────────── */

type ToastApi = ReturnType<typeof useToast>;

export interface HandleApiErrorOptions {
  /** When provided AND the error is retryable, the toast gets a Try-again action. */
  onRetry?: () => void;
  /** When the form has an offline outbox (per P0-2), pass true so NETWORK_ERROR
   *  becomes a "Saved locally" warning instead of an error. */
  isOfflineCapable?: boolean;
  /** Override the toast title (e.g. context-specific copy). */
  titleOverride?: string;
  /** Suppress the toast entirely — useful when the caller renders inline. */
  silent?: boolean;
}

/**
 * Fires the right toast for an ApiErrorInfo. Returns the info so the caller
 * can chain (e.g. set fieldErrors on the form).
 */
export function handleApiError(
  toast: ToastApi,
  info: ApiErrorInfo,
  options: HandleApiErrorOptions = {}
): ApiErrorInfo {
  if (options.silent) return info;

  // Offline-capable forms: a network failure means "the outbox caught it" —
  // surface as a quiet warning, not an error.
  if (info.isNetworkError && options.isOfflineCapable) {
    toast.toast({
      variant: "warning",
      title: "Saved locally",
      description: "We'll sync when you're back online.",
      duration: 4500,
    });
    return info;
  }

  // Auth expired: notify and (caller is responsible for the actual redirect).
  if (info.code === "AUTH_EXPIRED") {
    toast.toast({
      variant: "error",
      title: options.titleOverride ?? info.title ?? "Session expired",
      description: info.message,
    });
    return info;
  }

  const action =
    options.onRetry && info.retryable
      ? { label: "Try again", onClick: options.onRetry }
      : undefined;

  toast.toast({
    variant: "error",
    title: options.titleOverride ?? info.title ?? "Couldn't save",
    description: info.message,
    duration: action ? 7000 : 5000,
    action,
  });

  return info;
}

/**
 * One-shot helper: parse, toast, return info. Wraps the common flow:
 *
 *   const info = await reportApiError({ res, payload, err }, toast, { onRetry });
 *   if (info.fieldErrors) setFieldErrors(info.fieldErrors);
 *   if (info.code === "AUTH_EXPIRED") router.push("/login");
 */
export function reportApiError(
  input: ParseInput,
  toast: ToastApi,
  options?: HandleApiErrorOptions
): ApiErrorInfo {
  const info = parseApiError(input);
  return handleApiError(toast, info, options);
}
