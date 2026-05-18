# parseBody audit — remaining mutation routes

**Filed:** 2026-05-17, after the HIGH-03 envelope migration closed.
**Sibling concern:** [HIGH-03 envelope](../../CLAUDE.md) — the 36 TODO routes are
complete; the canonical envelope eslint rule (`no-bare-nextresponse-json`)
remains the source of truth.

## What this covers

Per CLAUDE.md §6 every mutation handler MUST validate via
`parseBody(req, Schema)` from `@/lib/api-schemas`. Routes that still call
`request.json()` directly survived the HIGH-03 migration — most of them
never had inline validation in the first place. They're sorted below by
risk so the next pass can attack the right routes first.

Audit run: list produced by

```bash
for f in $(grep -rl "request\.json()\|req\.json()" src/app/api --include='route.ts'); do
  if ! grep -q "parseBody\|parseBodyText" "$f"; then echo "$f"; fi
done
```

Anything below is on the wrong side of that guard.

## Already covered in the HIGH-03 PR

Migrated in this commit:

- `api/athlete/notification-preferences` (POST)
- `api/athlete/push-preferences` (PATCH)
- `api/athlete/self-program/[id]` (PUT)
- `api/athlete/team-activity/[id]/reactions` (POST + DELETE)
- `api/athlete/throws` (POST) — daily-use, top priority
- `api/coach/announcements` (POST) + `[id]` (PATCH)
- `api/coach/competitions` (POST + PATCH)
- `api/coach/notification-preferences` (POST)
- `api/coach/sessions` (POST)
- `api/coach/throws/assessment` (POST)
- `api/coach/throws/drills` (POST) + `[id]` (PUT)
- `api/coach/videos` (POST) + `[id]` (PUT) + status/transcode/share/frame-annotations
- `api/coach/notifications` (PATCH) + `[id]` (PATCH)
- `api/coach/videos/upload-url` + `upload-thumbnail-url`
- `api/push/send` (POST) — internal/cron only
- `api/readiness` (POST)
- `api/user/timezone` (PATCH)
- `api/user/mode` (PUT)

## Already safe — inline `Schema.safeParse(json)` covers them

Cosmetic refactor only; deferred until someone routes through this area.

- `api/auth/me`
- `api/athlete/dashboard-config`
- `api/feedback/beta`
- `api/notifications/preferences`
- `api/notifications/[id]`
- `api/video-analysis/[id]`

## Tier 1 — athlete daily flow

High call volume, athlete-facing, must not silently 400.

- `api/athlete/availability/[id]`
- `api/athlete/self-program/[id]/session/[sessionId]` (PUT)
- `api/athlete/session-recap/[sessionId]/wellness`

## Tier 2 — coach daily flow

Mutations a coach hits while running practice.

- `api/coach/onboarding`
- `api/coach/settings` + `api/coach/autoregulation-settings`
- `api/coach/plans/[id]`
- `api/coach/questionnaires` + `[id]/assign`
- `api/coach/exercises` + `[id]`
- `api/coach/programming` + `[id]` + `[id]/override`
- `api/coach/practices` + `[id]` + `[id]/attendance`
- `api/coach/event-groups/[id]` + `[id]/members`
- `api/coach/team-links` + `[id]` + `reorder`
- `api/coach/team-files` + `upload-url`
- `api/coach/team-activity` (POST)
- `api/coach/videos/[id]/annotations`
- `api/coach/athletes/[athleteId]/profile-picture` (FormData — Zod still useful for the metadata frame)
- `api/coach/profile-picture` (same)

## Tier 3 — throws domain

Programming engine surface — body shapes are non-trivial; expect each to
need a dedicated schema.

- `api/throws/comments` + `[id]` + `mark-thread-read` + `audio-upload-url`
- `api/throws/assignments/[id]/log-throw`
- `api/throws/podium-roster/[athleteId]/testing`
- `api/throws/program/preview`
- `api/throws/program/generate`
- `api/throws/program/generate-for-athlete`
- `api/throws/program/onboard`
- `api/throws/program/[programId]/sessions/[sessionId]/throws`
- `api/throws/program/[programId]/sessions/[sessionId]/reschedule`

## Tier 4 — secondary or feature-gated

Lower call volume. Some are admin/external.

- `api/admin/upgrade` — admin-only
- `api/codex` — internal tooling
- `api/invitations`
- `api/stripe/checkout`
- `api/lifting/workouts/[id]`
- `api/lifting/programs/[id]`
- `api/whoop/sync`, `api/oura/sync` — wearable adapters; bodies arrive from external SDK code

## Permanent or special-case (do NOT add parseBody)

- `api/webhooks/video-processing` — webhook contract owned by an external
  service; exempted in `.eslintrc.json` `overrides`. Validation belongs at
  the Cloudflare Stream signature layer, not parseBody.
- `api/push/subscribe` — payload is the W3C PushSubscription `.toJSON()`
  shape; it has its own test suite at
  `src/app/api/push/subscribe/__tests__/route.test.ts`. Touch only with a
  schema that mirrors `PushSubscriptionJSON`.

## Recipe per file

1. Add a route-specific Zod schema in `src/lib/api-schemas.ts`. Form-fed
   fields use `.nullable().optional()` per CLAUDE.md §4.
2. In the route, replace
   ```ts
   const body = await req.json().catch(() => ({}));
   ```
   with
   ```ts
   const parsed = await parseBody(req, MyRouteSchema);
   if (parsed instanceof NextResponse) return parsed;
   const { ... } = parsed;
   ```
3. Delete the inline `typeof` validation that the schema now owns. Keep
   any cross-field business rules (e.g. roster membership, ownership
   checks).
4. If the route already emits canonical envelopes, you're done. If it
   doesn't, fold the envelope migration into the same commit.
5. Add a smoke test in
   `src/lib/__tests__/api-schemas-envelope.test.ts` for any non-trivial
   schema — at minimum, one happy-path + one regression case.

## Definition of done

- This doc is empty (delete it).
- `for f in $(grep -rl "request.json()" src/app/api --include='route.ts'); do
 if ! grep -q "parseBody\|parseBodyText" "$f"; then echo "$f"; fi; done`
  returns only the two permanent exemptions.
