# Podium Throws — Weakness Analysis & Fix Prompts

**Date:** 2026-03-13
**Analyst Perspective:** UI/UX Expert + Customer Psychology Specialist
**Target User:** Elite throws coaches paying $100+/month

---

## Executive Summary

After a comprehensive audit of every coach and athlete page, component, API route, and navigation flow, I've identified **15 critical weaknesses** ranked by their impact on user retention, trust, and willingness to pay. The ranking prioritizes issues that directly affect the "would an Olympic coach trust this?" bar.

---

## Weakness #1: Coach Wellness Dashboard Is a Dead End (CRITICAL)

**Impact:** Revenue-threatening | **Effort:** Large | **Priority:** P0

**The Problem:**
The `/coach/wellness` page — one of 3 items in the "Insights" nav section — is a "Coming Soon" placeholder. Coaches can see individual athlete readiness on the athlete detail page, but there is NO team-wide wellness overview. This is the single most important daily decision-making screen for a throws coach managing 8-20 athletes, and it doesn't exist.

**Why It Matters (Psychology):**
A coach paying $100+/month expects to open the app and instantly see "who's ready to train hard today and who needs recovery." Without this, coaches must click into each athlete individually — the exact same workflow they'd use with a spreadsheet. This destroys the value proposition and is the #1 reason a coach would churn after the first month.

**Claude Code Prompt:**
```
Build the Coach Team Wellness Dashboard at /coach/wellness. Replace the current "Coming Soon" placeholder with a fully functional page that includes:

1. **Roster Readiness Heatmap** — A grid/table showing every athlete as a row, with columns for: name, today's readiness score (color-coded: green >=8, amber 5-7, red <5), sleep score, soreness, stress, energy, last check-in date, and a 7-day sparkline trend. Sort by lowest readiness first (coaches need to see problems immediately).

2. **Team Averages Bar** — At the top, show team-wide averages for overall readiness, sleep, soreness, stress, and energy with comparison to the 7-day rolling average. Use subtle up/down trend arrows.

3. **Alert Cards** — Below the heatmap, show flagged athletes: anyone with readiness <5, anyone who hasn't checked in for 48+ hours, anyone with a downward trend over 3+ days. Each card links to the athlete detail readiness tab.

4. **Threshold Settings** — A small gear icon that opens a panel where coaches can set custom alert thresholds (e.g., "flag anyone below 6 readiness").

Data source: Use the existing wellness/readiness check-in data from the ReadinessCheckIn model. Query the last 30 days of check-ins for all athletes on the coach's roster. Use existing UI components (Badge, Avatar, ProgressBar, card classes). Follow the existing dark mode patterns and Tailwind theme. No new dependencies.
```

---

## Weakness #2: No Coach-to-Athlete In-App Communication (CRITICAL)

**Impact:** Revenue-threatening | **Effort:** Large | **Priority:** P0

**The Problem:**
There is no messaging, commenting, or feedback system between coach and athlete within the app. Coaches can assign sessions and athletes can complete them, but there's no way to say "Great session today" or "Your knee angle needs work at release." The `coachNotes` field on sessions is set at creation time — there's no post-session feedback loop.

**Why It Matters (Psychology):**
Coaching is fundamentally a relationship business. If a coach can't communicate through the platform, they'll use text messages or WhatsApp instead, which means the app becomes a secondary tool rather than the command center. The moment a coach thinks "I need to text them about this," you've lost the "built for coaches" positioning. Every competitor (BridgeAthletic, TrainHeroic) has in-app messaging.

**Claude Code Prompt:**
```
Add a Session Feedback & Notes system that allows coaches and athletes to exchange messages on completed sessions. This is NOT a full chat system — it's contextual feedback tied to sessions.

1. **Database:** Add a `SessionComment` model to the Prisma schema with fields: id, sessionId (relation to Session), authorId (relation to User), authorRole (COACH | ATHLETE), content (text), createdAt. Run prisma migrate.

2. **API Routes:**
   - POST /api/sessions/[id]/comments — create a comment (auth required, must be the assigned coach or athlete)
   - GET /api/sessions/[id]/comments — list comments for a session

3. **Coach UI:** On the athlete detail page Training tab, when viewing a completed session, add a "Session Notes" section below the exercise log. Show existing comments in a chat-like thread (coach messages right-aligned in amber, athlete messages left-aligned in gray). Include a text input with send button at the bottom.

4. **Athlete UI:** On /athlete/sessions/[id] for completed sessions, add the same "Session Notes" section. Show a prompt like "How did this session feel? Your coach will see your notes."

5. **Notifications:** When a comment is added, create a notification for the other party using the existing notification system.

Use existing card styling, Avatar component, and dark mode patterns. No new dependencies.
```

---

## Weakness #3: Workout Plans Page Is a Dead End (HIGH)

**Impact:** High churn risk | **Effort:** Very Large | **Priority:** P0

**The Problem:**
`/coach/plans` is another "Coming Soon" placeholder. Coaches can create individual sessions via `/coach/sessions/new`, but there's no way to build multi-week periodized programs. For a Bondarchuk methodology app, this is like a spreadsheet app that can't save files. The entire GPP → SPP → Competition periodization workflow is missing.

**Why It Matters (Psychology):**
Program design is the intellectual core of coaching. Coaches spend hours crafting 12-16 week mesocycles. If they can't do that here, they'll use Excel and only use Podium Throws for logging — making it a $100/month data entry tool. This is the feature that separates a premium coaching platform from a workout tracker.

**Claude Code Prompt:**
```
Build the Workout Plans system for coaches. This is a large feature — implement it in phases:

**Phase 1 — Plan Builder (MVP):**

1. **Database:** Add models:
   - `TrainingPlan`: id, coachId, name, description, startDate, endDate, phase (GPP/SPP/COMP/TRANSITION), status (DRAFT/ACTIVE/COMPLETED), createdAt, updatedAt
   - `PlanWeek`: id, planId, weekNumber, focus (text), notes
   - `PlanDay`: id, weekId, dayOfWeek (1-7), sessionPlanId (nullable, links to existing session/plan)

2. **Plan List Page** (`/coach/plans`): Replace the Coming Soon page with a list of plans showing name, phase badge, date range, status, athlete count. "Create Plan" button in header.

3. **Plan Builder** (`/coach/plans/new`): Multi-step wizard:
   - Step 1: Name, phase type, date range, description
   - Step 2: Weekly view — a 7-column grid where coaches can drag existing session templates into days. Each cell shows the session name or is empty with a "+" button.
   - Step 3: Assign to athletes (multi-select from roster)
   - Step 4: Review & publish

4. **Plan Detail** (`/coach/plans/[id]`): Calendar-style weekly view of the plan with the ability to edit individual days.

Use the existing session creation flow for individual sessions within the plan. Follow Bondarchuk methodology: enforce that throwing blocks alternate with strength blocks, implement weights descend. Use existing UI components and Tailwind theme.
```

---

## Weakness #4: Missing Contextual Navigation & Back Buttons (HIGH)

**Impact:** Daily frustration | **Effort:** Small | **Priority:** P1

**The Problem:**
Many detail pages and sub-pages lack back buttons or breadcrumbs. The sidebar provides top-level navigation, but once you drill into a detail view (athlete profile → training tab → specific session), there's no clear way to go back except the browser button. Specific offenders:
- `/coach/athletes/[id]` has a back button, but sub-views within tabs don't
- `/athlete/sessions/[id]` — no back button
- `/athlete/throws/analysis` — no back button
- `/coach/goals` — no back button to dashboard
- `/athlete/assessments` — no back button
- Most "detail within detail" views

**Why It Matters (Psychology):**
Missing navigation creates a sense of being "lost" in the app. Coaches clicking through 3-4 levels deep start to feel anxiety about how to get back. This erodes the sense of control that expert users demand. Every click without a clear exit path increases cognitive load.

**Claude Code Prompt:**
```
Audit and add back buttons / breadcrumbs to all detail and sub-pages across both coach and athlete dashboards. Follow the existing pattern used in /coach/athletes/[id] and /coach/sessions/new which use a "← Back" link.

Pages that need back buttons added (check each one):
1. /athlete/sessions/[id] — "← Back to Sessions"
2. /athlete/throws/analysis — "← Back to Throws"
3. /athlete/throws/profile — "← Back to Throws"
4. /athlete/throws/log — "← Back to Throws"
5. /athlete/assessments — "← Back to Dashboard"
6. /athlete/achievements — "← Back to Dashboard"
7. /coach/goals — "← Back to Dashboard"
8. /coach/athlete-logs — "← Back to Dashboard"
9. /coach/notifications — "← Back to Dashboard"
10. /coach/exercises — "← Back to Programs"
11. /coach/questionnaires/[id] — "← Back to Questionnaires"
12. /coach/questionnaires/[id]/responses — "← Back to Questionnaire"
13. /coach/throws/analyze/[id] — "← Back to Analysis History"
14. /coach/drill-videos — "← Back to Videos"

Use consistent styling: a Link component with "← Back to [Parent]" text, placed above the page title, using text-sm text-muted hover:text-[var(--foreground)] transition-colors. Check each page before modifying — some may already have back buttons.
```

---

## Weakness #5: Athlete Profile Page Is a Settings Redirect (HIGH)

**Impact:** Broken mental model | **Effort:** Medium | **Priority:** P1

**The Problem:**
`/athlete/profile` just redirects to `/athlete/settings`. Athletes have no actual profile page where they can see their own throwing profile, PRs, event history, and progress at a glance. The coach can see a rich 6-tab athlete detail view at `/coach/athletes/[id]`, but the athlete themselves can't see anything equivalent about their own data.

**Why It Matters (Psychology):**
Athletes are secondary users but critical for retention — if athletes hate the app, coaches hear about it. Athletes want to see their own progress, PRs, and trends. A redirect to "Settings" when they click "Profile" feels broken. It tells the athlete "this app wasn't built for you." Athletes who feel ownership over their data become advocates who tell their coach "I love this app."

**Claude Code Prompt:**
```
Build a proper Athlete Profile page at /athlete/profile that mirrors the data coaches see on /coach/athletes/[id] but from the athlete's own perspective.

Include these sections (single scrollable page, not tabs):

1. **Profile Header:** Avatar, name, events (shot put, discus, etc.), university/organization, age, training since date. Edit button that links to /athlete/settings.

2. **Personal Bests Panel:** Grid of PR cards by event — each showing event name, implement weight, best distance, date achieved, and a small trend indicator (improvement over last 3 months).

3. **Current Readiness:** Today's readiness score with the 4-factor breakdown (sleep, soreness, stress, energy). Link to /athlete/wellness for full history.

4. **Training Summary:** Cards showing: total sessions this month, sessions this week, current training streak (days), compliance rate (completed vs assigned). Link to /athlete/sessions.

5. **Active Goals:** List of current goals with progress bars. Link to /athlete/goals.

6. **Recent Activity:** Last 5 completed sessions with dates, RPE, and brief summary.

Fetch data using existing server-side data functions. Use existing card, Badge, ProgressBar, and Avatar components. Follow the established page layout patterns.
```

---

## Weakness #6: No Data Export or Reporting (HIGH)

**Impact:** Churn risk for power users | **Effort:** Medium | **Priority:** P1

**The Problem:**
There is no way to export data from the platform. No CSV downloads for session history, throw logs, readiness trends, or athlete progress. No printable reports. No "share with athletic director" functionality. Coaches who need to report to administrators or sports science departments are stuck screenshotting the app.

**Why It Matters (Psychology):**
Data portability is a trust signal. Coaches who can't export their data feel "locked in" rather than "invested in." When a coach needs to present to their athletic director or write a grant report, and they can't pull data from their $100/month tool, that's the moment they question the subscription. Export features also reduce churn anxiety — coaches stay longer when they know they can leave.

**Claude Code Prompt:**
```
Add data export functionality to key coach pages:

1. **Athlete Roster Export** — On /coach/athletes, add an "Export" button next to "Invite Athlete" in the header. Clicking it downloads a CSV with columns: Name, Email, Events, Latest Readiness, Last Check-in, Sessions Completed (30d), Compliance %, Best Marks by Event.

2. **Session History Export** — On /coach/sessions, add an "Export" dropdown with options: "Export All (CSV)" and "Export Filtered (CSV)". Include columns: Session Name, Date, Athletes Assigned, Status, Average RPE, Completion Rate.

3. **Throws Data Export** — On /coach/throws, add "Export Throws (CSV)" button. Include: Date, Athlete, Event, Implement Weight, Distance, Session Name, PR flag.

4. **Readiness Export** — On the coach wellness page (once built), add "Export Readiness (CSV)" with: Date, Athlete, Overall Score, Sleep, Soreness, Stress, Energy, Notes.

Implementation: Create a shared utility function `generateCSV(headers: string[], rows: string[][])` in src/lib/csv.ts that creates a CSV blob and triggers browser download. Each export button calls an API endpoint that returns JSON, then converts client-side to CSV. Use existing Button component with a Download icon from lucide-react.
```

---

## Weakness #7: Readiness Check-in Lacks Actionable Context (MEDIUM-HIGH)

**Impact:** Reduces daily engagement | **Effort:** Medium | **Priority:** P1

**The Problem:**
The athlete wellness check-in collects good data (sleep, soreness, stress, energy, hydration, injury status), but the results page doesn't tell the athlete what to do with it. The "Insights" section exists but appears to be basic. There's no connection between readiness score and training recommendations. A score of "4/10" should trigger guidance like "Consider a recovery session today" or flag the coach automatically.

**Why It Matters (Psychology):**
Check-ins without feedback feel like surveillance, not coaching. Athletes will stop checking in within 2 weeks if they don't see value coming back. The check-in must feel like a conversation, not a form. When an athlete sees "Your sleep quality has dropped 3 days in a row — talk to your coach about adjusting tomorrow's volume," they feel cared for.

**Claude Code Prompt:**
```
Enhance the athlete wellness results page (/athlete/wellness) with actionable, contextual insights:

1. **Smart Insights Engine** — Create a function in src/lib/wellness-insights.ts that takes the last 7-14 days of check-in data and generates 2-3 actionable insights. Logic:
   - If readiness < 5: "Your readiness is below optimal. Consider a lighter training day or active recovery."
   - If sleep < 6 for 2+ consecutive days: "Your sleep quality has been low for [N] days. Poor sleep directly impacts throwing performance and injury risk."
   - If soreness > 7: "High soreness detected. Focus on mobility work and communicate with your coach about adjusting loads."
   - If stress > 7 for 3+ days: "Elevated stress for multiple days. This can affect motor learning in technical events."
   - If readiness trending down (3-day decline): "Your readiness has been declining. Your coach has been notified."
   - If readiness >= 8: "You're in great shape today. This is a good day for high-intensity technical work."

2. **Auto-Notify Coach** — When an athlete's readiness drops below 5 OR shows a 3-day declining trend, automatically create a notification for their coach. Use the existing notification system.

3. **Training Recommendation Badge** — On the athlete dashboard, next to the readiness score, show a badge: "Full Send" (>=8, green), "Normal Training" (6-7, amber), "Modified Training" (4-5, orange), "Recovery Day" (<=3, red).

4. **Insight Cards** — Display insights as styled cards with an icon, title, description, and optional action link. Use existing card patterns.
```

---

## Weakness #8: Session Creation Wizard Has No Templates (MEDIUM-HIGH)

**Impact:** Slows daily workflow | **Effort:** Medium | **Priority:** P1

**The Problem:**
Every time a coach creates a session at `/coach/sessions/new`, they start from scratch. There are no saved templates, no "duplicate last session," no "standard Wednesday practice." For a coach running the same basic session structures week after week with small variations, this is maddening repetition.

**Why It Matters (Psychology):**
Coaches' time is their most precious resource. A coach who spends 15 minutes building each session when it should take 2 minutes will eventually stop building sessions in the app. Templates are the #1 feature request in every coaching platform — it's the difference between "tool that saves me time" and "tool that costs me time."

**Claude Code Prompt:**
```
Add session templates to the session creation flow:

1. **Database:** Add a `SessionTemplate` model: id, coachId, name, description, blocks (JSON — same structure as session blocks), exercises (JSON), isDefault (boolean), usageCount (int), createdAt, updatedAt.

2. **API Routes:**
   - GET /api/coach/session-templates — list coach's templates
   - POST /api/coach/session-templates — create template
   - DELETE /api/coach/session-templates/[id] — delete template
   - POST /api/coach/session-templates/[id]/use — increment usage count and return template data

3. **Template Selection Step** — Add a Step 0 to the session wizard (/coach/sessions/new): "Start from scratch" or "Use a template." Show template cards with name, description, block count, and usage count. Clicking a template pre-fills all subsequent wizard steps.

4. **Save as Template** — On the Review step (final step) of the session wizard, add a checkbox: "Save as template for future use" with a template name input.

5. **Duplicate Session** — On the sessions list (/coach/sessions), add a "Duplicate" action to each session row's action menu. This creates a new session pre-filled with the same blocks and exercises but with today's date.

Use existing wizard step patterns, card components, and Button/Modal components.
```

---

## Weakness #9: No Onboarding Progress Indicator for Athletes (MEDIUM)

**Impact:** First-week drop-off | **Effort:** Small | **Priority:** P2

**The Problem:**
Athletes who accept a coach invitation land on the athlete dashboard with a "Welcome Card" but no structured onboarding flow that guides them through: completing their profile, doing their first wellness check-in, logging their first session, and setting their first goal. The coach has an onboarding checklist, but the athlete does not.

**Why It Matters (Psychology):**
The first 7 days determine whether an athlete becomes a daily user or ignores the app. Without guided onboarding, athletes feel overwhelmed by a dashboard full of "No data yet" empty states. A clear checklist ("Complete 4 steps to set up your profile") creates a commitment loop — once they've invested effort, they're less likely to abandon.

**Claude Code Prompt:**
```
Add an athlete onboarding checklist to the athlete dashboard, similar to the coach's onboarding checklist at /coach/dashboard/_onboarding-checklist.tsx:

1. **Checklist Steps:**
   - "Complete your profile" → links to /athlete/settings (check: has avatar OR bio set)
   - "Set your events" → links to /athlete/throws/quiz (check: has at least one event selected)
   - "Do your first wellness check-in" → links to /athlete/wellness (check: has at least 1 ReadinessCheckIn)
   - "Log your first session or complete an assigned session" → links to /athlete/sessions (check: has at least 1 completed session OR 1 self-logged session)
   - "Set a performance goal" → links to /athlete/goals (check: has at least 1 goal)

2. **Display:** Show the checklist card prominently at the top of the athlete dashboard (above the readiness widget) when fewer than all 5 steps are complete. Show a progress bar (e.g., "3 of 5 complete"). Each step shows a checkmark if complete, or a CTA button if not.

3. **Dismissal:** Add a "Dismiss" button that hides the checklist permanently (store in a `dismissedOnboarding` boolean on the Athlete model or in localStorage).

4. **Celebration:** When all 5 steps are complete, show a brief celebration state ("You're all set!") with confetti colors before auto-dismissing.

Query completion status server-side. Use existing card, ProgressBar, Badge, and Button components.
```

---

## Weakness #10: Goal Tracking Lacks Milestones & Micro-Progress (MEDIUM)

**Impact:** Reduces engagement | **Effort:** Medium | **Priority:** P2

**The Problem:**
Goals show a title, target distance, deadline, and a single progress bar. But for a goal like "Throw 20m in shot put" when the current PR is 18.5m, the gap feels enormous and discouraging. There are no intermediate milestones, no celebration of incremental progress, and no visualization of the trajectory needed to hit the goal by the deadline.

**Why It Matters (Psychology):**
Goal-gradient effect: people accelerate effort as they approach a goal. But if the goal feels too far away, they disengage. Breaking "18.5m → 20m" into milestones ("18.7m → 19.0m → 19.3m → 19.6m → 20.0m") creates 5 wins instead of one. Each milestone hit triggers dopamine. This is the same psychology that makes video game progress bars addictive.

**Claude Code Prompt:**
```
Enhance the goals system for both coaches and athletes:

1. **Auto-Milestones** — When a goal is created with a current value and target value, automatically generate 4-5 evenly spaced milestones between current and target. Store these in a `milestones` JSON field on the Goal model: [{value: 18.7, label: "Milestone 1", achieved: false, achievedDate: null}, ...].

2. **Milestone Cards** — On the goal detail view, show milestones as a horizontal stepper/timeline. Completed milestones show a gold checkmark and date achieved. The next milestone is highlighted. Future milestones are grayed out.

3. **Trajectory Line** — Add a simple line chart showing: X-axis = time (goal start to deadline), Y-axis = distance. Plot actual PR progression as data points. Draw a dashed "target trajectory" line from current to goal. If the athlete is ahead of trajectory, show a green "Ahead of pace" badge. If behind, show amber "Behind pace — increase volume or intensity."

4. **Milestone Celebrations** — When a throw or PR update crosses a milestone threshold, mark it achieved, show a celebration toast ("Milestone hit! 19.0m reached — 2 more to go!"), and create a notification for both athlete and coach.

5. **Goal Insights** — Below the chart, show: "At your current rate of improvement, you'll reach 20.0m by [projected date]" using linear regression on the last 5 PRs.

Use existing chart patterns (ReadinessChart as reference), card components, and Badge component.
```

---

## Weakness #11: Drill Videos Not Linked to Sessions or Exercises (MEDIUM)

**Impact:** Underutilized content | **Effort:** Medium | **Priority:** P2

**The Problem:**
The video library (`/coach/videos`, `/athlete/videos`) and drill videos (`/coach/drill-videos`, `/athlete/drill-videos`) exist as standalone sections, but they're not contextually linked to sessions or exercises. When an athlete is doing a session and sees "Power Position Drill — 3x5," there's no link to a video showing how to perform it. The content exists but is disconnected from where it's needed.

**Why It Matters (Psychology):**
Content discovery follows the "moment of need" principle — people don't browse video libraries, they need the right video at the right time. A drill video shown during a session is 10x more valuable than the same video buried in a library. This is the difference between Netflix (browse when bored) and YouTube tutorials (search when stuck).

**Claude Code Prompt:**
```
Link drill videos to exercises and surface them contextually during sessions:

1. **Database:** Add an optional `drillVideoId` field to the Exercise model (or a join table ExerciseDrillVideo if many-to-many). This links an exercise to its demonstration video.

2. **Coach Exercise Library** — On /coach/exercises, when editing an exercise, add a "Link Drill Video" dropdown that shows available drill videos. Coach can select one to associate.

3. **Athlete Session View** — On /athlete/sessions/[id] and within the throws practice view (/athlete/throws), when displaying an exercise or drill, show a small video icon button next to the exercise name. Clicking it opens a modal or inline player showing the linked drill video.

4. **"How to" Quick Access** — In the athlete's throws practice block stepper, add a subtle "Watch demo" link next to each throwing drill. This opens the associated video in a modal overlay without leaving the session flow.

5. **Smart Suggestions** — On the athlete drill videos page, show a "Recommended for you" section at the top that pulls videos linked to exercises in the athlete's upcoming sessions.

Use existing Modal, video player components, and card patterns. No new dependencies.
```

---

## Weakness #12: No Comparative Analytics for Coaches (MEDIUM)

**Impact:** Reduces perceived value | **Effort:** Medium | **Priority:** P2

**The Problem:**
Coaches can see individual athlete data but can't compare athletes side-by-side. There's no "show me all my shot putters' PR progression this semester" or "compare readiness trends between athlete A and B." The throws dashboard (`/coach/throws`) shows individual data but lacks team-level analytics.

**Why It Matters (Psychology):**
Coaches think in terms of their roster, not individuals. They need to identify who's improving fastest, who's plateauing, and where to allocate their limited practice time. Without comparative views, the app forces a coach to mentally aggregate data across 10+ athlete profiles — exactly the cognitive load a $100/month tool should eliminate.

**Claude Code Prompt:**
```
Add a Team Analytics page for coaches at /coach/analytics (add to sidebar under "Insights"):

1. **PR Leaderboard** — Table showing all athletes ranked by event, with columns: Rank, Name, Event, Current PR, PR 30 days ago, Change, Trend arrow. Filterable by event (shot put, discus, hammer, javelin).

2. **Progress Comparison Chart** — Multi-line chart where coaches can select 2-4 athletes and an event, and see their PR progression over time overlaid on one graph. Use different colored lines per athlete.

3. **Training Volume Comparison** — Bar chart showing sessions completed per athlete in the last 30 days, with compliance percentage overlay.

4. **Readiness Comparison** — Line chart showing 30-day readiness trends for selected athletes overlaid.

5. **Coaching Summary Cards** — At the top: "Team PRs this month," "Average compliance rate," "Athletes improving," "Athletes plateauing." Each card links to a filtered view below.

Create a new nav item in COACH_NAV_SECTIONS under "Insights" section. Use existing chart patterns and extend them for multi-series data. Use existing Avatar, Badge, and card components.
```

---

## Weakness #13: Settings Page Is Overloaded (MEDIUM)

**Impact:** Difficulty finding settings | **Effort:** Small | **Priority:** P2

**The Problem:**
The coach settings page packs profile, billing, invitations, activity log, and preferences into a single tabbed page. The billing section handles Stripe subscription management inline. The activity log shows action history. These are fundamentally different concerns crammed into one page, making it harder to find what you need.

**Why It Matters (Psychology):**
Settings anxiety is real — users avoid settings pages because they're afraid of accidentally changing something important. Mixing "change my name" with "cancel my subscription" in the same page increases perceived risk. Billing should feel distinct and secure, not mixed with profile customization.

**Claude Code Prompt:**
```
Restructure the coach settings into separate, focused pages:

1. **Keep /coach/settings** as the Profile tab only — name, email, bio, organization, avatar. Remove billing, invitations, and activity log tabs.

2. **Move Billing to /coach/settings/billing** — Create a dedicated billing page with its own route. Add a "Billing" link in the sidebar Admin section (below Settings). Include: current plan card, usage (athletes used / limit), payment method, invoice history, upgrade/downgrade buttons, cancel subscription with confirmation.

3. **Move Activity Log to /coach/settings/activity** — Separate page for action history. Optional: link from the main settings page.

4. **Invitations already have /coach/invitations** — Remove the invitations tab from settings (it's redundant with the sidebar link).

5. **Update sidebar navigation** — In COACH_NAV_SECTIONS, add "Billing" under Admin section.

This is primarily a restructuring task — move existing code into new route files rather than rewriting UI. Keep existing component usage.
```

---

## Weakness #14: Throws Quiz Has No Back Button or Progress Save (MEDIUM-LOW)

**Impact:** Onboarding drop-off | **Effort:** Small | **Priority:** P2

**The Problem:**
The throws quiz at `/athlete/throws/quiz` is a multi-step assessment, but based on the code, the back button logic only goes back within quiz sections, not between them. If an athlete is on question 8 of 12 and accidentally closes the tab, they lose all progress. There's no draft saving.

**Why It Matters (Psychology):**
Sunk cost aversion works both ways — if users lose progress, they feel frustrated AND less likely to restart. A 12-question quiz with no save state is a conversion funnel leak. Every lost quiz completion is a coach who doesn't get their athlete's profile data.

**Claude Code Prompt:**
```
Fix the throws quiz at /athlete/throws/quiz:

1. **Progress Persistence** — Save quiz progress to localStorage after each answer. On page load, check for saved progress and offer to resume: "You have an incomplete quiz. Resume where you left off?" with Resume and Start Over buttons.

2. **Back Button** — Ensure the back button works correctly across all quiz sections (not just within a section). The user should be able to go back to any previous question.

3. **Progress Bar** — Add a progress indicator at the top showing "Question X of Y" with a visual progress bar.

4. **Exit Confirmation** — If the user clicks "← Back to Throws" or navigates away with unsaved progress, show a confirmation dialog: "You have unsaved quiz progress. Leave anyway?"

Use existing ProgressBar component and ConfirmDialog component.
```

---

## Weakness #15: No Offline Indicator or Graceful Degradation (LOW)

**Impact:** Edge case frustration | **Effort:** Small | **Priority:** P3

**The Problem:**
There's no indication when the user loses network connectivity. API calls will silently fail, form submissions will appear to hang, and check-ins could be lost. For coaches and athletes at outdoor practice facilities with spotty Wi-Fi, this is a real scenario.

**Why It Matters (Psychology):**
Silent failures destroy trust. If an athlete submits a wellness check-in and it appears to succeed but doesn't save, they'll blame the app. A simple "You're offline — changes will sync when connected" banner prevents frustration and sets correct expectations.

**Claude Code Prompt:**
```
Add a network status indicator and offline resilience:

1. **Offline Banner** — Create a small, non-intrusive banner component that appears at the top of the dashboard layout when navigator.onLine is false: "You're offline. Changes will be saved when you reconnect." Use amber/warning styling. Auto-dismiss when back online with a brief "Back online" success message.

2. **Add to DashboardLayout** — Import and render the banner at the top of the main content area in src/components/layout/DashboardLayout.tsx.

3. **Form Submission Guard** — In key form submissions (wellness check-in, session completion, throw logging), check navigator.onLine before submitting. If offline, show a toast: "Can't save right now — you appear to be offline. Please try again when connected."

This is a lightweight implementation — no service worker or full offline mode. Just user-facing indicators. Use existing Toast component and Tailwind styling.
```

---

## Priority Summary

| # | Weakness | Impact | Effort | Priority |
|---|----------|--------|--------|----------|
| 1 | Coach Wellness Dashboard is dead end | Revenue-threatening | Large | **P0** |
| 2 | No coach-to-athlete communication | Revenue-threatening | Large | **P0** |
| 3 | Workout Plans is dead end | High churn risk | Very Large | **P0** |
| 4 | Missing back buttons / navigation | Daily frustration | Small | **P1** |
| 5 | Athlete profile is a settings redirect | Broken mental model | Medium | **P1** |
| 6 | No data export or reporting | Power user churn | Medium | **P1** |
| 7 | Readiness check-in lacks context | Reduces engagement | Medium | **P1** |
| 8 | No session templates | Slows daily workflow | Medium | **P1** |
| 9 | No athlete onboarding checklist | First-week drop-off | Small | **P2** |
| 10 | Goals lack milestones | Reduces engagement | Medium | **P2** |
| 11 | Videos disconnected from sessions | Underutilized content | Medium | **P2** |
| 12 | No comparative analytics | Reduces perceived value | Medium | **P2** |
| 13 | Settings page overloaded | Difficulty finding things | Small | **P2** |
| 14 | Quiz lacks progress save | Onboarding drop-off | Small | **P2** |
| 15 | No offline indicator | Edge case frustration | Small | **P3** |

---

## Recommended Execution Order

**Sprint 1 (Highest ROI, quickest wins):**
- #4 Back buttons (small effort, immediate UX lift)
- #7 Readiness insights (leverages existing data)
- #9 Athlete onboarding checklist (reduces first-week churn)
- #14 Quiz progress save (small fix, big impact)

**Sprint 2 (Core value delivery):**
- #1 Coach Wellness Dashboard (the daily command center)
- #5 Athlete Profile page (fixes broken experience)
- #8 Session templates (daily time savings)

**Sprint 3 (Competitive differentiation):**
- #2 Session feedback system (coaching relationship)
- #6 Data export (trust signal)
- #10 Goal milestones (engagement loops)

**Sprint 4 (Platform maturity):**
- #3 Workout Plans builder (massive but essential)
- #11 Video-session linking (content strategy)
- #12 Team analytics (premium feature)

**Sprint 5 (Polish):**
- #13 Settings restructure (organizational clarity)
- #15 Offline indicator (resilience)
