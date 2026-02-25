# PODIUM THROWS — Build From Scratch Prompt Chain
# Send these messages ONE AT A TIME. Wait for completion before sending the next.
# Model recommendation shown for each message.

---

## MESSAGE 1: SCAFFOLD + SCHEMA DESIGN 🧠 OPUS
(This is the most important message — it sets the entire foundation)

═══════════════════════════════════════════════════════

We're building Podium Throws from scratch. Scaffold the full project and design the database.

**Step 1 — Project scaffold:**
Initialize a Next.js 14 App Router project with TypeScript, Tailwind CSS 3.4, and Prisma. Set up the directory structure from CLAUDE.md. Configure:
- Tailwind with custom theme: warm amber/gold primary, dark mode via `darkMode: "class"`, fonts Outfit (Google Fonts) + DM Sans
- Prisma with PostgreSQL provider
- Path aliases (`@/components`, `@/lib`, etc.)
- ESLint + Prettier
- `vercel.json` with security headers (HSTS, CSP, X-Frame-Options)

**Step 2 — Database schema (`prisma/schema.prisma`):**
Design the full schema. This must cover ALL features we'll build. Models needed:

**Users & Auth:**
- User (id, email, password hash, role COACH|ATHLETE, createdAt, updatedAt)
- CoachProfile (linked to User — name, bio, organization, avatar, subscription plan, stripe customer ID)
- AthleteProfile (linked to User — name, events[], gender, dateOfBirth, avatar, linked coach)

**Training:**
- Exercise (name, description, videoUrl, category CE|SD|SP|GP, event, implementWeight, correlationData JSON)
- WorkoutPlan (name, coach, description, blocks as structured JSON or related model)
- TrainingSession (assigned plan, athlete, scheduledDate, completedDate, status)
- SessionLog (session, exercise, sets, reps, weight, rpe, distance, notes, timestamps)

**Throws-Specific:**
- ThrowLog (athlete, event, implementWeight, distance, date, sessionId, notes, videoUrl)
- BondarchukAssessment (athlete, results JSON, athleteType, completedAt)
- DrillLibrary entries

**Wellness & Readiness:**
- ReadinessCheckIn (athlete, date, overallScore, sleepQuality 1-10, sleepHours, soreness 1-10, sorenessArea, stressLevel 1-10, energyMood 1-10, hydration POOR|ADEQUATE|GOOD, injuryStatus NONE|MONITORING|ACTIVE, notes)

**Questionnaires:**
- Questionnaire (coach, title, type, questions JSON)
- QuestionnaireResponse (questionnaire, athlete, answers JSON with question text preserved, completedAt)

**Goals & Achievements:**
- Goal (athlete, title, targetValue, currentValue, unit, deadline, status)
- Achievement (athlete, type, title, description, earnedAt)
- Streak tracking fields on AthleteProfile

**Video:**
- VideoUpload (coach, athlete, url, thumbnailUrl, title, annotations JSON)

**Groups:**
- Team/Group (coach, name, athletes[])

**Invitations:**
- Invitation (coach, email, status PENDING|ACCEPTED, token, expiresAt)

Design with proper indexes on all foreign keys and frequently queried fields. Add `@@index` annotations. Use enums for role, plan, event type, exercise category, etc.

**Step 3 — Seed file (`prisma/seed.ts`):**
Create realistic seed data: 1 coach with Pro plan, 4 athletes across different events (shot put, discus, hammer, javelin), each with:
- 14 days of readiness check-ins with varied scores
- 8-10 completed training sessions with logged sets
- 5-10 throw logs with realistic distances
- 1 completed Bondarchuk assessment
- 2-3 active goals
- A few achievements

This seed data must be rich enough to test every feature without adding more data manually.

Write the plan to `tasks/todo.md` first, then build it. Run `tsc --noEmit` when done.

═══════════════════════════════════════════════════════


---

## MESSAGE 2: AUTH SYSTEM 🧠 OPUS

═══════════════════════════════════════════════════════

Build the complete authentication system:

**Pages:**
- `/login` — single login for both coaches and athletes. Email + password. After login, redirect to `/coach/dashboard` or `/athlete/dashboard` based on role.
- `/register` — role selection (Coach or Athlete), then email + password + name. Athlete registration can also happen via invitation link.
- `/forgot-password` — email input, sends reset link via Nodemailer
- `/reset-password/[token]` — new password form

**API Routes:**
- `POST /api/auth/login` — validate credentials, create JWT, set HttpOnly cookie
- `POST /api/auth/register` — create user + profile, hash password with bcrypt
- `POST /api/auth/logout` — clear cookie
- `POST /api/auth/forgot-password` — generate token, send email
- `POST /api/auth/reset-password` — validate token, update password
- `GET /api/auth/me` — return current user from JWT

**Middleware (`src/middleware.ts`):**
- Verify JWT on all `/coach/*` and `/athlete/*` routes
- Redirect unauthenticated users to `/login`
- Redirect wrong-role users (athlete trying `/coach/*` and vice versa)

**Authorization helpers (`src/lib/authorize.ts`):**
- `canAccessAthlete(userId, athleteId)` — athlete sees only self, coach sees only their athletes
- `canAccessSession(userId, sessionId)` — same pattern
- Export these for use in every API route that returns user-specific data

**Security requirements:**
- JWT secret from environment variable only
- Passwords hashed with bcrypt (12 rounds)
- HttpOnly, Secure, SameSite=Strict cookies
- Rate limiting consideration on login endpoint
- No sensitive data in JWT payload (just userId and role)

Build all auth pages with the design system: amber/gold theme, Outfit + DM Sans fonts, dark mode support. Forms need inline validation, loading states on submit buttons, and proper error messages.

═══════════════════════════════════════════════════════


---

## MESSAGE 3: DESIGN SYSTEM + COMPONENT LIBRARY ⚡ SONNET

═══════════════════════════════════════════════════════

Build the reusable component library in `src/components/`. Every component must support dark mode, be fully responsive, and use the amber/gold theme.

**Build these components:**

1. **Button** — variants: primary, secondary, outline, danger, ghost. Sizes: sm, md, lg. Loading state with spinner. Disabled state.
2. **Input** — text, email, password, number. Label, placeholder, error message, helper text. Required indicator.
3. **Card** — clickable variant (cursor-pointer, hover effect, onClick/Link) and static variant. Header, body, footer slots.
4. **Modal** — overlay, close button, title, body, footer with action buttons. Escape to close, click-outside to close.
5. **Toast** — success, error, warning, info variants. Auto-dismiss with timer. Stack multiple. Position: bottom-right.
6. **Breadcrumbs** — accepts array of {label, href}. Last item is current page (not clickable).
7. **Sidebar** — collapsible on mobile. Highlights active route. Coach and athlete variants with different nav items.
8. **Avatar** — image or initials fallback. Sizes: sm, md, lg. Optional status indicator dot.
9. **Badge** — variants: success, warning, danger, info, neutral. Pill shape.
10. **Skeleton** — shimmer loading placeholders. Line, circle, card, table row variants.
11. **EmptyState** — icon, title, description, CTA button. Used when a page has no data.
12. **ConfirmDialog** — extends Modal. "Are you sure?" with confirm/cancel buttons. Destructive variant (red confirm).
13. **DataTable** — sortable columns, optional search, pagination. Responsive (card layout on mobile).
14. **Tabs** — horizontal tab bar. Active indicator. Content panels.
15. **Select** — custom dropdown. Single and multi-select. Search/filter option.
16. **ProgressBar** — percentage fill with label. Color variants.
17. **Stat Card** — number + label + optional trend indicator (up/down arrow with percentage).
18. **RPE Slider** — 1-10 scale with color gradient (green to red). Custom thumb.
19. **ScoreIndicator** — circular or pill display. Color-coded: green 8-10, yellow 5-7, red 1-4.

Also create:
- `src/lib/utils.ts` — `cn()` classname merger (clsx + twMerge), date formatters, number formatters
- `src/components/layouts/DashboardLayout.tsx` — sidebar + main content area + breadcrumbs slot. Used by all coach and athlete pages.

Every component should be a separate file. Export all from `src/components/index.ts`.

═══════════════════════════════════════════════════════


---

## MESSAGE 4: COACH DASHBOARD + ROSTER ⚡ SONNET

═══════════════════════════════════════════════════════

Build the coach's main pages:

**`/coach/dashboard`:**
- Overview stat cards: total athletes, athletes with low readiness (score <5), sessions scheduled today, pending questionnaires, team compliance rate (% who checked in today)
- Activity feed: recent athlete check-ins, completed sessions, new PRs (last 24-48 hours)
- Quick actions: "Add Athlete", "Build Session", "View Roster"
- Athletes flagged for attention (declining readiness, missed check-ins)

**`/coach/athletes` (roster):**
- Data table of all athletes: name, event(s), latest readiness score (color-coded), last active date, injury status
- Search by name
- Filter by event (shot put, discus, hammer, javelin)
- Sort by name, readiness, last active
- "Invite Athlete" button → sends email invitation
- Each row is clickable → navigates to athlete detail

**`/coach/athletes/[athleteId]` (athlete profile viewed by coach):**
- Header: avatar, name, events, current readiness score
- Tabs:
  - **Overview** — readiness trend (7/14/30 day chart), ACWR, injury risk score, current goals
  - **Training** — assigned sessions, completion history, volume trends
  - **Throws** — throw logs by event/implement, PR tracker, distance trends chart
  - **Readiness** — full check-in history with breakdown (sleep, soreness, stress, energy)
  - **Wellness** — body measurements, mobility assessments, injury history
  - **Goals** — SMART goals with progress bars
- Breadcrumbs: Dashboard > Athletes > [Name]
- Back button to roster

**`/coach/settings`:**
- Profile editing (name, bio, organization, avatar)
- Subscription management (link to Stripe portal)
- Current plan display with athlete count / limit

Build all API routes needed for these pages. Use proper auth checks on every route.

═══════════════════════════════════════════════════════


---

## MESSAGE 5: ATHLETE DASHBOARD + ONBOARDING ⚡ SONNET

═══════════════════════════════════════════════════════

Build the athlete's main pages:

**Athlete onboarding wizard (`/athlete/onboarding`):**
First-time athletes see this after registration. Multi-step wizard with back buttons and progress indicator:
1. Personal info — name, date of birth, gender
2. Events — select primary/secondary events (shot put, discus, hammer, javelin)
3. Current PRs — input PR distance for each selected event
4. Training history — experience level (beginner/intermediate/advanced/elite), years training
5. Injury history — any current injuries or areas of concern
6. Goals — what they want to achieve (open text + optional target distances)

Skip button available but with nudge. Data saved progressively (not lost if they bail partway).

**`/athlete/dashboard`:**
- Today's readiness score (large, color-coded) with "Check In" CTA if not done today
- Upcoming session card (next assigned workout, or "No sessions scheduled")
- Streak counters: consecutive check-ins, consecutive sessions completed
- Recent PRs
- Goal progress summaries
- Quick links: Log Throws, View History, Complete Check-in

**`/athlete/training`:**
- List of assigned sessions (upcoming and past)
- Each session card shows: date, workout name, status (upcoming/completed/missed), exercise count
- Click into session → see exercises, log sets/reps/weight/RPE
- After completing: summary screen with total volume, any PRs hit, motivational message

**`/athlete/history`:**
- Training history with filters (date range, exercise type)
- Progress charts: volume over time, key lifts over time, throw distances over time
- PR board: personal records for each exercise and throw event

**`/athlete/profile`:**
- View/edit personal info
- Events and PRs
- Body measurements log
- Achievement badges

Build all API routes. Auth checks on everything. Mobile-first layouts.

═══════════════════════════════════════════════════════


---

## MESSAGE 6: READINESS & WELLNESS SYSTEM ⚡ SONNET

═══════════════════════════════════════════════════════

Build the daily readiness check-in system end-to-end:

**Athlete check-in flow (`/athlete/check-in`):**
Form collects:
- Sleep quality (1-10 slider) AND hours slept (number input)
- Muscle soreness (1-10 slider) with body area selector (upper body, lower body, full body, none)
- Stress level (1-10 slider)
- Energy/mood (1-10 slider)
- Hydration (3 options: poor, adequate, good)
- Injury status (none, monitoring existing, new/active injury)
- Optional notes (free text)

Calculate overall readiness score: weighted average (sleep 25%, soreness 25%, stress 20%, energy 20%, hydration 10%). Store the overall AND each individual response.

**Post-submission view:**
- Overall score displayed large with color coding (green 8-10, yellow 5-7, red 1-4)
- Trend chart: last 7 days of overall scores
- Comparison to personal 14-day average
- "Your sleep has been below average this week" type insights

**Coach readiness view (integrate into existing athlete profile):**
- On coach dashboard: athletes sorted/flagged by readiness. Red badges on athletes <5.
- On athlete profile Readiness tab: full history table + trend charts for each factor
- Alerts: flag athletes declining 3+ consecutive days or scoring <5
- Breakdown view: see which specific factors are dragging an athlete's score down

**API Routes:**
- `POST /api/readiness` — submit check-in (one per athlete per day, update if resubmitted)
- `GET /api/readiness/[athleteId]` — get check-in history (coach or self only)
- `GET /api/readiness/[athleteId]/latest` — most recent check-in
- `GET /api/readiness/team` — all athletes' latest scores (coach only)

═══════════════════════════════════════════════════════


---

## MESSAGE 7: SESSION BUILDER + EXERCISE LIBRARY 🧠 OPUS

═══════════════════════════════════════════════════════

Build the workout programming system:

**Exercise Library (`/coach/exercises`):**
- Searchable, filterable list of all exercises
- Filter by category (CE, SD, SP, GP), event, equipment
- Each exercise: name, description, video demo URL, category, event association, default sets/reps
- Coach can add custom exercises
- Seed data should include 30-40 common throws exercises (power clean, snatch, squat, bench, various implement throws, drills)

**Session Builder (`/coach/sessions/new`):**
Multi-step builder:
1. **Name & assign** — session name, select athlete(s) or group, schedule date
2. **Add blocks** — structured as ordered blocks. Each block has a type (THROWING or STRENGTH) and contains exercises.
3. **Configure exercises** — for each exercise: target sets, reps, weight/load, RPE target, rest period, notes
4. **Review & save**

**CRITICAL VALIDATIONS (Bondarchuk rules — enforce these in the builder):**
- If a THROWING block contains multiple implements, validate descending weight order. Show a WARNING with explanation if violated: "⚠️ Light → Heavy ordering detected. Volume IV research shows this causes 2-4m performance decreases in natural athletes. Reorder to heavy → light."
- Warn if two THROWING blocks are adjacent without a STRENGTH block between them: "⚠️ Bondarchuk recommends a strength block between throwing blocks for optimal passive activation transfer."
- Show weight differential percentage when multiple implements are used. Flag >20% difference.
- These should be WARNINGS, not hard blocks — the coach can override with acknowledgment.

**Session Templates:**
- Coach can save a session as a template for reuse
- Clone and modify existing sessions

**Athlete Session View (`/athlete/sessions/[sessionId]`):**
- See assigned exercises with targets
- Log actual: sets completed, reps, weight used, RPE (use RPE slider component), distance (for throws), notes
- Rest timer between sets
- Mark session complete when done
- Completion summary screen: exercises done, total volume, PRs hit, average RPE

**API Routes:**
- CRUD for exercises, sessions, session templates
- `POST /api/sessions/[id]/log` — athlete logs a set
- `POST /api/sessions/[id]/complete` — mark session done
- Validation endpoint for implement sequencing

═══════════════════════════════════════════════════════


---

## MESSAGE 8: THROWS MODULE + BONDARCHUK ENGINE 🧠 OPUS

═══════════════════════════════════════════════════════

Build the throws-specific features — this is our core differentiator:

**Throw Logging (`/athlete/throws/log`):**
- Select event (shot put, discus, hammer, javelin)
- Select implement weight (dropdown populated based on event + gender)
- Enter distance (meters, to 2 decimal places)
- Optional: wind, video link, session association, notes
- Save → celebrate if PR (animation + badge)

**Throw History & Analytics (`/athlete/throws`):**
- PR board: best distance for each event and implement weight
- Distance trend charts: filter by event, implement, date range
- Session-by-session breakdown
- Implement comparison: overlay distances across different weights

**Coach Throws Dashboard (`/coach/throws`):**
- Roster view with each athlete's current PRs and recent distances
- Click into athlete → detailed throw analytics
- Compare multiple athletes' throw progressions on one chart

**Bondarchuk Typing Assessment (`/coach/throws/assessment/[athleteId]`):**
Multi-step quiz that determines an athlete's training type. Build as a wizard with back buttons:
- Questions about adaptation patterns, response to volume, recovery characteristics
- Score and classify into type (Skilled, Speed-Strength, Strength-Speed, Strength)
- Store results linked to athlete
- Results influence exercise selection recommendations

**Correlation-Based Exercise Selection (`/coach/throws/programming`):**
When a coach selects an athlete and their event + current PR:
1. Determine the distance band (e.g., 55-60m hammer)
2. Display exercises ranked by correlation coefficient for that band
3. Show the correlation value next to each exercise
4. Highlight high-correlation exercises (>0.7) as recommended
5. Flag exercises with negative correlations as "may hinder at this level"
6. Allow coach to build a session from these recommendations

Store correlation data as seeded reference data (JSON or database table). Include data for all events and distance bands from the Bondarchuk research.

**Drill Library (`/coach/throws/drills`):**
- Categorized by event, skill focus, difficulty
- Each drill: name, description, video URL, cues, common mistakes
- Coach can assign drills to athletes

Build all supporting API routes with proper auth.

═══════════════════════════════════════════════════════


---

## MESSAGE 9: QUESTIONNAIRE SYSTEM ⚡ SONNET

═══════════════════════════════════════════════════════

Build the custom questionnaire system:

**Questionnaire Builder (`/coach/questionnaires/new`):**
- Title, description, type (PAR-Q, readiness, health history, custom)
- Add questions: short text, long text, number, scale (1-5 or 1-10), single choice, multiple choice, yes/no
- Reorder questions via drag or up/down buttons
- Preview mode
- Save as draft or publish
- Back button and cancel available at every step

**Questionnaire Management (`/coach/questionnaires`):**
- List all questionnaires with status (draft/published)
- Assign to individual athletes or groups
- View responses

**Athlete Questionnaire Flow (`/athlete/questionnaires/[id]`):**
- Clean, one-question-at-a-time or scrollable form (depending on length)
- Progress indicator
- Back button between questions
- Submit with confirmation
- Responses store BOTH the question text AND the answer (so historical responses make sense even if the questionnaire is later edited)

**Coach Response View (`/coach/questionnaires/[id]/responses`):**
- List of athletes who completed it
- Click into individual responses
- Summary/aggregate view for multi-athlete questionnaires
- Color-coded flags for concerning answers (e.g., PAR-Q "yes" responses)

Build all API routes with auth checks.

═══════════════════════════════════════════════════════


---

## MESSAGE 10: VIDEO ANALYSIS ⚡ SONNET

═══════════════════════════════════════════════════════

Build the video analysis features:

**Coach Video Upload (`/coach/video/upload`):**
- Upload video (to Cloudflare R2 in production, local filesystem in dev)
- Associate with athlete and event
- Add title and description
- Upload progress indicator

**Video Annotation (`/coach/video/[id]`):**
- Video player with playback controls (play, pause, scrub, speed control, frame-by-frame)
- Drawing/annotation overlay: lines, arrows, circles, angles, freehand
- Timestamp-linked annotations (annotation appears at specific time in video)
- Text annotations with timestamps
- Save annotations linked to the video

**Athlete Video View (`/athlete/videos`):**
- List of videos shared by coach
- Watch with annotations overlaid
- Cannot edit annotations, view only

**Drill Video Library (`/coach/video/drills`):**
- Categorized video library
- Tag by event, skill, difficulty
- Assignable to athletes as reference material

**API Routes:**
- Upload endpoint with R2 integration (use presigned URLs for direct upload)
- CRUD for videos and annotations
- Proper file size limits and type validation
- Auth: coach uploads, both roles can view assigned videos

If R2 credentials aren't configured, fall back to local `/public/uploads` directory with a console warning. Make this environment-aware.

═══════════════════════════════════════════════════════


---

## MESSAGE 11: GOALS, ACHIEVEMENTS & GAMIFICATION ⚡ SONNET

═══════════════════════════════════════════════════════

Build the motivation and tracking layer:

**SMART Goals (`/athlete/goals`):**
- Create goal: title, target value, unit, deadline, current starting value
- Visual progress bar showing current vs target
- Projected completion date based on current rate of progress
- Status: in progress, achieved, missed
- Coach can also create goals for athletes

**Achievement System:**
Define and implement these achievement badges:
- **Consistency:** 7-day check-in streak, 14-day, 30-day
- **Training:** 10 sessions completed, 25, 50, 100
- **PRs:** First PR logged, PR in each event
- **Throws milestones:** event-specific distance milestones (e.g., 50m hammer, 60m hammer, etc.)
- **Engagement:** First video review, first questionnaire completed, profile completed

Each achievement: icon/emoji, title, description, earnedAt timestamp. Show as badges on athlete profile and dashboard.

**PR Celebrations:**
When an athlete logs a throw or lift that exceeds their previous best:
- Detect automatically by comparing to stored PRs
- Show celebration animation (confetti or similar CSS animation)
- Award badge if applicable
- Create notification for coach: "[Athlete] just hit a new [event] PR: [distance]!"

**Streak Tracking:**
- Track consecutive days with readiness check-in
- Track consecutive sessions completed (within scheduled window)
- Display prominently on athlete dashboard
- Reset logic: missing a day resets the streak (with grace period logic if needed)

**Coach Notifications (`/coach/notifications`):**
- New PR alerts
- Low readiness alerts
- Missed check-in / session alerts
- Questionnaire completion alerts
- Store in DB, mark as read/unread

Build all API routes.

═══════════════════════════════════════════════════════


---

## MESSAGE 12: STRIPE SUBSCRIPTIONS ⚡ SONNET

═══════════════════════════════════════════════════════

Build the subscription and payment system:

**Plans:**
| Plan | Price | Athletes | Features |
|---|---|---|---|
| Free | $0 | 3 athletes | Basic features |
| Pro | $49/mo | 25 athletes | Full features, video analysis |
| Elite | $99/mo | Unlimited | Everything + priority support, advanced analytics |

**Implementation:**
- Stripe Checkout for new subscriptions
- Stripe Customer Portal for managing subscriptions (update payment, cancel, change plan)
- Webhook handler (`/api/webhooks/stripe`) for: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed
- Store subscription status on CoachProfile: plan, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd

**Plan Gating:**
- When coach tries to add an athlete beyond their limit: show upgrade modal with plan comparison and CTA to upgrade
- Feature gates for pro/elite features: show the feature with a lock icon and "Upgrade to Pro" CTA, not hidden entirely
- Check plan limits in the API (not just frontend) to prevent bypass

**Coach Settings Integration:**
- Show current plan, athlete count / limit, billing period
- "Manage Subscription" button → Stripe Customer Portal
- "Upgrade Plan" button → Stripe Checkout with the next tier preselected

**Pricing Page (public `/pricing`):**
- Three-column plan comparison
- Feature checklist for each tier
- CTA buttons → register then checkout

Test with Stripe test mode keys. Use environment variables for all Stripe configuration.

═══════════════════════════════════════════════════════


---

## MESSAGE 13: LANDING PAGE + PUBLIC PAGES ⚡ SONNET

═══════════════════════════════════════════════════════

Build the public-facing pages:

**Landing Page (`/`):**
- Hero section: headline, subheadline, CTA button ("Start Free" → register)
- Value proposition: 3-4 feature highlights with icons/illustrations
- "Built for throws coaches" positioning — mention shot put, discus, hammer, javelin specifically
- Bondarchuk methodology callout as a differentiator
- Social proof section (placeholder for testimonials)
- Pricing summary with link to full pricing page
- Footer: links, legal

**Pricing Page (`/pricing`):**
- Three-tier comparison (Free, Pro, Elite)
- Feature matrix
- FAQ section
- CTAs → register

**SEO & Meta:**
- Proper `<title>` and `<meta description>` on every public page
- Open Graph tags (og:title, og:description, og:image)
- Semantic HTML (proper heading hierarchy, alt tags)

**Design:**
- Same amber/gold theme but optimized for marketing (bolder, more contrast)
- Responsive: looks great on mobile
- Fast: no heavy JS on public pages, static where possible
- Dark mode support

═══════════════════════════════════════════════════════


---

## MESSAGE 14: TEAM MANAGEMENT + BATCH OPERATIONS ⚡ SONNET

═══════════════════════════════════════════════════════

Build team/group management:

**Groups (`/coach/groups`):**
- Create named groups (e.g., "Hammer Throwers", "Shot Put", "Freshmen", "Competition Squad")
- Add/remove athletes to groups
- One athlete can belong to multiple groups

**Batch Operations:**
- Assign a session to an entire group with one action
- Send a questionnaire to a group
- View group-level readiness summary (average score, flagged athletes)
- Compare athletes within a group on any metric

**Calendar View (`/coach/calendar`):**
- Weekly and monthly views
- Shows all scheduled sessions across all athletes
- Color-coded by group or athlete
- Click on a day → see sessions, add new session
- Click on a session → view/edit details

**Data Export:**
- CSV export for: athlete roster, readiness history, training logs, throw logs
- PDF report generation for individual athlete (summary of key metrics, charts)
- Coach needs these for athletic department reporting

Build all API routes with auth.

═══════════════════════════════════════════════════════


---

## MESSAGE 15: POLISH PASS 🧠 OPUS

═══════════════════════════════════════════════════════

Final quality pass across the entire app. Check EVERY page and flow:

**Navigation audit:**
- Every page deeper than 1 level has breadcrumbs
- Every detail page has a back button
- Sidebar highlights correct current section on every page
- No dead links, no orphan pages (pages you can't navigate to)

**State coverage:**
- Every page handles: loading (skeleton), empty (helpful message + CTA), error (friendly message + retry), and populated states
- Every form has: inline validation, loading state on submit, success toast, error handling

**Responsive check:**
- Every page works at 375px (mobile), 768px (tablet), 1440px (desktop)
- Tables become card layouts on mobile
- Sidebar collapses to hamburger on mobile

**Dark mode check:**
- Toggle dark mode and check every page — no white flash, no unreadable text, no missing backgrounds

**Consistency check:**
- All cards that show data are clickable where appropriate
- All destructive actions have confirmation dialogs
- All success actions show toasts
- Coach profile and athlete profile follow the same structural patterns
- All multi-step flows have back buttons and progress indicators

**Code quality:**
- Run `tsc --noEmit` — zero errors
- No `any` types in business logic
- Every API route has auth + authorization checks
- No hardcoded secrets (grep for API keys, JWT secrets, passwords)
- Proper HTTP status codes on all API responses
- Prisma queries use `select`/`include` efficiently (no N+1)

**User flow verification:**
Trace these flows through the code and confirm they work:
1. Coach registers → sees empty dashboard → invites athlete → athlete appears on roster
2. Athlete registers via invite → completes onboarding → does first check-in → sees trends
3. Coach builds session with throws (verify heavy→light enforced) → assigns to athlete → athlete logs it → coach sees results
4. Athlete logs a PR throw → celebration fires → coach gets notification
5. Coach creates questionnaire → assigns to group → athletes complete it → coach views responses
6. Free coach hits 3-athlete limit → sees upgrade prompt → can upgrade via Stripe

Report: ✅ PASS or ❌ FAIL for each. Fix all failures.

═══════════════════════════════════════════════════════
