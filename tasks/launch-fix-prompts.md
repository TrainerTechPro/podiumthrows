# Launch Fix Prompts — Podium Throws

Prompts organized into sessions. Run each in a fresh `claude` session. Use `/clear` between sessions.

---

## Session 1: Critical Security Fixes (Auth & Secrets)

```
Fix these 6 critical security issues in Podium Throws. Do them all in this session, one at a time, verifying each with `tsc --noEmit` after.

1. **Hardcoded JWT fallback** — `src/lib/auth.ts:5` has `|| "dev-secret-change-me"`. Remove the fallback. Throw an error at module load if `JWT_SECRET` is not set and `NODE_ENV === "production"`. Keep the fallback only for development.

2. **Hardcoded CRON_SECRET optional guard** — `src/app/api/cron/recurring-forms/route.ts:17-20` short-circuits if `CRON_SECRET` is unset. Change the logic: if `CRON_SECRET` is not set, return 500 "CRON_SECRET not configured". The check should be `if (!cronSecret || authHeader !== \`Bearer \${cronSecret}\`)`.

3. **Practice attempt IDOR** — `src/app/api/throws/practice/[sessionId]/attempts/route.ts` accepts `athleteId` from the request body but never verifies the coach owns that athlete. Add a `canAccessAthlete(user.userId, user.role as "COACH" | "ATHLETE", athleteId)` check from `src/lib/authorize.ts` BEFORE the PR upsert and attempt creation. Return 403 if unauthorized.

4. **Password change bcrypt mismatch** — `src/app/api/auth/me/route.ts:85` uses hardcoded `10` rounds. Import `SALT_ROUNDS` from `src/lib/auth.ts` and use that instead. If `SALT_ROUNDS` is not exported, export it.

5. **`stripeCustomerId` exposed** — `src/app/api/auth/me/route.ts` includes `stripeCustomerId: true` in the coach profile select. Remove it from the select — frontend doesn't need it.

6. **Register route swallows errors** — `src/app/api/auth/register/route.ts:137-142` has an empty catch block with no logging. Add `console.error("[register] Registration failed:", error)` inside the catch.

After all 6 fixes, run `tsc --noEmit` and confirm 0 errors. Commit with message: "fix: critical security hardening (JWT, IDOR, cron, bcrypt, data exposure)"
```

---

## Session 2: Rate Limiting & Password Reset

```
Fix the rate limiting and password reset systems in Podium Throws.

**Part 1: Move password reset tokens to the database**

The current implementation at `src/lib/resetTokenStore.ts` uses an in-memory Map that won't survive serverless cold starts.

1. Check if there's already a `PasswordResetToken` model in `prisma/schema.prisma`. If not, add one:
   - id (cuid)
   - token (String, @unique)
   - userId (String, relation to User)
   - expiresAt (DateTime)
   - usedAt (DateTime?, nullable — set when consumed)
   - createdAt (DateTime, @default(now()))

2. Rewrite `src/lib/resetTokenStore.ts` to use Prisma instead of the Map:
   - `storeToken(token, userId, expiresAt)` → `prisma.passwordResetToken.create()`
   - `getToken(token)` → `prisma.passwordResetToken.findUnique()` checking expiry and `usedAt === null`
   - `deleteToken(token)` → `prisma.passwordResetToken.update({ usedAt: new Date() })`

3. Update `src/app/api/auth/forgot-password/route.ts` and `src/app/api/auth/reset-password/route.ts` to use the new functions. Keep the same external API shape.

4. Run `npx prisma db push` to sync the schema locally if needed for type checking.

**Part 2: Apply rate limiting to auth endpoints**

The rate limiter at `src/lib/rate-limit.ts` exists but is never imported anywhere.

1. Read `src/lib/rate-limit.ts` to understand the `checkRateLimit` function signature.

2. Apply rate limiting to these 4 routes by adding a call to `checkRateLimit` at the top of each POST handler. Use the request IP or a fallback identifier. Return 429 with a `Retry-After` header when limited:
   - `src/app/api/auth/login/route.ts` — 5 attempts per minute per IP
   - `src/app/api/auth/register/route.ts` — 3 attempts per minute per IP
   - `src/app/api/auth/forgot-password/route.ts` — 3 attempts per minute per IP
   - `src/app/api/auth/reset-password/route.ts` — 5 attempts per minute per IP

3. Add a comment in the rate-limit file noting the in-memory limitation for serverless and that Upstash Redis should replace it before scale.

Run `tsc --noEmit` after. Commit: "fix: move password reset to DB and apply rate limiting to auth endpoints"
```

---

## Session 3: Build Script & Migration Setup

```
Fix the dangerous build configuration in Podium Throws.

**Problem:** `package.json` build script runs `prisma db push` on every Vercel deploy, which can silently drop columns or corrupt production data.

1. Read `package.json` and find the `build` script.

2. Change the build script from:
   `"build": "prisma generate && prisma db push && next build"`
   to:
   `"build": "prisma generate && next build"`

3. Add a new script:
   `"db:migrate:deploy": "prisma migrate deploy"`
   `"db:push": "prisma db push"`

4. Check if `prisma/migrations/` directory exists. If not, run `npx prisma migrate dev --name init` to create the initial migration from the current schema. This captures the current state.

5. Also fix the deprecated config key in `next.config.mjs`:
   - Change `serverComponentsExternalPackages` to `serverExternalPackages` (moved in Next.js 14.1+)

6. Check if `instrumentationHook: true` is set in next.config.mjs. If so and there's no `src/instrumentation.ts` file, remove the `instrumentationHook` config option — it adds overhead with no benefit.

Run `tsc --noEmit` after. Commit: "fix: remove prisma db push from build, init migration history, fix deprecated config"
```

---

## Session 4: Billing & Subscription Hardening

```
Fix subscription enforcement gaps in Podium Throws billing system.

**Fix 1: Plan limit check on athlete registration**

File: `src/app/api/auth/register/route.ts`

Inside the `else if (role === "ATHLETE")` branch (around line 82-108), BEFORE creating the athleteProfile, add a plan limit check:
- Look up the coach via the invitation's `coachId`
- Count the coach's current athletes
- Import `PLAN_LIMITS` from `src/lib/stripe.ts` (or wherever it's defined)
- If `coach._count.athletes >= PLAN_LIMITS[coach.plan]`, return 403 "Coach has reached their plan's athlete limit"
- This prevents acceptance of invitations issued before a downgrade

**Fix 2: Revoke pending invitations on downgrade**

File: `src/app/api/webhooks/stripe/route.ts`

In the `handleSubscriptionDeleted` function, after setting `plan: "FREE"`, add:
```typescript
await prisma.invitation.updateMany({
  where: { coachId: coach.id, status: "PENDING" },
  data: { status: "REVOKED" }
});
```
Check the Invitation model in the schema first to confirm the status field and valid values.

**Fix 3: Track payment failure state**

1. Add `paymentFailedAt DateTime?` to the `CoachProfile` model in `prisma/schema.prisma`
2. In the `handleInvoicePaymentFailed` function in the webhook route, update the coach:
   ```typescript
   await prisma.coachProfile.update({
     where: { id: coach.id },
     data: { paymentFailedAt: new Date() }
   });
   ```
3. In `handleSubscriptionUpdated`, when a successful subscription update comes in (not canceling), clear it:
   `paymentFailedAt: null`

**Fix 4: Fix "Active" status label**

File: `src/app/(dashboard)/coach/settings/page.tsx`

Find the hardcoded "Active" status label (around line 626). Replace it with logic that shows:
- "Active" if plan is PRO/ELITE and no paymentFailedAt
- "Past Due" (amber) if paymentFailedAt is set
- "Free Plan" if plan is FREE
- "Canceling" if subscription is set to cancel at period end (check `cancelAtPeriodEnd` field if it exists on CoachProfile, or add it)

**Fix 5: Show billing period end date**

In the same billing tab, display `currentPeriodEnd` formatted as a human-readable date: "Renews on March 15, 2026" or "Access until March 15, 2026" if canceling.

Run `tsc --noEmit` after all fixes. Commit: "fix: harden subscription enforcement, payment failure tracking, billing UI"
```

---

## Session 5: Error Boundaries, 404, Legal Pages

```
Add missing error handling pages and legal stubs for Podium Throws launch.

**1. Create `src/app/error.tsx`**
- Root-level error boundary for public pages (landing, pricing, auth)
- Match the existing design system: dark background, Outfit font for heading, DM Sans for body, amber/gold accent
- Show a friendly error message with a "Go Home" button
- `console.error` the error in a useEffect
- Must be a client component ("use client")
- Reference the existing `src/app/(dashboard)/coach/error.tsx` for design patterns

**2. Create `src/app/not-found.tsx`**
- Styled 404 page matching the app design system
- Show "Page Not Found" with a brief message
- Include links to `/` (home), `/login` (sign in)
- Match the dark theme with amber accents

**3. Create `src/app/privacy/page.tsx`**
- Minimal but professional privacy policy page
- Company: Podium Throws
- Cover: data collected (name, email, training data, video), purpose (coaching platform), storage (PostgreSQL, Cloudflare R2), cookies (auth-token, theme), third parties (Stripe for payments, Resend for email)
- Include contact email placeholder: privacy@podiumthrows.com
- Use the app's design system (dark bg, proper fonts)
- Server component, export metadata with title

**4. Create `src/app/terms/page.tsx`**
- Minimal but professional terms of service
- Cover: service description, subscription terms, acceptable use, data ownership (coaches own their data), limitation of liability
- Contact: legal@podiumthrows.com placeholder
- Match design system
- Server component, export metadata with title

**5. Create `src/app/(auth)/error.tsx`**
- Error boundary for auth pages specifically
- Similar to the dashboard error boundaries but with a link back to `/login`

Run `tsc --noEmit` after. Commit: "feat: add error boundaries, 404 page, privacy policy, terms of service"
```

---

## Session 6: SEO & Deployment Config

```
Fix SEO and deployment configuration issues for Podium Throws launch.

**1. Create `public/robots.txt`**
```
User-agent: *
Allow: /
Allow: /pricing
Disallow: /coach/
Disallow: /athlete/
Disallow: /api/
Sitemap: https://podiumthrows.com/sitemap.xml
```

**2. Create `src/app/sitemap.ts`**
- Export a default function that returns a sitemap array
- Include: `/` (weekly), `/pricing` (monthly), `/login` (monthly), `/register` (monthly), `/privacy` (yearly), `/terms` (yearly)
- Use `NEXT_PUBLIC_APP_URL` env var for the base URL with localhost fallback

**3. Create OG images**
- Create `public/og-image.png` — a simple 1200x630 placeholder image. Use a solid dark background (#1a1a2e or similar from the theme) with "Podium Throws" text and tagline "Elite Throws Coaching Platform" in the center. If you can't generate images, create an SVG-based solution using `src/app/api/og/route.tsx` with Next.js OG image generation (`next/og` ImageResponse).
- Create `public/og-pricing.png` — similar but with "Pricing" subtitle

**4. Consolidate security headers**
- Read both `vercel.json` and `next.config.mjs` to see the conflicting headers
- Pick ONE source of truth (recommend `next.config.mjs` since it's in the codebase)
- Remove the `headers` array from `vercel.json`, keep only cron config and other non-header settings
- In `next.config.mjs`, ensure these headers are set correctly:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(self), geolocation=()` (microphone needed for voice notes)
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

**5. Add favicon**
- Check if there's any icon in `public/` or `src/app/`. If `favicon.ico` is missing, note it as a TODO — generating a proper icon requires design tools.

**6. Fix localhost fallbacks**
- In `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/portal/route.ts`, and `src/lib/email.ts`:
  - Change the pattern from `process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"` to throw in production:
  ```typescript
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
  if (!APP_URL && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL must be set in production");
  }
  const baseUrl = APP_URL || "http://localhost:3000";
  ```

Run `tsc --noEmit` after. Commit: "feat: add robots.txt, sitemap, OG images, consolidate security headers"
```

---

## Session 7: Frontend UX Fixes (Silent Errors & Missing Navigation)

```
Fix silent error handling and navigation issues across the Podium Throws frontend.

**Part 1: Fix silent catch blocks (add user-facing error feedback)**

These files have empty or silent catch blocks. For each, add a toast/alert state that shows an error message to the user. Use the existing pattern from other forms in the app (look for how errors are displayed — likely a state variable + red inline div).

1. `src/app/(dashboard)/coach/my-program/page.tsx` — find the empty catch block for the program fetch. Add `setError("Failed to load program. Please try again.")` and render the error.

2. `src/app/(dashboard)/athlete/throws/profile/page.tsx` — find the `/* ignore */` catch blocks for check-in save and PR record save. Add error state and display.

3. `src/app/(dashboard)/coach/throws/roster/page.tsx` — find `/* silently ignore */` in the removal catch. Add error feedback: "Failed to remove athlete. Please try again."

4. `src/app/(dashboard)/athlete/throws/quiz/page.tsx` lines 96-100 — the quiz final save catch just allows retry with no message. Add `setError("Failed to save quiz results. Please try again.")` and display it.

**Part 2: Add exit/cancel buttons to trapped wizards**

5. `src/app/(dashboard)/athlete/throws/quiz/page.tsx` — Add a "Cancel" or "Exit Quiz" link at the top of the page that navigates back to `/athlete/throws/profile`. It should be subtle (text link, not a big button) but visible.

6. `src/app/(dashboard)/coach/my-program/onboard/page.tsx` — At step 0, the Back button is disabled. Add a "Cancel" text link next to it (or replace the disabled back with "Cancel") that navigates to `/coach/my-program`.

**Part 3: Fix non-clickable cards**

7. `src/app/(dashboard)/coach/my-program/page.tsx` — The phase cards (around lines 213-261) are plain `<div>` elements. Make them visually indicate interactivity (add `cursor-pointer` and hover state) and have them expand/collapse to show the sessions within that phase, or link to a phase detail view if one exists.

8. `src/app/(dashboard)/coach/questionnaires/[id]/page.tsx` — The assignment rows (around lines 273-291) should link to the individual response. Check if there's a response detail route. If so, wrap each row in a Link. If not, note it as a TODO.

Run `tsc --noEmit` after. Commit: "fix: add error feedback to silent catches, exit buttons to wizards, clickable cards"
```

---

## Session 8: Loading States

```
Add loading.tsx skeleton files to all Podium Throws dashboard pages that are missing them.

Currently only 6 pages have loading.tsx:
- /coach/dashboard, /coach/athletes, /coach/athletes/[id], /coach/sessions, /coach/videos, /athlete/dashboard

Create loading.tsx for these pages. Each should export a default function returning a skeleton using the shimmer pattern already in the codebase. Check `src/components/` for any existing Skeleton or Shimmer components.

Use this pattern for each: a container matching the page layout with animated placeholder blocks (gray rounded rectangles with shimmer animation). Keep them simple — header placeholder + a few content block placeholders.

Pages to add loading.tsx to (prioritized by traffic):

**Coach pages:**
1. `src/app/(dashboard)/coach/throws/loading.tsx` — header + grid of card skeletons
2. `src/app/(dashboard)/coach/exercises/loading.tsx` — header + table skeleton
3. `src/app/(dashboard)/coach/questionnaires/loading.tsx` — header + list skeleton
4. `src/app/(dashboard)/coach/notifications/loading.tsx` — header + list skeleton
5. `src/app/(dashboard)/coach/settings/loading.tsx` — header + tab bar + form skeleton
6. `src/app/(dashboard)/coach/invitations/loading.tsx` — header + table skeleton

**Athlete pages:**
7. `src/app/(dashboard)/athlete/sessions/loading.tsx` — header + list skeleton
8. `src/app/(dashboard)/athlete/wellness/loading.tsx` — header + form skeleton
9. `src/app/(dashboard)/athlete/throws/loading.tsx` — header + chart + list skeleton
10. `src/app/(dashboard)/athlete/questionnaires/loading.tsx` — header + list skeleton
11. `src/app/(dashboard)/athlete/goals/loading.tsx` — header + card grid skeleton
12. `src/app/(dashboard)/athlete/achievements/loading.tsx` — header + badge grid skeleton

Use the existing design system: dark backgrounds, rounded corners, animate-pulse on placeholder blocks. Look at the existing loading.tsx files for the exact Tailwind classes and pattern being used. Be consistent.

Run `tsc --noEmit` after. Commit: "feat: add loading skeletons for all major dashboard pages"
```

---

## Session 9: API Route Ownership & Authorization Fixes

```
Fix authorization gaps in Podium Throws API routes.

**Fix 1: `GET /api/throws/program/[programId]/sessions/[sessionId]/best-marks`**
File: `src/app/api/throws/program/[programId]/sessions/[sessionId]/best-marks/route.ts`

The GET handler verifies the session belongs to the program but NOT that the user owns the program. Add an ownership check:
- If role is ATHLETE: verify `program.athleteId === athleteProfile.id`
- If role is COACH: verify `program.coachId === coachProfile.id` (or use `canAccessAthlete` with the program's athleteId)
- Return 403 if unauthorized

**Fix 2: Fix fragile coach exclusion in program routes**

These routes rely on `null?.id !== program.athleteId` to block coaches, which works by coincidence. Add explicit role checks:

Files to fix (same pattern in each):
- `src/app/api/throws/program/[programId]/route.ts`
- `src/app/api/throws/program/[programId]/sessions/[sessionId]/route.ts`
- `src/app/api/throws/program/[programId]/sessions/[sessionId]/complete/route.ts`
- `src/app/api/throws/program/[programId]/sessions/[sessionId]/throws/route.ts`
- `src/app/api/throws/program/[programId]/sessions/[sessionId]/lifts/route.ts`
- `src/app/api/throws/program/[programId]/today/route.ts`

For each, change the ownership check pattern from:
```typescript
const athleteProfile = await prisma.athleteProfile.findUnique({ where: { userId: user.userId } });
if (program.athleteId !== athleteProfile?.id) return 403;
```
To:
```typescript
if (user.role === "ATHLETE") {
  const athleteProfile = await prisma.athleteProfile.findUnique({ where: { userId: user.userId } });
  if (!athleteProfile || program.athleteId !== athleteProfile.id) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
} else if (user.role === "COACH") {
  const coachProfile = await prisma.coachProfile.findUnique({ where: { userId: user.userId } });
  if (!coachProfile || program.coachId !== coachProfile.id) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
}
```

**Fix 3: Disable the exercise library seed endpoint in production**

File: `src/app/api/exercise-library/seed/route.ts`

Add at the top of the POST handler:
```typescript
if (process.env.NODE_ENV === "production") {
  return NextResponse.json({ success: false, error: "Seed endpoint disabled in production" }, { status: 403 });
}
```

Run `tsc --noEmit` after all fixes. Commit: "fix: add ownership checks to program routes, disable seed in production"
```

---

## Session 10: Environment Variables & Config Cleanup

```
Fix environment variable configuration and documentation for Podium Throws.

**1. Update `.env.example`**

Read the current `.env.example`, then update it to include ALL required environment variables the app actually uses. Group them with comments:

```env
# Database (Vercel Postgres)
POSTGRES_PRISMA_URL=postgresql://user:pass@host:5432/db?pgbouncer=true
POSTGRES_URL_NON_POOLING=postgresql://user:pass@host:5432/db

# Auth
JWT_SECRET=generate-a-strong-random-string-here

# App
NEXT_PUBLIC_APP_URL=https://podiumthrows.com

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ELITE=price_...
# STRIPE_PRICE_PRO_ANNUAL=price_...    # TODO: create annual prices
# STRIPE_PRICE_ELITE_ANNUAL=price_...  # TODO: create annual prices

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_FROM=Podium Throws <noreply@podiumthrows.com>

# Cron
CRON_SECRET=generate-a-strong-random-string-here

# Error Monitoring (optional)
# SENTRY_DSN=https://...

# AI / External APIs (if used)
# RAPIDAPI_KEY=...
```

**2. Verify `.gitignore` includes `.env`**

Read `.gitignore` and confirm these patterns are present:
- `.env`
- `.env.local`
- `.env.*.local`

If `.env` is NOT in `.gitignore`, add it immediately.

**3. Fix the `NEXT_PUBLIC_APP_URL` naming issue**

This variable is only used server-side (Stripe routes, email). Create a new `APP_URL` variable usage:
- In `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/portal/route.ts`, and `src/lib/email.ts`:
  - Read from `process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL` (backward compatible)
  - Update `.env.example` to show `APP_URL` as the primary

Actually — keep backward compatibility. Just add a note in `.env.example` that `NEXT_PUBLIC_APP_URL` is used server-side despite the prefix.

Run `tsc --noEmit` after. Commit: "chore: update .env.example, verify gitignore, document env vars"
```

---

## Session 11: Database Schema Cleanup

```
Clean up the Podium Throws Prisma schema to remove dead models and fix relation safety.

**1. Add onDelete directives to unprotected relations**

In `prisma/schema.prisma`:
- `ThrowsProfile.coach` relation (search for `@relation("ThrowsProfileCoach")`) — add `onDelete: SetNull`. Also make `enrolledBy` nullable if it isn't (`String?`).
- `TrainingProgram.coach` relation — add `onDelete: SetNull` (coachId is already nullable).

**2. Comment out orphaned models (don't delete yet)**

These models are defined but have zero usage in the codebase. Wrap each in a block comment with a note: `// DEPRECATED: Not used in any API route or page. Remove after confirming no data exists.`

- `AnalysisVideo` and `VideoAnnotation`
- `RiskAssessment`
- `BodyMeasurement`
- `MobilityAssessment`
- `AthleteGoal` (the SMART framework version — `Goal` is the one actually used)
- `Injury` (the general version — `ThrowsInjury` is the one actually used)

Actually — DON'T comment them out yet. Just add a `// DEPRECATED - unused, candidate for removal` comment above each model. Removing models from the schema would require a migration and could fail if tables have data. This is a post-launch cleanup task.

**3. Fix missing enum usage**

These fields should use existing enums but are typed as `String`. For each, change the field type in the schema to the appropriate enum. Only do this if the enum already exists in the schema:

- `ThrowsAssignment.status` → if there's an enum like `AssignmentStatus`, use it. If not, create one: `enum AssignmentStatus { PENDING COMPLETED SKIPPED }`
- `ThrowsProfile.status` → create `enum ProfileStatus { ACTIVE INACTIVE }` if it doesn't exist
- `TrainingProgram.status` → create `enum ProgramStatus { ACTIVE COMPLETED PAUSED }` if needed

Only change fields where you can confirm the valid values from the codebase. Don't guess. Read the API routes that write to these fields to see what values are used.

Run `tsc --noEmit` after. Do NOT run prisma db push — these are schema documentation changes that should go through proper migration. Commit: "chore: annotate deprecated models, add onDelete directives, document enum candidates"
```

---

## Session 12: Webhook Idempotency & Stripe Resilience

```
Add webhook idempotency and improve Stripe error handling in Podium Throws.

**1. Add webhook event tracking**

Create a simple model in `prisma/schema.prisma`:
```prisma
model StripeEvent {
  id          String   @id // Use the Stripe event ID directly
  type        String
  processedAt DateTime @default(now())

  @@index([processedAt])
}
```

**2. Add idempotency check to webhook handler**

In `src/app/api/webhooks/stripe/route.ts`, after `stripe.webhooks.constructEvent()` succeeds:

```typescript
// Check idempotency
const existingEvent = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
if (existingEvent) {
  return NextResponse.json({ received: true, duplicate: true });
}

// Process the event...

// After successful processing, record it
await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
```

Wrap the processing + recording in a try/catch so that if processing fails, the event is NOT recorded (allowing Stripe to retry).

**3. Add unknown price ID alerting**

In the `handleSubscriptionUpdated` function, where it currently does `console.warn` and returns on unknown price ID — change it to also update the coach with a flag or at minimum log at error level:
```typescript
console.error(`[ALERT] Unrecognized Stripe price ID: ${priceId} for coach ${coachId}. Manual intervention needed.`);
```

**4. Handle checkout success race condition**

In `src/app/(dashboard)/coach/settings/page.tsx` (or the billing section), if URL has `?upgraded=1`:
- Show a "Processing your upgrade..." message with a spinner
- Poll `/api/auth/me` every 2 seconds for up to 30 seconds
- When the plan changes from FREE, show the success message
- If timeout, show "Your upgrade is being processed. Please refresh in a moment."

Run `tsc --noEmit` after. Commit: "feat: add webhook idempotency, improve Stripe error handling and UX"
```

---

## Session 13: Annual Pricing & Marketing Page Fix

```
The Podium Throws pricing page at `src/app/pricing/_pricing-client.tsx` shows an annual billing toggle with "Save 20%" and displays annual prices ($80/mo, $159/mo), but there are no annual Stripe price IDs or checkout flow to support this.

**Option A (Quick fix for launch):** Remove the annual toggle from the pricing page entirely. Only show monthly pricing. This prevents false advertising. Remove the annual billing FAQ entry too.

Do Option A. Find and remove:
1. The billing toggle (monthly/annual switch)
2. The annual pricing display
3. Any FAQ entry about annual billing
4. Keep only the monthly prices: Free ($0), Pro ($99/mo), Elite ($199/mo)

Add a comment in the code: `// TODO: Add annual billing when STRIPE_PRICE_PRO_ANNUAL and STRIPE_PRICE_ELITE_ANNUAL are configured`

Run `tsc --noEmit` after. Commit: "fix: remove unimplemented annual pricing toggle from marketing page"
```

---

## Session 14: Monitoring & Observability Setup

```
Set up error monitoring for Podium Throws production.

**Option 1 (If you want Sentry):**
1. Install: `npm install @sentry/nextjs`
2. Create `src/instrumentation.ts`:
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });
  }
}
```
3. Update `src/lib/logger.ts` to use Sentry.captureException for error-level logs
4. Update the error boundaries to report to Sentry
5. Keep `instrumentationHook: true` in next.config.mjs (or remove if using the new instrumentation.ts auto-detection)

**Option 2 (Simpler — just structured logging):**
1. Remove `instrumentationHook: true` from next.config.mjs since there's no instrumentation file
2. Update `src/lib/logger.ts` to write structured JSON logs that Vercel can capture:
```typescript
error: (message: string, meta?: Record<string, unknown>) => {
  console.error(JSON.stringify({ level: 'error', message, ...meta, timestamp: new Date().toISOString() }));
}
```
3. Add the logger to API route catch blocks that currently only console.error

Do Option 2 for now (simpler, no new dependencies). Add a TODO comment for Sentry integration.

Also: grep for `console.log` statements in `src/app/api/` that should be removed or converted to the logger. Remove debug console.logs, keep console.error/warn but ideally route them through the structured logger.

Run `tsc --noEmit` after. Commit: "feat: add structured logging, remove debug console.logs, prep for monitoring"
```

---

## Session 15: Input Validation with Zod (Optional but Recommended)

```
Add Zod validation to the most critical Podium Throws API routes.

1. Install zod: `npm install zod`

2. Create `src/lib/validation.ts` with reusable schemas:
```typescript
import { z } from 'zod';

export const cuidSchema = z.string().cuid();
export const emailSchema = z.string().email().max(255);
export const passwordSchema = z.string().min(8).max(128);
export const rpeSchema = z.number().min(1).max(10);
export const scoreSchema = z.number().min(1).max(10);
export const daysSchema = z.number().int().min(1).max(365);
```

3. Add validation to these HIGH-PRIORITY routes (parse request body with zod, return 400 with the zod error messages on failure):

- `POST /api/auth/login` — validate email + password
- `POST /api/auth/register` — validate email, password, name, role
- `POST /api/throws/practice/[sessionId]/attempts` — validate athleteId (cuid), event, implement, distance (number, optional)
- `POST /api/readiness` — validate all score fields are 1-10 integers
- `POST /api/throwflow` — validate keyFrames array has max 30 items
- `GET /api/throws/checkins` — validate `days` query param is 1-365

Pattern for each route:
```typescript
const schema = z.object({ ... });
const parsed = schema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
}
const { field1, field2 } = parsed.data; // Use parsed data, not raw body
```

Run `tsc --noEmit` after. Commit: "feat: add Zod validation to critical API routes"
```

---

## Quick Reference: Session Order by Priority

| Priority | Session | Time Est. |
|----------|---------|-----------|
| P0 | Session 1: Critical Security Fixes | 20 min |
| P0 | Session 2: Rate Limiting & Password Reset | 30 min |
| P0 | Session 3: Build Script & Migration | 15 min |
| P0 | Session 4: Billing Hardening | 30 min |
| P0 | Session 5: Error Boundaries & Legal Pages | 25 min |
| P1 | Session 6: SEO & Deployment Config | 20 min |
| P1 | Session 7: Frontend UX Fixes | 25 min |
| P1 | Session 8: Loading States | 20 min |
| P1 | Session 9: API Authorization Fixes | 25 min |
| P1 | Session 10: Env Vars & Config | 15 min |
| P2 | Session 11: Schema Cleanup | 15 min |
| P2 | Session 12: Webhook Idempotency | 20 min |
| P2 | Session 13: Annual Pricing Fix | 10 min |
| P2 | Session 14: Monitoring Setup | 15 min |
| P2 | Session 15: Input Validation (Zod) | 25 min |
