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
  options?: {
    context?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    error?: unknown;
  }
) {
  if (!process.env.SENTRY_DSN) return;

  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureException(options?.error || new Error(entry.message), {
        tags: { context: options?.context },
        user: options?.userId ? { id: options.userId } : undefined,
        extra: options?.metadata,
      });
    })
    .catch(() => {
      // @sentry/nextjs not installed — skip silently
    });
}

// All levels accept an optional `error` — pino/winston idiom. Non-error levels
// attach it to the output but do NOT report to Sentry (only `error` captures).
interface LogOptions {
  context?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

function errorSuffix(options?: LogOptions): string {
  if (options?.error instanceof Error) {
    return ` — ${options.error.name}: ${options.error.message}`;
  }
  return "";
}

export const logger = {
  debug(message: string, options?: LogOptions) {
    if (process.env.NODE_ENV === "production") return;
    const entry = createEntry("debug", message, options);
    console.debug(formatEntry(entry) + errorSuffix(options), options?.metadata || "");
  },

  info(message: string, options?: LogOptions) {
    const entry = createEntry("info", message, options);
    console.log(
      formatEntry(entry) + errorSuffix(options),
      options?.metadata ? JSON.stringify(options.metadata) : ""
    );
  },

  warn(message: string, options?: LogOptions) {
    const entry = createEntry("warn", message, options);
    console.warn(
      formatEntry(entry) + errorSuffix(options),
      options?.metadata ? JSON.stringify(options.metadata) : ""
    );
  },

  error(message: string, options?: LogOptions) {
    const entry = createEntry("error", message, options);
    console.error(formatEntry(entry));

    if (entry.error) {
      console.error(`  Error: ${entry.error.name}: ${entry.error.message}`);
      // Always log stack — Vercel captures stderr and only project members see logs.
      // Suppressing in prod hid the Prisma init error that caused the 2026-04-13 outage.
      if (entry.error.stack) {
        console.error(`  Stack: ${entry.error.stack}`);
      }
    }

    if (options?.metadata) {
      console.error(`  Metadata: ${JSON.stringify(options.metadata)}`);
    }

    reportToErrorTracking(entry, options);
  },
};
