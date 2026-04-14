import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Forwards server-side RSC render errors (and the Next.js digest) to Sentry
// with real stack traces. Without this, browser-side captures only see the
// opaque "An error occurred in the Server Components render" proxy error.
export const onRequestError = Sentry.captureRequestError;
