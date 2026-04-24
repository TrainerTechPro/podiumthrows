/**
 * Bundle size baseline (2026-03-16) — run `npm run analyze` to regenerate
 *
 *   Shared JS (all routes):  199 kB
 *   Middleware:                85.9 kB
 *   Heaviest pages (first load JS):
 *     /coach/throws/profile       349 kB
 *     /athlete/throws/log         317 kB
 *     /athlete/throws/analysis    315 kB
 *     /coach/dashboard            263 kB
 *     /coach/invitations          262 kB
 */

import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // bcryptjs uses Node.js crypto — must run in Node.js runtime, not edge
    serverComponentsExternalPackages: ['bcryptjs'],
    serverActions: {
      bodySizeLimit: '2gb',
    },
    // Tree-shake barrel exports from these libs on every import site. lucide-react
    // alone ships 1000+ icon modules behind a single barrel; without this, importing
    // `{ User }` drags the entire icon set into the page chunk. Same story for
    // framer-motion feature exports, recharts primitives, and Sentry instrumentation.
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
      '@sentry/nextjs',
      'date-fns',
    ],
  },
  modularizeImports: {
    // Belt-and-suspenders — rewrite `import { User } from 'lucide-react'` into
    // per-file deep imports at compile time, so unused icons never enter the graph
    // even on code paths the barrel optimizer misses.
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{ kebabCase member }}',
      preventFullImport: true,
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Cloudflare R2 public buckets
      { protocol: 'https', hostname: '*.r2.dev' },
      // AWS S3 (any region)
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },
      { protocol: 'https', hostname: '*.s3.*.amazonaws.com' },
      // ExerciseDB / RapidAPI exercise GIFs
      { protocol: 'https', hostname: 'v2.exercisedb.io' },
    ],
  },
  async redirects() {
    return [
      // ── PR 1: route-consolidation 307s ─────────────────────────────────
      // Non-permanent on purpose. These are cleanup of in-tree page-level
      // `redirect()` stubs and near-dead surfaces — unlike the 308s below
      // (which represent real IA migrations), these might still shift in a
      // follow-up consolidation pass. 307 preserves method and leaves room
      // to revisit without browsers caching the decision forever.
      // See tasks/todo.md + tasks/route-consolidation-manifest.md.

      // Page-level redirect stubs promoted to config.
      { source: '/athlete/hub',        destination: '/athlete/dashboard',           permanent: false },
      { source: '/coach/my-program',   destination: '/athlete/dashboard',           permanent: false },
      { source: '/coach/my-training',  destination: '/athlete/dashboard',           permanent: false },
      { source: '/coach/my-lifting',   destination: '/athlete/dashboard',           permanent: false },
      { source: '/coach/drill-videos', destination: '/coach/throws/drills',         permanent: false },
      { source: '/coach/invitations',  destination: '/coach/athletes/invitations',  permanent: false },

      // /athlete/throws/log removed from the consolidation list — the page
      // has a distinct ?edit=<id> flow for editing self-logged sessions
      // that /athlete/log-session doesn't wire yet. Feature migration, not
      // route cleanup. Tracked in tasks/route-consolidation-survivors.md.

      // /athlete/quick-start also removed — the page is a smart-routing
      // "Start Session" surface (in-progress → self-program → coach-assigned
      // → ad-hoc) used by the QuickActions button. Flattening it to
      // /athlete/log-session would bypass the resume-workout flow.

      // Exercise recommender subsumed by /coach/plans/generate.
      { source: '/coach/throws/programming', destination: '/coach/plans/generate',  permanent: false },

      // Coach codex page deleted — CodexView extracted to src/components/codex/
      // for shared use by /athlete/codex. Coach bookmarks land on dashboard.
      { source: '/coach/codex',        destination: '/coach/dashboard',             permanent: false },

      // ── 308s below: prior IA migrations, do not downgrade. ─────────────
      {
        source: '/athlete/throws/analysis',
        destination: '/athlete/throws/trends',
        permanent: true,
      },
      {
        source: '/athlete/throws/profile',
        destination: '/athlete/throws/readiness',
        permanent: true,
      },
      {
        source: '/coach/throws/roster',
        destination: '/coach/athletes?tab=throws&moved=1',
        permanent: true,
      },

      // H-2: Flat programming IA — Schedule + Plans as peers.
      // /coach/programming* → /coach/schedule* (week calendar lives here now)
      {
        source: '/coach/programming',
        destination: '/coach/schedule',
        permanent: true,
      },
      {
        source: '/coach/programming/:path*',
        destination: '/coach/schedule/:path*',
        permanent: true,
      },
      // /coach/sessions* → /coach/plans* (plans are the template library;
      // scheduled instances live on /coach/schedule).
      {
        source: '/coach/sessions',
        destination: '/coach/plans',
        permanent: true,
      },
      {
        source: '/coach/sessions/new',
        destination: '/coach/plans/new',
        permanent: true,
      },
      // Bondarchuk program generator — relocated from /coach/throws/* into
      // the /coach/plans/* namespace. Distinct from /coach/plans/new (blank
      // session template). The generator produces a multi-week periodized
      // Program (macrocycle), the blank builder produces a single-session
      // WorkoutPlan (template).
      {
        source: '/coach/throws/program-builder',
        destination: '/coach/plans/generate',
        permanent: true,
      },

      // Canonical session + throws URLs per role. Each legacy URL maps to
      // exactly one model (TrainingSession or ThrowsAssignment) with
      // unambiguous view dispatch via `?view=live|recap`.
      {
        source: '/athlete/sessions/:id',
        destination: '/athlete/session/:id',
        permanent: true,
      },
      {
        source: '/athlete/sessions/:id/recap',
        destination: '/athlete/session/:id?view=recap',
        permanent: true,
      },
      {
        source: '/athlete/sessions/assignment/:id',
        destination: '/athlete/throws/:id',
        permanent: true,
      },
      {
        source: '/athlete/throws/session/:id',
        destination: '/athlete/throws/:id',
        permanent: true,
      },
      {
        source: '/athlete/throws/live/:id',
        destination: '/athlete/throws/:id?view=live',
        permanent: true,
      },
      {
        source: '/coach/athletes/:athleteId/sessions/:id',
        destination: '/coach/throws/:id?athlete=:athleteId',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        // Service worker must not be cached by the browser
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Stripe checkout + Vercel Analytics
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              // R2 public assets, S3 public buckets (any region), ExerciseDB GIFs.
              // CSP wildcards can only appear at the start of a host segment, so
              // https://*.s3.*.amazonaws.com is invalid and was silently ignored.
              "img-src 'self' data: blob: https://*.r2.dev https://*.amazonaws.com https://v2.exercisedb.io",
              "font-src 'self' data:",
              // Stripe API, Cloudflare R2, Sentry ingest (matches both
              // o{id}.ingest.sentry.io and o{id}.ingest.us.sentry.io patterns).
              "connect-src 'self' https://api.stripe.com https://*.r2.cloudflarestorage.com https://*.r2.dev https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
              "media-src 'self' blob: https://*.r2.dev",
              // Sentry Replay uses blob: workers for session replay recording
              "worker-src 'self' blob:",
              "frame-src 'self' https://js.stripe.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  // Sentry build-time options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps when auth token is available (CI/production builds)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress Sentry CLI logs during build
  silent: true,

  // Disable source map upload when no auth token (local dev)
  disableSourceMapUpload: !process.env.SENTRY_AUTH_TOKEN,
});
