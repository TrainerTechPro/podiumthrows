/**
 * Bundle size baseline (2026-03-16) — run `npm run analyze` to regenerate
 *
 *   Shared JS (all routes):  199 kB
 *   Middleware:                85.9 kB
 *   Heaviest pages (first load JS):
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
      // Server Actions in this app carry only small JSON/string payloads (e.g. the
      // sideline view-toggle cookie). All file/video uploads go through API route
      // handlers + presigned R2 PUTs, NOT Server Actions — so a large limit here is
      // pure memory-exhaustion / DoS surface with no legitimate use. Keep it tight.
      bodySizeLimit: '1mb',
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
      // R2 S3 endpoint — presigned GET URLs (private serving) resolve here.
      // Needed so next/image can optimize presigned thumbnails when
      // R2_PRIVATE_SERVING is on. Query-string signature doesn't affect matching.
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      // AWS S3 (any region)
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },
      { protocol: 'https', hostname: '*.s3.*.amazonaws.com' },
      // ExerciseDB / RapidAPI exercise GIFs
      { protocol: 'https', hostname: 'v2.exercisedb.io' },
    ],
  },
  async redirects() {
    return [
      // ── MVP surface cut (2026-05-15) ───────────────────────────────────
      // Subtraction pass per tasks/product-audit-roadmap-2026-05-15.md.
      // Hidden modules with no flow dependency and no need for admin access
      // redirect here. Routes that admins / dev still need (architect,
      // questionnaires, video-analysis, sideline, self-program) are gated
      // by `src/lib/flags.ts` + middleware FLAG_GATED_ROUTES instead — that
      // path keeps a flag flip enough to restore access without redeploying.
      { source: '/athlete/insights',    destination: '/athlete/dashboard',   permanent: false },
      { source: '/athlete/codex',       destination: '/athlete/dashboard',   permanent: false },
      { source: '/athlete/tools',       destination: '/athlete/settings',    permanent: false },
      { source: '/athlete/team',        destination: '/athlete/dashboard',   permanent: false },

      // ── PR 1: route-consolidation 307s ─────────────────────────────────
      // Non-permanent on purpose. These are cleanup of in-tree page-level
      // `redirect()` stubs and near-dead surfaces — unlike the 308s below
      // (which represent real IA migrations), these might still shift in a
      // follow-up consolidation pass. 307 preserves method and leaves room
      // to revisit without browsers caching the decision forever.
      // See tasks/todo.md + tasks/route-consolidation-manifest.md.

      // Settings consolidation — both roles got tabbed shells that read ?tab=.
      // Old standalone sub-routes 307 here so deep-links from emails / push
      // notifications / browser bookmarks keep landing on the same surface.
      { source: '/athlete/settings/notifications',   destination: '/athlete/settings?tab=notifications',  permanent: false },
      { source: '/coach/settings/notifications',     destination: '/coach/settings?tab=notifications',    permanent: false },
      { source: '/coach/settings/security',          destination: '/coach/settings?tab=security',         permanent: false },
      { source: '/coach/settings/autoregulation',    destination: '/coach/settings?tab=autoregulation',   permanent: false },

      // Page-level redirect stubs promoted to config.
      { source: '/athlete/hub',        destination: '/athlete/dashboard',           permanent: false },
      { source: '/coach/my-program',   destination: '/athlete/dashboard',           permanent: false },
      { source: '/coach/my-training',  destination: '/athlete/dashboard',           permanent: false },
      { source: '/coach/my-lifting',   destination: '/athlete/dashboard',           permanent: false },
      // Updated for PR 6: was /coach/throws/drills (now redirects to library).
      // Skip the 2-hop and land directly on the canonical Library Drills view.
      { source: '/coach/drill-videos', destination: '/coach/library?view=drills',   permanent: false },
      { source: '/coach/invitations',  destination: '/coach/athletes/invitations',  permanent: false },

      // /athlete/throws/log removed from the consolidation list — the page
      // has a distinct ?edit=<id> flow for editing self-logged sessions
      // that /athlete/log-session doesn't wire yet. Feature migration, not
      // route cleanup. Tracked in tasks/route-consolidation-survivors.md.

      // /athlete/quick-start also removed — the page is a smart-routing
      // "Start Session" surface (in-progress → self-program → coach-assigned
      // → ad-hoc) used by the QuickActions button. Flattening it to
      // /athlete/log-session would bypass the resume-workout flow.

      // Exercise recommender subsumed by the Builder Plan tab in generate mode.
      // Updated for PR 6: was /coach/plans/generate (now itself redirected).
      { source: '/coach/throws/programming', destination: '/coach/builder?type=plan&mode=generate',  permanent: false },

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
      // PR 7 (onboarding consolidation, 2026-04-25): /athlete/review-profile
      // is retired. Invite-flow athletes (claimed via coach proxy) now land
      // in the unified /athlete/onboarding wizard with ?from=invite, which
      // shows 3 visible steps prefilled from coach data and jumps to the
      // first-throw log. The register-claim API redirect was updated in
      // the same commit; this entry catches direct external links (welcome
      // email retries, coach-shared URLs, browser bookmarks) and any cached
      // 307s from prior PR 1 work.
      {
        source: '/athlete/review-profile',
        destination: '/athlete/onboarding?from=invite',
        permanent: true,
      },
      // Updated for PR 6: was /coach/athletes?tab=throws (now URL-state legacy).
      // The Tier-2 sibling /coach/athletes/throws is the canonical IA destination.
      {
        source: '/coach/throws/roster',
        destination: '/coach/athletes/throws?moved=1',
        permanent: true,
      },

      // H-2: Flat programming IA — Schedule + Plans as peers.
      // Updated for PR 6: /coach/schedule itself now redirects to /coach/calendar
      // (Calendar absorbs schedule + practices + availability + live-practice).
      // Skip the 2-hop and land on Calendar directly.
      {
        source: '/coach/programming',
        destination: '/coach/calendar',
        permanent: true,
      },
      {
        source: '/coach/programming/:path*',
        destination: '/coach/calendar/:path*',
        permanent: true,
      },
      // /coach/sessions* — was the legacy plans namespace. Updated for PR 6:
      // plans live in /coach/library?view=plans now, plan-new lives in
      // /coach/builder?type=plan.
      {
        source: '/coach/sessions',
        destination: '/coach/library?view=plans',
        permanent: true,
      },
      {
        source: '/coach/sessions/new',
        destination: '/coach/builder?type=plan',
        permanent: true,
      },
      // Bondarchuk program generator — was at /coach/plans/generate; now lives
      // as the Generate sub-mode of the Builder Plan tab.
      {
        source: '/coach/throws/program-builder',
        destination: '/coach/builder?type=plan&mode=generate',
        permanent: true,
      },

      // ── PR 6: coach-IA consolidation 308s. ─────────────────────────────
      // Three new top-level destinations (Calendar / Library / Builder)
      // absorb fifteen sprawled coach surfaces, plus seven Tier-2 siblings
      // pull roster admin under /coach/athletes/*. See tasks/nav-ia-v2.md
      // and the commit chain b120d62 → f6dd125. All 308 — these are real
      // IA migrations, do not downgrade.

      // Calendar absorbs schedule, practices (list), availability, live-practice.
      // Detail pages survive at their original paths (/coach/practices/[id],
      // /coach/throws/practice/[sessionId]) — the source patterns here are
      // exact-match for the list pages only.
      {
        source: '/coach/schedule',
        destination: '/coach/calendar',
        permanent: true,
      },
      {
        source: '/coach/schedule/:path*',
        destination: '/coach/calendar/:path*',
        permanent: true,
      },
      {
        source: '/coach/practices',
        destination: '/coach/calendar?view=by-athlete',
        permanent: true,
      },
      {
        source: '/coach/availability',
        destination: '/coach/calendar?view=compliance',
        permanent: true,
      },
      {
        source: '/coach/throws/practice',
        destination: '/coach/calendar?view=live',
        permanent: true,
      },

      // Library absorbs exercises, throws-library (sessions), throws-drills,
      // plans (list). Drill videos collapse into Library/Drills (Q6 sign-off).
      // Detail pages /coach/plans/[planId] survive — exact-match source.
      {
        source: '/coach/exercises',
        destination: '/coach/library?view=exercises',
        permanent: true,
      },
      {
        source: '/coach/throws/library',
        destination: '/coach/library?view=sessions',
        permanent: true,
      },
      {
        source: '/coach/throws/drills',
        destination: '/coach/library?view=drills',
        permanent: true,
      },
      {
        source: '/coach/plans',
        destination: '/coach/library?view=plans',
        permanent: true,
      },
      {
        source: '/coach/videos/drills',
        destination: '/coach/library?view=drills',
        permanent: true,
      },

      // Builder absorbs throws-builder, plan-new, plan-generate.
      // Plan tab has a Manual / Generate sub-mode; the generate URL preserves it.
      {
        source: '/coach/throws/builder',
        destination: '/coach/builder?type=session',
        permanent: true,
      },
      {
        source: '/coach/plans/new',
        destination: '/coach/builder?type=plan',
        permanent: true,
      },
      {
        source: '/coach/plans/generate',
        destination: '/coach/builder?type=plan&mode=generate',
        permanent: true,
      },

      // Athletes Tier-2 sibling renames. The roster admin surfaces move under
      // /coach/athletes/* so the URL hierarchy matches the IA hierarchy.
      // Detail pages (/coach/competitions/[id]) survive at their original
      // paths until commit 7's breadcrumb audit pass — the list-page redirect
      // here only matches the exact source.
      {
        source: '/coach/teams',
        destination: '/coach/athletes/groups',
        permanent: true,
      },
      {
        source: '/coach/event-groups',
        destination: '/coach/athletes/event-groups',
        permanent: true,
      },
      {
        source: '/coach/goals',
        destination: '/coach/athletes/goals',
        permanent: true,
      },
      {
        source: '/coach/competitions',
        destination: '/coach/athletes/competitions',
        permanent: true,
      },
      {
        source: '/coach/team',
        destination: '/coach/athletes/announcements',
        permanent: true,
      },

      // Athletes Tier-1 self-logs tab.
      {
        source: '/coach/athlete-logs',
        destination: '/coach/athletes?tab=self-logs',
        permanent: true,
      },

      // Per-athlete: Bondarchuk assessment surface relocated to athlete sub-route.
      {
        source: '/coach/throws/assessment/:athleteId',
        destination: '/coach/athletes/:athleteId/assessments',
        permanent: true,
      },

      // Throws Hub retired (sign-off Q1) — content distributed to Dashboard
      // (team pulse), Calendar (recent sessions), and Library/Builder.
      {
        source: '/coach/throws',
        destination: '/coach/dashboard',
        permanent: true,
      },

      // Coach session-logging is contextual, not destinational (sign-off Q2).
      // Old standalone surface points at Calendar; the actual flow lands on
      // a per-day "Log session for…" CTA in Calendar.
      {
        source: '/coach/log-session',
        destination: '/coach/calendar',
        permanent: true,
      },

      // Wellness becomes a Dashboard tab (sign-off Q3) — glance-surface.
      {
        source: '/coach/wellness',
        destination: '/coach/dashboard?tab=readiness',
        permanent: true,
      },

      // Hub killed (sign-off Q5) — team-pulse content already on Dashboard,
      // any rollup data lands in the Roster header summary.
      {
        source: '/coach/hub',
        destination: '/coach/dashboard',
        permanent: true,
      },

      // Tools and Integrations get absorbed as Settings tabs (per mapping).
      // Coach settings has no standalone "tools" tab — Tools was folded into
      // Integrations during the IA refactor. Redirect both to that tab so a
      // bookmarked /coach/tools doesn't fall through to Profile.
      {
        source: '/coach/tools',
        destination: '/coach/settings?tab=integrations',
        permanent: true,
      },
      {
        source: '/coach/integrations',
        destination: '/coach/settings?tab=integrations',
        permanent: true,
      },

      // Throws Analyze merges into Video Analysis (sign-off H).
      // The schema's EventType enum (SHOT_PUT|DISCUS|HAMMER|JAVELIN) is
      // already throws-only, so no event filter is needed — passing
      // ?event=throws would crash Prisma with "Expected EventType."
      {
        source: '/coach/throws/analyze',
        destination: '/coach/video-analysis',
        permanent: true,
      },
      {
        source: '/coach/throws/analyze/history',
        destination: '/coach/video-analysis?tab=history',
        permanent: true,
      },
      {
        source: '/coach/throws/analyze/:id',
        destination: '/coach/video-analysis/:id',
        permanent: true,
      },

      // Video library merges into Video Analysis (sign-off Q5). Drill videos
      // (/coach/videos/drills) handled separately above as a Library redirect.
      {
        source: '/coach/videos',
        destination: '/coach/video-analysis',
        permanent: true,
      },
      {
        source: '/coach/videos/upload',
        destination: '/coach/video-analysis/upload',
        permanent: true,
      },
      {
        source: '/coach/videos/:id',
        destination: '/coach/video-analysis/:id',
        permanent: true,
      },

      // Throws Profile retired (MVP surface cut). Jobs were already covered
      // by canonical /coach/athletes/[id] (Overview / Training / Throws /
      // Performance / Readiness / Wellness / Goals scroll sections) plus
      // AssessmentWizard at /coach/athletes/[id]/assessments. Athlete-id
      // forms preserve scope; bare hits fall back to the roster.
      {
        source: '/coach/throws/profile',
        has: [{ type: 'query', key: 'athleteId', value: '(?<athleteId>.+)' }],
        destination: '/coach/athletes/:athleteId',
        permanent: true,
      },
      {
        source: '/coach/throws/profile',
        destination: '/coach/athletes',
        permanent: true,
      },
      {
        source: '/coach/throws/profile/typing',
        has: [{ type: 'query', key: 'athleteId', value: '(?<athleteId>.+)' }],
        destination: '/coach/athletes/:athleteId/assessments',
        permanent: true,
      },
      {
        source: '/coach/throws/profile/typing',
        destination: '/coach/athletes',
        permanent: true,
      },
      // Invite was a thin duplicate of /coach/athletes/invitations (same API,
      // smaller surface area). Single canonical home for invite admin.
      {
        source: '/coach/throws/invite',
        destination: '/coach/athletes/invitations',
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
              // storage.googleapis.com hosts the MediaPipe pose_landmarker
              // model (~29MB) loaded by /coach/video-analysis/live; vendoring
              // it would balloon the build artifact, and Google publishes the
              // canonical model from this single host.
              "connect-src 'self' https://api.stripe.com https://*.r2.cloudflarestorage.com https://*.r2.dev https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://storage.googleapis.com",
              // Presigned R2 GETs for analysis clips are served from the S3-compat
              // endpoint (*.r2.cloudflarestorage.com), not the public *.r2.dev
              // host — without it the results-page <video> is blocked and
              // renders black (connect-src already allowed it, which is why
              // the pose JSON fetch on the same page worked).
              "media-src 'self' blob: https://*.r2.dev https://*.r2.cloudflarestorage.com",
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
          // camera=(self) for /coach/video-analysis/live (pose detection on
          // the coach's own webcam). The page is the only camera consumer in
          // the app today; a route-scoped header would be tighter but Next.js
          // lacks a clean per-route override without middleware rewriting.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
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
