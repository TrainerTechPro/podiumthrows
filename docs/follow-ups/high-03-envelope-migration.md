# HIGH-03 follow-up — migrate ~36 client-facing routes to canonical envelope

**Filed:** 2026-04-23 (commit landing this doc).
**Parent audit item:** HIGH-03 in `tasks/audit-fix-prompts.md` (local working doc).
**Notion Bug Tracker:** linked from this row.
**Status:** in progress — sites are suppressed by inline `// eslint-disable-next-line` directives so `npm run lint` stays green during migration.

## Why this exists

The initial HIGH-03 pass shipped the `no-bare-nextresponse-json` ESLint guard. The guard exposed 53 drift sites across 36 files that weren't in the original scope. Per CLAUDE.md §2, bare response shapes have caused 3+ past "save doesn't work" bugs — every unfixed site is a future bug. Leaving the guard off isn't an option; fixing everything atomically in one PR is too large and too risky for unreviewed client-consumer updates.

Compromise: the guard is on, each drift site carries a searchable `HIGH-03-follow-up` TODO marker, and this doc tracks the migration file-by-file. **Plan and code evolve in the same commit** — tick the checkbox when the file is done, in the commit that migrates it.

## Recipe per file

1. Replace `NextResponse.json({ …: T })` with `NextResponse.json({ success: true, data: { …: T } })`.
2. Replace error returns with `NextResponse.json({ success: false, error })`.
3. Grep every client consumer of the route path. Update each to:
   ```ts
   const res = await fetch("/api/…");
   const payload = await res.json();
   if (!res.ok || !payload.success) {
     toast.error(payload.error || `Request failed (${res.status})`);
     return;
   }
   const result = payload.data;
   ```
4. Remove the `eslint-disable-next-line` comment above the call.
5. Run `npm run typecheck && npm run lint && npm run test`.
6. Manually exercise the route — same discipline the Stripe routes got.
7. Tick the checkbox in this doc, in the same commit.

## Permanent exemptions (do NOT migrate)

Already exempted via `.eslintrc.json` `overrides`:

- `src/app/api/webhooks/**/*.ts` — Stripe and Cloudflare Stream webhook contracts answer to external services' envelope requirements.
- `src/middleware.ts` — CSRF and rate-limit responses are pre-handler edge artifacts, not normal API responses.

## Sites to migrate (36 files, 53 call sites)

### Athlete API

- [ ] `src/app/api/athlete/assessments/route.ts` (L57)
- [ ] `src/app/api/athlete/feedback/unread-count/route.ts` (L62)
- [ ] `src/app/api/athlete/notification-preferences/route.ts` (L101, L192)
- [ ] `src/app/api/athlete/questionnaires/[id]/route.ts` (L214)
- [ ] `src/app/api/athlete/self-program/[id]/route.ts` (L107, L264)
- [ ] `src/app/api/athlete/self-program/[id]/session/[sessionId]/start-live/route.ts` (L73, L222)
- [ ] `src/app/api/athlete/self-program/route.ts` (L69)
- [ ] `src/app/api/athlete/sessions/check-stale/route.ts` (L75, L90, L102, L106)
- [ ] `src/app/api/athlete/streak-status/route.ts` (L76)
- [ ] `src/app/api/athlete/team-activity/[id]/reactions/route.ts` (L101, L112, L157)
- [ ] `src/app/api/athlete/videos/[id]/route.ts` (L20)
- [ ] `src/app/api/athlete/videos/route.ts` (L8)

### Coach API

- [ ] `src/app/api/coach/goals/[id]/route.ts` (L100)
- [ ] `src/app/api/coach/goals/route.ts` (L26, L120)
- [ ] `src/app/api/coach/notifications/[id]/route.ts` (L55)
- [ ] `src/app/api/coach/notifications/route.ts` (L51)
- [ ] `src/app/api/coach/sessions/route.ts` (L73)
- [ ] `src/app/api/coach/throws/assessment/route.ts` (L52, L126)
- [ ] `src/app/api/coach/throws/drills/[id]/route.ts` (L71)
- [ ] `src/app/api/coach/throws/drills/route.ts` (L39, L90)
- [ ] `src/app/api/coach/throws/recommendations/route.ts` (L20)

### Videos (coach)

- [ ] `src/app/api/coach/videos/[id]/frame-annotations/route.ts` (L46, L121)
- [ ] `src/app/api/coach/videos/[id]/route.ts` (L23)
- [ ] `src/app/api/coach/videos/[id]/share/route.ts` (L73)
- [ ] `src/app/api/coach/videos/[id]/status/route.ts` (L103)
- [ ] `src/app/api/coach/videos/[id]/transcode/complete/route.ts` (L68, L98)
- [ ] `src/app/api/coach/videos/[id]/transcode/route.ts` (L123, L170)
- [ ] `src/app/api/coach/videos/route.ts` (L23, L135)
- [ ] `src/app/api/coach/videos/upload-local/route.ts` (L44)
- [ ] `src/app/api/coach/videos/upload-thumbnail-local/route.ts` (L35)
- [ ] `src/app/api/coach/videos/upload-thumbnail-url/route.ts` (L39, L43)
- [ ] `src/app/api/coach/videos/upload-url/route.ts` (L58, L69)

### Push / readiness

- [ ] `src/app/api/push/send/route.ts` (L115)
- [ ] `src/app/api/push/vapid-key/route.ts` (L25)
- [ ] `src/app/api/readiness/[athleteId]/latest/route.ts` (L69)
- [ ] `src/app/api/readiness/route.ts` (L90)

## Definition of done

- Every checkbox above is ticked.
- `grep -r "HIGH-03-follow-up" src` returns zero hits.
- `npm run lint` clean with no route-level `eslint-disable` for `no-restricted-syntax`.
- Every migrated route has at least one commit touching both route + its client consumer (or a note in the commit that the endpoint has no client consumer, e.g. server-internal cron jobs).

When this doc has nothing left to tick, **delete it**. It is a live working doc scoped to this single migration, not permanent documentation.
