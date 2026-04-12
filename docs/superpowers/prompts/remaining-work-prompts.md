# Podium Throws — Remaining Work Prompts

> **How to use:** Copy-paste any prompt below into a fresh Claude Code session.
> Each prompt is self-contained with enough context for a cold start.
>
> **Last updated:** 2026-04-11 (after PR #19 IA rework + PR #20 Throws Hub shipped)

---

## Tier 1 — Ship Blockers & Production Readiness

### 1. Merge Proxy Athlete Profiles

```
Continue the proxy athlete profiles feature.

Context:
- Spec: docs/superpowers/specs/2026-04-10-proxy-athlete-profiles-design.md
- Branch: feat/proxy-athlete-profiles (20+ commits, most features complete)
- This is flagged as the #1 adoption blocker — coaches can't add athletes
  without the athlete first creating an account

What needs to happen:
1. Check out the feat/proxy-athlete-profiles branch
2. Rebase onto current main (which now includes the IA rework + Throws Hub)
3. Run typecheck + lint + tests to find any conflicts
4. Fix any merge conflicts or type errors from the rebase
5. Do a manual click-through: coach creates a proxy athlete, edits their
   profile, assigns a session, then generates an invite link
6. Open a PR and merge

The feature lets coaches create athlete profiles with just name/gender/events
(no email required). The coach manages the athlete fully. Later, the athlete
claims the profile via an invite link that associates their login with the
existing profile. This is critical because right now coaches can't onboard
athletes without the athlete signing up first.
```

### 2. Fix Empty Dashboard Widgets

```
Investigate and fix empty dashboard widgets on the athlete dashboard.

Context:
- A tester reported on 2026-04-10 that some athlete dashboard widgets render
  empty states when they shouldn't (see memory file
  feedback_tester_session_2026_04_10.md for details)
- The athlete dashboard is at src/app/(dashboard)/athlete/dashboard/page.tsx
- It uses a widget architecture: each widget has a fetcher function in
  src/lib/data/dashboard.ts or src/lib/data/dashboard-progress.ts
- The fetchers take athleteId and query Prisma

Steps:
1. Read the tester feedback at feedback_tester_session_2026_04_10.md
2. Log in as athlete1@example.com / athlete123 on the dev server
3. Check which widgets show empty/broken states
4. For each broken widget, trace: does the fetcher return data? Is the
   athleteId being passed correctly? Is there a seed data issue?
5. Fix the root cause (probably auth/session/athleteId lookup bugs in
   the fetcher functions)
6. Verify all widgets render with seed data
7. Commit and push
```

### 3. Fix Session Editing Regression

```
Investigate and fix the session editing regression.

Context:
- A tester reported on 2026-04-10 that editing a session redirects to the
  wrong page (see memory file feedback_tester_session_2026_04_10.md)
- The session edit flow lives in src/app/(dashboard)/athlete/throws/log/page.tsx
  via the ?edit=sessionId URL parameter and the loadSessionForEdit function
- The log page was recently scoped down (PR #19) — the TrendsView and
  SessionsView tabs were removed. The edit flow should still work via the
  ?edit= param but may have been affected by the refactor

Steps:
1. Read the tester feedback for the exact reproduction steps
2. Try editing a session via the athlete UI — find where the edit link
   lives and trace the flow
3. Check loadSessionForEdit in log/page.tsx — does it still set the form
   state correctly? Does the ?edit= useEffect still fire?
4. Check the success-state after editing — the "View Trends" button was
   converted from setTab("trends") to a <Link> in PR #19. Verify
   the edit-save success flow works end to end
5. Fix and commit
```

### 4. Add Pagination to /api/throws/history

```
Add cursor-based pagination to the throws history API endpoint.

Context:
- GET /api/throws/history at src/app/api/throws/history/route.ts currently
  has a take: 2000 row cap with no real pagination
- The cursor field is already in the Zod query schema (parsed but unused)
- The response already returns nextCursor: null
- The History page client at src/app/(dashboard)/athlete/throws/history/
  _history-client.tsx needs to wire up infinite scroll
- The spec at docs/superpowers/specs/2026-04-11-throws-history-nav-rework-design.md
  Section 3.5 describes the expected pagination behavior:
  "Pagination by day (30 days per page), infinite-scroll on client"

What needs to happen:
1. Implement cursor-based pagination in the route handler:
   - Cursor is the ISO date of the last day returned
   - Each page returns up to 30 days of history
   - nextCursor is the date of the oldest day if more data exists
2. Update _history-client.tsx to implement infinite scroll:
   - Track nextCursor in state
   - When user scrolls near the bottom, fetch the next page
   - Append new days to the existing array (don't replace)
   - Show a loading spinner at the bottom while fetching
3. Remove the take: 2000 caps (pagination replaces them)
4. Update the existing tests to cover pagination scenarios
5. Add a test for the cursor parameter
```

### 5. Wire Up Unified PR Detection in History Timeline

```
Connect the History page's PR badges to the Unified PR Read Layer.

Context:
- The History page at src/app/(dashboard)/athlete/throws/history/ shows
  a ★ PR badge on days that have personal bests
- Currently, assigned-session throws (ThrowsBlockLog) always set
  isPersonalBest: false with a TODO comment pointing at the Unified PR
  Read Layer (see src/lib/throws/history.ts around line 127)
- The Unified PR Read Layer has already been implemented and merged
  (commits 7d345be → 7b18744 per memory project_unified_pr_system.md)
- The aggregation helper at src/lib/throws/history.ts needs to call the
  Unified PR layer to detect PRs for assigned-session throws instead of
  always returning false

What needs to happen:
1. Read the Unified PR Read Layer spec at
   docs/superpowers/specs/2026-04-10-unified-pr-read-layer-design.md
2. Find the API/function that checks whether a throw is a PR
3. In src/lib/throws/history.ts, replace the isPersonalBest: false
   fallback for assigned-session throws with a call to the PR layer
4. Update the API route to pass any necessary context
5. Update the existing aggregation tests
6. Verify PR badges show correctly on the History page for both
   free-logged AND assigned-session throws
```

---

## Tier 2 — High-Impact Features (Specs Written, Need Plans)

### 6. Roster Groups for Coaches

```
Implement roster groups so coaches can organize athletes into named groups.

Context:
- Spec: docs/superpowers/specs/ (search for roster-groups or advanced-roster)
- Memory: project_roster_groups.md has the summary
- Coaches need multiple named groups (e.g., "UCSD Throws", "Private Clients")
- Athletes can belong to 0-N groups
- Standalone athletes (no group) still visible
- Roster page shows tabs or sections per group

This is a greenfield feature. Start by:
1. Read the spec and memory file for full requirements
2. Use superpowers:brainstorming if the spec needs refinement
3. Use superpowers:writing-plans to create the implementation plan
4. Execute via superpowers:subagent-driven-development

The schema likely needs a new GroupRoster model with a many-to-many
relationship to AthleteProfile via a join table. The coach roster page
at src/app/(dashboard)/coach/team/ needs UI changes for group tabs/filters.
```

### 7. Athlete Master Profile — Advanced Profile Form

```
Build the Athlete Master Profile — a 6-section tabbed profile form that
feeds into the Bondarchuk programming engine.

Context:
- Spec summary in memory: project_athlete_master_profile.md
- This is a large feature — 6 tabs: Core Info, Competition/Distance Bands,
  Implement Performance, Strength Numbers, Technical Profile, Injury/Health
- Schema needs new JSON fields on AthleteProfile: implementPRs,
  strengthNumbers, technicalProfile, injuryHistory, movementRestrictions
- The profile feeds into the Bondarchuk programming engine for exercise
  selection and load calculations
- The spec exists but may need refinement — use superpowers:brainstorming
  to validate before planning

Start by:
1. Read project_athlete_master_profile.md from memory
2. Check if there's already a spec in docs/superpowers/specs/
3. If not, brainstorm the design (each tab's fields, schema changes, API)
4. Write the implementation plan
5. Execute — this is large enough for subagent-driven-development with
   multiple sessions
```

### 8. Landing Page Redesign + Fix Pricing

```
CRITICAL: The landing page has wrong pricing. Fix it and redesign the page.

Context:
- Spec: docs/superpowers/specs/2026-03-20-landing-page-redesign.md
- Current landing page: src/app/page.tsx
- PRICING IS WRONG in the current codebase: it shows $100/$199 per month
  but the actual tiers are Free ($0, 3 athletes) / Pro ($20/mo, 25 athletes)
  / Elite ($50/mo, unlimited athletes)
- The spec calls for a full redesign: floating nav pill, feature showcase,
  methodology section, Bondarchuk credibility content, new pricing section
- Stripe config needs to match the new pricing tiers

This is both a bug fix (wrong prices shown to users) AND a feature (redesign).
Priority: fix the pricing numbers FIRST as a quick commit, then do the
full redesign as a separate effort.

Steps for the quick pricing fix:
1. Find all references to $100/$199 pricing in the codebase
2. Update to Free ($0) / Pro ($20/mo) / Elite ($50/mo)
3. Verify Stripe product IDs match (check .env and Stripe dashboard)
4. Commit the pricing fix immediately

Then for the full redesign:
1. Read the spec at docs/superpowers/specs/2026-03-20-landing-page-redesign.md
2. Use superpowers:brainstorming to refine the visual direction
3. Plan and implement
```

### 9. Coach Team Readiness Dashboard

```
Replace the "Coming Soon" stub at /coach/wellness with a full team
readiness dashboard.

Context:
- Spec: docs/superpowers/specs/2026-03-26-coach-team-readiness-design.md
- Current page: src/app/(dashboard)/coach/wellness/ (shows "Coming Soon")
- The dashboard should show: team avg readiness with trend, per-athlete
  bars sorted by score, 7-day sparklines, category breakdowns (sleep,
  soreness, stress, energy), threshold alerts (< 5.0 flagged)
- Filter by event group
- Data comes from the existing wellness/readiness check-in system that
  athletes already use

Start by:
1. Read the spec for full requirements
2. Check if the athlete readiness data model already supports what's needed
   (look at the wellness check-in API and schema)
3. Write the implementation plan
4. Execute — this is a single-page feature with a server component +
   some client widgets
```

### 10. Advanced Roster Management — Phase 1 (Availability)

```
Implement Phase 1 of advanced roster management: athlete availability
submission and coach conflict detection.

Context:
- Spec: docs/superpowers/specs/2026-04-02-advanced-roster-management-design.md
- Plan: docs/superpowers/plans/2026-04-02-phase1-availability-smart-org.md
  (marked "ready to execute" but never started)
- Athletes submit availability windows (recurring or one-off)
- Coach sees athlete availability on a calendar view with conflict detection
- New /athlete/availability page for submission
- Smart filters on the coach roster page

This already has a spec AND a plan. You can go straight to execution:
1. Read the plan at docs/superpowers/plans/2026-04-02-phase1-availability-smart-org.md
2. Execute using superpowers:subagent-driven-development
3. The plan may need light updates since the codebase has changed since
   it was written (the IA rework + Throws Hub shipped after the plan)
```

---

## Tier 3 — Polish & UX Improvements

### 11. Mobile UX Density Audit

```
Audit the entire athlete-side UI for mobile information density and
progressive disclosure.

Context:
- Production readiness review on 2026-04-10 flagged that data presentation
  on mobile needs progressive disclosure and better information hierarchy
- Memory: feedback_production_readiness_2026_04_10.md has the details
- CLAUDE.md says "mobile-first approach" and memory says "always mock up
  mobile view first"
- The Throws Hub (just shipped) uses good density patterns — use it as the
  reference for what "data-dense but readable" looks like on mobile

Steps:
1. Read the production readiness feedback
2. Open every athlete-side page on a mobile viewport (Chrome DevTools,
   iPhone 14 Pro preset)
3. For each page, note: Is the information hierarchy clear? Can you scan
   the page in 5 seconds? Are there any "walls of text" or "empty rooms"?
4. Create a findings doc with screenshots and recommendations
5. Group fixes by priority (quick wins vs redesigns)
6. Implement the quick wins in a single PR
```

### 12. Implement Naming Conventions (Domain Accuracy)

```
Fix implement weight display across the app to use coach terminology.

Context:
- Production readiness review flagged that implements should display using
  dual units that coaches actually use: men's shot as "7.26kg / 16lb",
  women's hammer as "4kg", competition weights highlighted
- Currently the app shows raw kg values like "7.26kg" without context
- This is a domain accuracy issue — Olympic throws coaches think in both
  kg and lbs depending on the implement and gender
- The ThrowLog model already stores implementWeight (kg),
  implementWeightUnit, and implementWeightOriginal

Steps:
1. Create an implement display helper in src/lib/throws/ that takes
   implementWeight + event + gender and returns the coach-friendly string
2. Audit every screen that shows implement weights (History page drill rows,
   PR tracker, session view, log form)
3. Replace raw kg display with the new helper
4. Include the lbs equivalent for standard competition implements
5. Test with the 4 events × common implement weights
```

### 13. Live Workout Timeline View

```
Redesign the athlete's live workout view from a flat list to a vertical
timeline with inline-expanding cards.

Context:
- Spec: docs/superpowers/specs/2026-03-21-workout-timeline-view.md
- Current live workout view: src/app/(dashboard)/athlete/throws/live/
  [assignmentId]/ — uses _session-logger.tsx
- The redesign replaces the flat session logger with a vertical timeline
  where each block (warmup, throwing, strength, cooldown) is a card that
  expands inline to show throw inputs
- Framer-tier animations, mobile-first, progress tracking indicator
- State/API/PR logic stays as-is — this is a pure visual redesign

Start by:
1. Read the spec for the full timeline design
2. Use superpowers:brainstorming to refine (the spec may need updates
   since the IA rework changed the page structure)
3. Plan and implement
```

### 14. Font-Mono-on-Prose Audit

```
Audit the entire codebase for font-mono applied to non-numeric content.

Context:
- During the Throws IA rework (PR #19), the code review caught font-mono
  being applied to prose labels, weekday names, and other non-numeric text
- CLAUDE.md design system rule: "Never use font-mono for prose, labels,
  descriptions, or marketing copy — only for data values (distances,
  timestamps, statistics, IDs, code)"
- The violations were fixed in the History page and session view, but the
  same pattern likely exists elsewhere in the codebase

Steps:
1. grep -rn "font-mono" src/app/ src/components/ | grep -v node_modules
2. For each hit, check if the element wrapping font-mono contains ONLY
   numeric data (distances, throw counts, dates, IDs) or also contains
   prose/labels
3. Fix any violations by splitting the element: mono on the numeric span,
   default font on the label span
4. Don't touch font-mono on actual data values — those are correct
5. Commit as a single cleanup PR
```

### 15. UTC Timezone Fix in History isoDay()

```
Fix the UTC timezone bug that causes free-logged throws to appear under
the wrong day for athletes in Western timezones.

Context:
- src/lib/throws/history.ts has a function isoDay() that converts
  ThrowLog.date (a DateTime) to a YYYY-MM-DD string using
  d.toISOString().slice(0, 10) — this is UTC, not local time
- An athlete in PST who logs a throw at 11pm Sunday will see it appear
  under Monday in their History timeline
- Block logs (ThrowsBlockLog) are unaffected because they use
  assignment.assignedDate which is already a local-calendar string
- The issue is documented with a comment in isoDay() explaining the
  limitation and two possible fixes:
  1. Store the local calendar date as a separate field on ThrowLog
     (schema change)
  2. Accept a tz query parameter from the UI and use date-fns-tz to
     convert

Option 2 is less invasive:
1. Add a tz query param to the /api/throws/history Zod schema
2. Pass the athlete's IANA timezone from the client (via
   Intl.DateTimeFormat().resolvedOptions().timeZone)
3. In the aggregation helper, use the timezone to convert UTC dates
   to local calendar dates before bucketing
4. Update the History client to pass tz in the fetch URL
5. Update existing tests
```

### 16. Coach Analytics Dashboard

```
Add an analytics section to the coach dashboard with team-level metrics.

Context:
- Spec: docs/superpowers/specs/2026-03-26-coach-analytics-dashboard-design.md
- Metrics to show: team avg distance delta %, compliance rate gauge,
  avg readiness with trend, weekly volume bar chart, season gains
  leaderboard (top 5 athletes)
- All widgets below the existing Team Pulse section on the coach dashboard
- Uses the existing widget architecture from the dashboard

Start by reading the spec, then plan and implement.
```

### 17. Fix "Tabs Feel Disconnected" (Cross-Tab Data Propagation)

```
Investigate and address the tester feedback that "each tab feels like a
separate app."

Context:
- Tester reported on 2026-04-10 that session logging data doesn't propagate
  across tabs — when you log a throw, the PR tracker, calendar, analytics,
  throws history, and readiness don't update until you refresh
- This is an architectural issue: each widget/page fetches its own data
  independently with no shared invalidation mechanism
- The Throws Hub (just shipped) makes this MORE visible because it shows
  6 widgets that could all be stale after a throw is logged

This is a brainstorming-first task — the solution could be:
a) React Query / SWR with shared cache keys + invalidation on mutations
b) Server Actions that revalidate specific cache tags
c) A simple "last-modified" timestamp that widgets check on focus
d) WebSocket push for real-time updates (overkill for v1)

Start with superpowers:brainstorming to explore the approach before
committing to an implementation.
```

---

## Tier 4 — Infrastructure & Domain Engine

### 18. MFA for Coach Accounts

```
Implement TOTP-based multi-factor authentication for coach accounts.

Context:
- Spec: docs/superpowers/specs/2026-03-17-mfa-design.md
- TOTP (Google Authenticator compatible), AES-256-GCM encrypted secrets,
  5-minute JWT session tokens during MFA challenge, bcrypt backup codes
- Schema changes: CoachProfile gets mfaSecret, mfaEnabled, mfaBackupCodes
- New env var: MFA_ENCRYPTION_KEY
- The login route already has a branch for MFA challenges (the auth-routes
  tests cover it), but the actual TOTP verification is not wired up yet

Start by reading the spec, then plan and implement. This touches auth
(sensitive area) — use TDD and thorough testing.
```

### 19. Bondarchuk Programming Engine Overhaul

```
Overhaul the Bondarchuk programming engine internals to match authentic
methodology while keeping the existing 4-phase user-facing labels.

Context:
- Spec summary in memory: project_bondarchuk_engine_overhaul.md
- Current engine uses incorrect volume ramps and exercise rotation
- Authentic Bondarchuk: constant volume across phases (~16-20 throws/session),
  correct exercise counts per phase, proper CE/SDE/SPE/GPE rotation ratios,
  5-category strength model
- Optional AM/PM splitting and cleanse/rest cycles for advanced programs
- This is the deepest domain-specific work in the codebase — requires
  understanding of Bondarchuk's Transfer of Training methodology
- CLAUDE.md has the critical domain rules (descending weight order,
  15-20% weight differential, session structure)

This is a complex feature that needs:
1. Read the memory file for the full overhaul scope
2. Read CLAUDE.md's Bondarchuk Methodology section carefully
3. Brainstorm the hybrid approach (keep labels, fix internals)
4. Plan carefully — this touches the programming engine which is the
   product's core differentiator
5. Execute with heavy TDD — every volume/rotation calculation needs tests
```

---

## Quick Cleanup Items (< 30 minutes each)

### 20. Delete Orphaned Git Branches

```
Triage and clean up the orphaned local git branches.

Run: git branch -v

You'll see ~10 non-main branches:
- 7 claude/* branches (sandbox branches from prior Claude sessions)
- feat/athlete-dashboard-overhaul
- feat/proxy-athlete-profiles (active — DO NOT delete)
- feat/regenerate-program-settings
- dev (1 commit ahead of origin/dev)

For each branch:
1. Run: git log main..<branch> --oneline
2. If the commits are already on main (merged via PR), delete the branch:
   git branch -D <branch>
3. If the branch has unmerged work, check if it's still relevant
4. Report what you kept and what you deleted

DO NOT delete feat/proxy-athlete-profiles — it has active work.
```

### 21. Push Spec + Plan Doc Commits

```
Push any unpushed documentation commits to origin/main.

Check: git log origin/main..main --oneline

If there are doc-only commits (specs, plans) that haven't been pushed,
push them: git push origin main

These are non-runtime files that should be on main so other contributors
can read them.
```
