# Podium Throws

Subscription coaching SaaS for Olympic-level track-and-field throws coaches and their
rosters. Encodes Dr. Anatoliy Bondarchuk's _Transfer of Training_ methodology
into every programming flow — sequencing, validation, and progression are
non-negotiable rules, not configuration.

This is **two products sharing one database**, not one product with two roles:

| Surface            | Audience                                 | Quality bar                                                                                                              |
| ------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Coach desktop**  | D1 + pro coaches managing rosters        | "Built specifically for my profession" — sidebar, ⌘K, tabular density, restrained.                                       |
| **Athlete mobile** | Throwers logging on the sideline / phone | "App I want to open every day" — bottom tabs, big touch targets, celebration moments, Strava/Whoop polish.               |
| **Marketing**      | Acquisition pages (`/`, `/pricing`, …)   | Always-dark editorial register. Flipping chrome between app and marketing should feel like crossing an intentional seam. |

See `CLAUDE.md` for the full divergence table.

## Stack

- Next.js 14.2 App Router + React 18.3 + TypeScript
- PostgreSQL via Prisma (Vercel Postgres), custom JWT auth (HttpOnly cookies, 7-day, bcrypt)
- Stripe (Free / Pro / Elite), Cloudflare R2 for video
- Tailwind 3.4, custom 23-component library — **no shadcn, no MUI, no Chakra, no new UI deps**
- Vitest for unit tests, Playwright for e2e (CI-only), Sentry for production telemetry
- Vercel for hosting and Cron

## MVP feature set

Anything below is shipping in front of customers today and assumed to work.

- Auth (custom JWT, MFA, reset, invitations)
- Coach roster: athletes, groups/event-groups, profile pages, proxy ("unclaimed") athletes
- Coach builder: plan/session creation with Bondarchuk validation (descending order + block structure are gates; differential and cross-block warnings surface non-blocking)
- Coach scheduling: assigning plans to athletes, training sessions, practices/attendance
- Athlete training hub: 3-state landing (programs/sessions/onboarding)
- Athlete throws logging: quick-log + structured session log + offline draft + idempotency + PR celebration
- Athlete self-program (Pro/Elite): guided wizard → Bondarchuk-driven generator
- Personal records (single source of truth, per implement weight) + competition records + meet tracking
- Streak engine (consolidated, weekly freezes, milestones, local 7pm reminder)
- Push notifications (web push), in-app notifications, coach feedback inbox
- Video upload + share + frame annotations + transcode pipeline
- Goals (athlete + coach-assigned), readiness check-in, team activity feed + reactions
- Insights engine (auto-generated coaching insights from logged data)
- Stripe billing, lead capture / waitlist
- Marketing surface (always-dark editorial register, OG images, recap previews)

## Feature-gated / non-MVP modules

These are partially shipped behind flags or product-tier gates. Treat as
secondary when prioritising work — read `tasks/` and recent commits before
touching.

- Lifting programs/workouts (athlete-side strength tracking)
- Coach Programming module (auto-progression engine, override paths)
- Pose / MediaPipe analysis (`src/components/video-analysis/**` — domain-specific colours allowlisted)
- Codex tooling endpoints (`/api/codex/*`)
- Wearables sync (Whoop, Oura) — adapter endpoints exist but the dashboards are not load-bearing
- Drill library + drill video recommendations (live but underused)
- AI features behind `OPENAI_API_KEY` (ThrowFlow session summaries, etc.)
- Admin tooling (`/api/admin/*`)

## Local setup

```bash
# 1. Install deps (also runs `prisma generate` + copies MediaPipe wasm)
npm install

# 2. Copy env template and fill in real values
cp .env.example .env.local

# 3. Start a local Postgres and point the URLs at it
#    Default Tony uses: postgresql://anthonysommers@localhost:5432/podium_throws

# 4. Migrate + seed
npm run db:migrate    # `prisma migrate dev`
npm run db:seed       # tsx prisma/seed.ts

# 5. Run the app
npm run dev           # http://localhost:3000
```

Seeded accounts (created by `npm run db:seed`):

| Role    | Email                | Password   |
| ------- | -------------------- | ---------- |
| Coach   | coach@example.com    | coach123   |
| Athlete | athlete1@example.com | athlete123 |
| Athlete | athlete2@example.com | athlete123 |

**Never** run `npm run db:seed` or `prisma db push` against production —
`.env.local` may have prod credentials. Override `POSTGRES_PRISMA_URL` and
`POSTGRES_URL_NON_POOLING` for destructive operations.

## Environment variables

`.env.example` is the canonical reference — copy and fill it in. Required
groups, at a glance (no secrets here):

| Group          | Vars                                                                                                            | Required?                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Database       | `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`                                                               | yes                                                   |
| Auth           | `JWT_SECRET`                                                                                                    | yes                                                   |
| App            | `NEXT_PUBLIC_APP_URL`                                                                                           | yes                                                   |
| Stripe billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ELITE`, `STRIPE_PRICE_*_ANNUAL` | yes for billing flows                                 |
| Email (Resend) | `RESEND_API_KEY`, `RESEND_FROM`                                                                                 | yes for lead capture / welcome emails                 |
| Email (SMTP)   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`                                                 | optional — falls back to Ethereal test inbox          |
| Cron           | `CRON_SECRET`                                                                                                   | yes for Vercel Cron jobs                              |
| Video (R2)     | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`                  | required as a set — stubbed if any missing            |
| Rate limit     | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                            | optional — in-memory fallback for dev                 |
| AI (ThrowFlow) | `OPENAI_API_KEY`, `OPENAI_API_BASE`, `THROWFLOW_MODEL`                                                          | optional, feature-gated                               |
| Sentry         | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`                     | optional — recommended in prod                        |
| Internal API   | `INTERNAL_API_SECRET`                                                                                           | required if calling `/api/push/send` server-to-server |

## Common commands

```bash
# Dev / build
npm run dev                 # next dev
npm run build               # prisma migrate deploy + prisma generate + next build
npm run start

# Quality gates (run these before pushing)
npm run typecheck           # tsc --noEmit
npm run lint                # next lint (ESLint, includes envelope + silent-catch rules)
npm run lint:hex            # ratcheting baseline for hardcoded hex literals
npm run lint:text           # ratcheting baseline for bracketed text sizes
npm run test                # vitest run
npm run test:watch          # vitest in watch mode
npm run test:e2e            # Playwright (heavy; CI runs this on PR)
npm run build:check         # typecheck + lint + test in one shot

# Database
npm run db:migrate          # prisma migrate dev (local schema sync)
npm run db:migrate:deploy   # prisma migrate deploy (CI / prod only)
npm run db:seed             # tsx prisma/seed.ts
npm run db:reset            # migrate reset --force + seed
npm run db:studio           # prisma studio

# Formatting
npm run format              # prettier --write src/**
npm run format:check        # prettier --check src/**

# Deployment (manual)
npm run deploy              # bash scripts/deploy.sh
npm run deploy:prod         # production deploy
```

Pushing to `main` is blocked — work on `feat/*` branches and merge via
`gh pr merge --auto --squash`. CI gates: typecheck, lint, test, Playwright,
deploy-preview probe.

## API response convention

This is enforced by an ESLint rule (`no-bare-nextresponse-json`). Every API
route returns one of:

```ts
{ success: true, data: T }
{ success: false, error: string }
```

Client consumption pattern:

```ts
const res = await fetch("/api/...");
const payload = await res.json();
if (!res.ok || !payload.success) {
  toast.error(payload.error || `Request failed (${res.status})`);
  return;
}
const result = payload.data; // always read from .data
```

Exemptions live in `.eslintrc.json` `overrides`: Stripe + Cloudflare Stream
webhooks (external contracts) and `src/middleware.ts` (CSRF + rate-limit
shaped before the handler runs).

## Mutation endpoints

Every `POST` / `PUT` / `PATCH` / `DELETE` route MUST validate its body via
the canonical helper:

```ts
import { parseBody, MyRouteSchema } from "@/lib/api-schemas";

const parsed = await parseBody(request, MyRouteSchema);
if (parsed instanceof NextResponse) return parsed; // 400 with fieldErrors
const { ... } = parsed;
```

Form-fed fields must use `.nullable().optional()` — React form state
submits `null` for unset and `.optional()` alone rejects it. See
`docs/follow-ups/parsebody-audit.md` for the routes still on raw
`request.json()` and `src/lib/__tests__/api-schemas-envelope.test.ts`
for the schema regression suite.

## Bondarchuk validation rules

These come from Volume IV of Bondarchuk's _Transfer of Training_ and are
load-bearing — every code path that sequences implements, builds throwing
sessions, or generates programs must enforce them.

| Rule                                            | Severity                          | Source                                        |
| ----------------------------------------------- | --------------------------------- | --------------------------------------------- |
| Implements descend (heavy → light) per block    | **error** — blocks save / API 409 | Vol IV p.114-117                              |
| Strength block must separate consecutive throws | **error** — blocks save / API 409 | Vol IV p.113                                  |
| Cross-block: later block ≤ earlier block max    | warning — surfaces in UI badge    | `validateCrossBlockSequence`                  |
| 15-20% weight differential rule                 | warning — surfaces in UI badge    | Vol IV p.85-88 (`validateWeightDifferential`) |
| Min throws per event (SP/DT/JT 12, HT 8)        | warning                           | `src/lib/throws/validation.ts` rule 5         |
| ≤15% max-effort throws per session              | warning                           | rule 6                                        |
| No mixed light + heavy same session             | warning                           | rule 7                                        |

The two validators live in:

- `src/lib/bondarchuk/session-validators.ts` — `validateFullSession`,
  used by the coach plan builder, drag/drop live view, and log-session APIs.
- `src/lib/throws/validation.ts` — 7-rule `validateSession`, used by the
  throws/program generator endpoints.

When inspecting validation results, gate on `severity === "error"` (or
`canAssign`) — `!result.valid` is too aggressive because it includes soft
warnings that should never block a save.

## Design system constraints

`CLAUDE.md` has the full ruleset; the high-impact constraints are:

- **No new UI deps.** Build inside the existing `src/components/ui` library.
- **Overlays MUST use `bg-[var(--surface-overlay)]`.** Translucent surfaces
  in portals render invisible content in dark mode — this rule exists because
  of a real shipped bug.
- **Cards.** Navigable cards use the `card-interactive` class. Static cards
  use plain `card`. Never hand-roll hover transitions.
- **Icons.** Lucide React only, `strokeWidth={1.75}`, `aria-hidden="true"` on
  decorative icons.
- **Colours.** Use semantic tokens (`text-primary-500`, `text-status-success-fg`,
  `bg-surface-100`...). Hardcoded hex is enforced via `npm run lint:hex` against
  a ratcheting baseline; the allowlist (canvas, email HTML, OG images, marketing,
  event domain colours, IPF plate colours) is in `CLAUDE.md`.
- **Typography.** Headings `font-heading` (Chakra Petch), body `font-body`
  (DM Sans), data `font-mono` (IBM Plex Mono — distances, timestamps, IDs only,
  never prose). Use the `text-display | title | section | body-lg | body | caption
| micro | nano` tokens — `text-[Npx]` bracketed values are enforced via
  `npm run lint:text` against a ratcheting baseline.
- **Marketing routes are always dark.** Wrap top-level marketing containers in
  `<div className="dark ...">` — `--landing-*` tokens have no light variant by
  design.
- **Numeric display.** Hero/dashboard numbers use `<AnimatedNumber>` (count-up
  on viewport entry) or `<NumberFlow>` (smooth transitions on change). Never
  raw `{value}` for stat surfaces.
- **Sheets / confirmations.** All non-anchored edge slides go through
  `<Sheet>` (`side="bottom"` for athlete, `side="right"` for coach). High-stakes
  mobile actions use `<SlideToConfirm>`.

## Code quality (each rule = a real shipped bug)

- **No empty catch blocks.** Every `catch` re-throws OR surfaces to the user
  (toast + `logger.error`).
- **Distinguish empty string from 0** in numeric inputs. `parseFloat(x) || null`
  silently destroys valid 0 values (bodyweight, RPE 0, unweighted implements).
- **Zod `.optional()` ≠ `.nullable()`.** Forms send `null` for unset.
- **Save buttons need two feedback channels.** Toast + visual change, or
  toast + redirect. Single-channel saves get reported as broken.
- **Guard mutations with preconditions.** Don't fire a mutation with
  `null` ID — the API returns a confusing 400.

## Repo layout

```
src/app/(auth)/                 login, register, forgot/reset password
src/app/(dashboard)/coach/      coach surfaces (sidebar shell)
src/app/(dashboard)/athlete/    athlete surfaces (bottom-tab shell)
src/app/(marketing or root)/    landing, pricing, public pages
src/app/api/                    API routes (canonical envelope + parseBody)
src/components/                 UI library + product components
src/lib/                        auth, prisma, stripe, throws engine, bondarchuk, data layer
src/middleware.ts               JWT + CSRF + rate limiting
prisma/schema.prisma            71+ models
prisma/seed.ts                  test accounts + catalog data
scripts/                        deploy, lint:hex, lint:text, screenshots, seed-X scripts
tasks/                          in-progress work, lessons, multi-step plans
docs/                           follow-ups, runbook, superpowers plans
```

## Conventions worth knowing

- **CSRF.** Any client-side mutation must spread `csrfHeaders()` into the
  fetch headers (`import { csrfHeaders } from "@/lib/csrf-client"`) — middleware
  403s any `POST`/`PATCH`/`DELETE` without `X-CSRF-Token`. Vitest never
  exercises middleware, so tests can miss it.
- **Idempotency.** Mutations that may be retried (e.g., questionnaire submit,
  plan assignment) wrap their handler in `withIdempotency({ userId, endpoint, req }, …)`
  and read the body with `parseBodyText`.
- **`waitUntil` from `@vercel/functions`.** Use for fire-and-forget work; this
  repo is on Next 14.2, which doesn't have `unstable_after`.
- **Catalog seeds.** New catalog tables need a standalone prod-safe upsert
  script in `scripts/seed-X.ts` re-imported by `prisma/seed.ts`. Build runs
  `migrate deploy` but never `seed`.

## Where to look

- `CLAUDE.md` — operating stance, full design rules, Bondarchuk domain rules,
  code quality patterns.
- `CLAUDE-standards.md` — invoke-by-name protocol library.
- `tasks/todo.md` — multi-step plans in progress.
- `tasks/lessons.md` — captured corrections and patterns.
- `docs/follow-ups/` — live punch lists (delete when empty).
- `docs/superpowers/plans/` — retroactive docs of shipped initiatives.
