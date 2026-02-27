type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

function formatEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    entry.context ? `[${entry.context}]` : "",
    entry.message,
  ];

  if (entry.userId) {
    parts.push(`(user: ${entry.userId})`);
  }

  return parts.filter(Boolean).join(" ");
}

function createEntry(
  level: LogLevel,
  message: string,
  options?: {
    context?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    error?: unknown;
  }
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context: options?.context,
    userId: options?.userId,
    metadata: options?.metadata,
  };

  if (options?.error instanceof Error) {
    entry.error = {
      name: options.error.name,
      message: options.error.message,
      stack: options.error.stack,
    };
  }

  return entry;
}

/**
 * Report an error to the external tracking service (Sentry).
 * Safe to call even when @sentry/nextjs is not installed — fails silently.
 */
function reportToErrorTracking(
  entry: LogEntry,
  options?: { context?: string; userId?: string; metadata?: Record<string, unknown>; error?: unknown }
) {
  if (!process.env.SENTRY_DSN) return;

  try {
    // eslint-disable-next-line
    const Sentry = require("@sentry/nextjs");
    Sentry.captureException(options?.error || new Error(entry.message), {
      tags: { context: options?.context },
      user: options?.userId ? { id: options.userId } : undefined,
      extra: options?.metadata,
    });
  } catch {
    // @sentry/nextjs not installed — skip silently
  }
}

export const logger = {
  debug(message: string, options?: { context?: string; userId?: string; metadata?: Record<string, unknown> }) {
    if (process.env.NODE_ENV === "production") return;
    const entry = createEntry("debug", message, options);
    console.debug(formatEntry(entry), options?.metadata || "");
  },

  info(message: string, options?: { context?: string; userId?: string; metadata?: Record<string, unknown> }) {
    const entry = createEntry("info", message, options);
    console.log(formatEntry(entry), options?.metadata ? JSON.stringify(options.metadata) : "");
  },

  warn(message: string, options?: { context?: string; userId?: string; metadata?: Record<string, unknown> }) {
    const entry = createEntry("warn", message, options);
    console.warn(formatEntry(entry), options?.metadata ? JSON.stringify(options.metadata) : "");
  },

  error(message: string, options?: { context?: string; userId?: string; metadata?: Record<string, unknown>; error?: unknown }) {
    const entry = createEntry("error", message, options);
    console.error(formatEntry(entry));

    if (entry.error) {
      console.error(`  Error: ${entry.error.name}: ${entry.error.message}`);
      if (process.env.NODE_ENV !== "production" && entry.error.stack) {
        console.error(`  Stack: ${entry.error.stack}`);
      }
    }

    if (options?.metadata) {
      console.error(`  Metadata: ${JSON.stringify(options.metadata)}`);
    }

    reportToErrorTracking(entry, options);
  },
};
