import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Fall back to the public DSN because Vercel only has NEXT_PUBLIC_SENTRY_DSN set.
  // Without this, edge-runtime Sentry.init silently no-ops.
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Capture 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  sendDefaultPii: false,
});
