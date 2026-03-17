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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.r2.dev https://*.s3.amazonaws.com https://*.s3.*.amazonaws.com https://v2.exercisedb.io",
              "font-src 'self' data:",
              "connect-src 'self' https://api.stripe.com https://*.r2.cloudflarestorage.com https://*.r2.dev https://*.ingest.sentry.io",
              "media-src 'self' blob: https://*.r2.dev",
              "worker-src 'self'",
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
