# Vercel Infrastructure Improvements — Design Spec

**Date:** 2026-03-25
**Status:** Approved

## Overview

Four infrastructure improvements leveraging Vercel platform features to improve load times, enable controlled feature rollouts, cache expensive queries, and add lightweight observability.

## Phase 1: Edge Config + Feature Flags

**Package:** `@vercel/edge-config`

**Files:**
- `src/lib/flags.ts` — flag definitions + Edge Config reader
- `src/middleware.ts` — route-level flag gating
- `src/app/api/flags/route.ts` — admin endpoint

**Flag structure:**
```json
{
  "flags": {
    "featureName": { "enabled": true, "tiers": ["pro", "elite"] }
  }
}
```

**Setup:** Create Edge Config in Vercel dashboard, link to project (auto-provisions `EDGE_CONFIG` env var). Local dev uses a fallback map with all flags enabled.

## Phase 2: ISR + Code-Splitting

**ISR targets:**
| Page | Revalidation | Invalidation |
|------|-------------|-------------|
| Exercise library | 3600s | On edit |
| Program templates | 3600s | `revalidateTag` on save |
| Coach dashboard | 300s | `revalidateTag` on session save |
| Athlete detail | 600s | `revalidateTag` on data change |

**Code-splitting targets (dynamic import, ssr: false):**
- Recharts (~80-100 kB savings)
- Video player/annotator (~50-70 kB)
- Questionnaire builder (~30-40 kB)
- Plate calculator (~15-20 kB)

**Goal:** All pages under 250 kB first-load JS.

## Phase 3: Data Caching

**Utility:** `src/lib/cache.ts` using `unstable_cache` from `next/cache`

**Cached queries:**
| Query | TTL | Tag |
|-------|-----|-----|
| Coach roster + stats | 300s | `coach-{id}` |
| Athlete session history | 600s | `athlete-{id}` |
| Exercise library | 3600s | `exercises` |
| Program templates | 1800s | `coach-{id}` |
| Competition results | 3600s | `athlete-{id}` |
| Wellness scores | 300s | `athlete-{id}` |

**Invalidation:** `revalidateTag()` calls in POST/PUT/DELETE API routes.

## Phase 4: Lightweight Observability

**Utility:** `src/lib/perf.ts` — `withTiming(label, fn)` wrapper

**Instrumentation points:**
- Dashboard data fetches
- Cache hit/miss logging
- Heavy API routes (video upload, session save, program generation)

**Client-side:** `reportWebVitals` in root layout (dev only).

## Constraints

- Vercel Hobby plan (Edge Config: 1 store, 512 items, 512KB)
- Next.js 14.2 (no Cache Components / `use cache`)
- No new UI dependencies (per CLAUDE.md)
- 1 new package total: `@vercel/edge-config`
