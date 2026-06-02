# R2 Private Media Serving — Rollout

## What this changes

Athlete videos/images were served from a **public** R2 bucket: access relied on
the URL being unguessable, and the bytes had **no per-request authorization** —
anyone with (or guessing) a URL could fetch the object forever, bypassing the
app's auth.

This change makes the already-authenticated read routes mint **short-lived
presigned GET URLs** instead of returning permanent public links, so the
existing `requireCoachAthlete` / `canAccessAthlete` checks now gate the bytes.

It is **env-gated** by `R2_PRIVATE_SERVING` (default off = current behavior), so
the code deploys with **zero behavior change** and is toggled on per-environment.

## Why it's safe to ship before flipping the bucket

A presigned GET works against a **public bucket too**. So presigned serving can
be enabled and fully verified while the bucket is still public — and rolled back
instantly via the flag — _before_ the bucket is made private. The bucket flip is
the **last** step, after everything is confirmed working.

## How it works

- `src/lib/r2.ts` → `toServeUrl(stored, { key? })`: off → returns `stored`
  unchanged; on → mints a presigned GET (key from the persisted key field where
  available — `storageKey`/`r2Key`/`fileKey` — else recovered from the stored
  public URL via `extractR2KeyFromUrl`). Fails **open** to the stored URL on any
  signing error so playback is never hard-broken. `R2_PUBLIC_URL` must stay set
  even after the bucket is private — it's the key-decoder for url-only models.
- Applied in the GET handlers of: video-analysis (+ `[id]`), coach/videos,
  coach athletes videos, drill-videos, throws/comments (audio), codex,
  coach + athlete team-files. (voice-notes streams via its own `[noteId]` byte
  route, untouched here.)
- `next.config.mjs` allows `*.r2.cloudflarestorage.com` so `next/image` can load
  presigned thumbnails.

## Rollout steps (in order)

1. **Deploy this PR** with `R2_PRIVATE_SERVING` unset/false everywhere. No
   behavior change — confirm prod video still plays normally.
2. **Configure R2 CORS** on the bucket to allow `GET, HEAD` from the app origin
   (the canvas-based video analysis draws frames cross-origin and will taint /
   throw without it). `configureR2Cors()` in `r2.ts` sets `GET/HEAD/PUT/OPTIONS`
   from `*` — apply it (or set equivalent CORS in the Cloudflare dashboard).
3. **Flip `R2_PRIVATE_SERVING=true` on Preview** (or a staging env) and verify
   every surface against the **still-public** bucket:
   - [ ] Athlete training video playback (`/athlete/videos/[id]`, dashboard recent)
   - [ ] Drill video playback (coach + athlete)
   - [ ] Throw/competition video playback
   - [ ] **Video-analysis canvas** — frame scrubbing, snapshot/draw (CORS-sensitive)
   - [ ] Thumbnails (grids, `next/image`) render
   - [ ] Team-file downloads
   - [ ] Codex video playback
   - [ ] Audio comments play
4. **Flip `R2_PRIVATE_SERVING=true` on Production**; re-verify the above on prod
   (bucket still public — this isolates code behavior from the bucket change).
5. **Make the R2 bucket private** (Cloudflare: disable public access / remove the
   `r2.dev` public dev URL binding). Keep `R2_PUBLIC_URL` set. Re-verify a couple
   of surfaces — public links should now 403, presigned links still work.
6. Done. To roll back at any point: set `R2_PRIVATE_SERVING=false` **and** re-open
   public access (both, since stored URLs are public-form).

## Notes / known trade-offs

- Presigned URLs change every request (new signature), so `next/image`'s
  optimizer cache-key changes each load → thumbnails re-optimize per request.
  Functionally fine; if it adds noticeable load, mark presigned thumbnails
  `unoptimized` or add a dedicated thumbnail proxy. Not required for correctness.
- Default presign TTL is 1h (`getPresignedDownloadUrl`). A video open longer than
  that may need a refresh; acceptable for current session lengths.
- Avatars are inline `data:` URLs, **not** R2 — unaffected.
