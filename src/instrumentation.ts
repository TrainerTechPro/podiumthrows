import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Fail loud at boot on missing critical env (DB/JWT); warn on degradable
    // integrations. Edge runtime is skipped — it doesn't carry the full env set.
    const { validateEnv } = await import("./lib/env");
    validateEnv();

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
