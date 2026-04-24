# Route-Consolidation Survivors — Backlog for Next Pass

**Generated:** 2026-04-23 (PR 1 execution)
**Purpose:** Routes flagged as orphans by the first-pass subagent grep but **confirmed reachable** by follow-up template-literal validation. These are not deleted in PR 1. They're the backlog for the next consolidation pass — each may still deserve deletion, just not without explicit evidence.

**Scope delta logged in the PR 1 description:** original brief estimated ~72 orphan candidates (46 coach + 26 athlete). Validation landed on 14 confirmed deletions + 6 validation-gated routes (3 decided, 3 deferred to Commit 7). The remaining ~58 survivors are captured below with the inbound Link evidence that reclassified them.

---

## Method

For each route listed, the "Inbound evidence" column names at least one `file.ext:line` whose href/router.push/redirect/API response embeds the route as a template literal or static string. Double-quote literal greps on the page path (`grep -rn 'href="/coach/goals"'`) missed these — template-literal greps (`grep -rnE '/coach/goals'`) caught them.

**Caveat:** some survivors have a single weak inbound (e.g., only a `matchPaths` registration in the Sidebar). Those are flagged `WEAK` and are the highest-priority candidates for the next pass.

---

## Coach survivors

| Route                                         | Inbound evidence                                                                                          | Grade |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----- |
| `/coach/athletes`                             | `src/app/api/search/route.ts:127` `href: \`/coach/athletes/${a.id}\``; Sidebar "Roster" entry              | strong |
| `/coach/athletes/[id]`                        | `src/app/(dashboard)/coach/athletes/_table.tsx:347` router.push; 20+ other files linking via template      | strong |
| `/coach/athletes/[id]/profile/edit`           | `src/app/(dashboard)/coach/athletes/[id]/_action-bar.tsx:32` router.push                                   | strong |
| `/coach/athletes/invitations`                 | `src/middleware.ts` flag gating; `src/components/ui/Sidebar.tsx` "Invitations" entry (via 307 stub)       | strong |
| `/coach/availability`                         | Sidebar "Availability" entry; `coach/availability/_availability-dashboard.tsx` self-refs                  | strong |
| `/coach/codex`                                | **DECIDED — Commit 8**. Imported by `/athlete/codex` for `CodexView`. Being extracted.                    | n/a |
| `/coach/competitions`                         | `src/app/(dashboard)/coach/schedule/_week-calendar.tsx:186` template-literal href                         | strong |
| `/coach/competitions/[id]`                    | `coach/competitions/_competitions-client.tsx:57,233`                                                       | strong |
| `/coach/event-groups`                         | Sidebar "Event Groups" entry (live href)                                                                  | WEAK — sidebar-only |
| `/coach/exercises`                            | Sidebar "Exercises" entry; `coach/plans/new/_recommender-rail.tsx` API call (implies linkage)             | WEAK — sidebar-only |
| `/coach/goals`                                | Sidebar "Goals" entry                                                                                      | WEAK — sidebar-only |
| `/coach/hub`                                  | Sidebar "Team Hub" entry. **matchPaths narrowed in Commit 6.**                                             | strong (post-Commit-6) |
| `/coach/integrations`                         | `src/app/(dashboard)/coach/integrations/page.tsx:73` self-refs athletes; no external inbound              | WEAK — self-referential |
| `/coach/log-session`                          | `src/components/layout/DashboardLayout.tsx:421` FOCUS_MODE_PREFIXES; `src/components/ui/QuickActions.tsx:111` href | strong |
| `/coach/notifications`                        | `src/components/ui/NotificationBell.tsx:408`; `src/components/ui/Sidebar.tsx` entry                        | strong |
| `/coach/plans/[planId]`                       | `src/app/(dashboard)/coach/plans/page.tsx` list, reached via template literal                             | strong |
| `/coach/plans/new`                            | `src/app/(dashboard)/coach/plans/page.tsx` CTA                                                            | strong |
| `/coach/plans/generate`                       | `src/app/(dashboard)/coach/plans/page.tsx` + `coach/dashboard/page.tsx`                                   | strong |
| `/coach/practices`                            | Sidebar "Practices" entry; 2 inbound from practices/[id]                                                   | strong |
| `/coach/practices/[id]`                       | `src/app/(dashboard)/coach/practices/page.tsx` template-literal row linkage                               | strong |
| `/coach/questionnaires/[id]`                  | `src/app/(dashboard)/coach/questionnaires/_questionnaire-builder.tsx` template literal                    | strong |
| `/coach/questionnaires/[id]/responses`        | `coach/questionnaires/[id]/_questionnaire-actions.tsx`                                                     | strong |
| `/coach/questionnaires/new`                   | `src/app/(dashboard)/coach/questionnaires/page.tsx` CTA                                                   | strong |
| `/coach/schedule`                             | Sidebar "Schedule" entry; `coach/settings/page.tsx:1275`                                                   | strong |
| `/coach/schedule/print`                       | `src/app/(dashboard)/coach/schedule/page.tsx:256` template literal                                        | strong |
| `/coach/settings/autoregulation`              | `src/app/(dashboard)/coach/settings/page.tsx`                                                             | strong |
| `/coach/settings/notifications`               | `src/app/(dashboard)/coach/settings/page.tsx`                                                             | strong |
| `/coach/team`                                 | Sidebar "Team Feed" entry                                                                                  | WEAK — sidebar-only |
| `/coach/teams`                                | Sidebar "Groups" entry                                                                                     | WEAK — sidebar-only |
| `/coach/throws`                               | `src/components/ui/Sidebar.tsx` Training parent; `coach/dashboard/_onboarding-checklist.tsx`              | strong |
| `/coach/throws/[id]`                          | `src/app/api/athlete/session-recap/[sessionId]/notify-coach/route.ts:106` notification link               | strong |
| `/coach/throws/analyze`                       | `coach/throws/analyze/[id]/page.tsx:167,216`; `analyze/history/page.tsx:68,118`                           | strong |
| `/coach/throws/analyze/[id]`                  | `coach/throws/analyze/page.tsx:175` router.push template literal                                           | strong |
| `/coach/throws/analyze/history`               | `coach/throws/analyze/[id]/page.tsx:122` router.push; `analyze/page.tsx:197` href                         | strong |
| `/coach/throws/assessment/[athleteId]`        | `src/app/(dashboard)/coach/athletes/[id]/page.tsx:503` template literal                                    | strong |
| `/coach/throws/builder`                       | Sidebar "Drill Builder" + `coach/throws/library/page.tsx:214`                                              | strong |
| `/coach/throws/drills`                        | Sidebar "Drills" entry; `coach/drill-videos/page.tsx` 307 target                                          | strong |
| `/coach/throws/invite`                        | `coach/athletes/_views/throws-view.tsx:432,814`; `coach/throws/_throws-view.tsx:357,411,528`              | strong |
| `/coach/throws/library`                       | Sidebar entry; `coach/throws/builder/page.tsx:280` router.push                                             | strong |
| `/coach/throws/practice`                      | Sidebar "Live Practice"; `coach/throws/practice/[sessionId]/page.tsx:905,980`                             | strong |
| `/coach/throws/practice/[sessionId]`          | `coach/throws/practice/page.tsx:69,260` template-literal href + router.push                                | strong |
| `/coach/throws/profile`                       | `coach/athletes/_views/throws-view.tsx:282,941`; `coach/throws/_throws-view.tsx:712,1026`                 | strong |
| `/coach/throws/profile/typing`                | `coach/throws/profile/page.tsx:942,1253,1357` template-literal href                                        | strong |
| `/coach/throws/programming`                   | **DECIDED — Commit 9**. 307 → `/coach/plans/generate`; page deleted.                                      | n/a |
| `/coach/tools`                                | `src/components/ui/QuickActions.tsx:136` href                                                              | WEAK — quick-action-only |
| `/coach/video-analysis`                       | `coach/video-analysis/[id]/_analysis-workspace.tsx`; `live/_live-capture.tsx`; `upload/page.tsx`          | strong |
| `/coach/video-analysis/[id]`                  | `coach/video-analysis/page.tsx` template literal                                                          | strong |
| `/coach/video-analysis/live`                  | `coach/video-analysis/page.tsx` CTA                                                                        | strong |
| `/coach/video-analysis/upload`                | `coach/video-analysis/page.tsx` CTA                                                                        | strong |
| `/coach/videos/[id]`                          | `coach/videos/[id]/_video-editor.tsx`; `videos/drills/page.tsx`                                            | strong |
| `/coach/videos/drills`                        | `coach/videos/page.tsx` CTA                                                                                | strong |
| `/coach/videos/upload`                        | `coach/videos/page.tsx` CTA                                                                                | strong |
| `/coach/wellness`                             | `src/components/ui/QuickActions.tsx` href                                                                  | WEAK — quick-action-only |

### Coach — WEAK-inbound shortlist for next pass

Routes reachable only via a Sidebar entry or QuickActions — no actual Link in a rendered page points to them. Candidates for "does this surface still pay rent?" review:

- `/coach/event-groups`, `/coach/goals`, `/coach/team`, `/coach/teams` — sidebar-only.
- `/coach/exercises` — sidebar entry + API consumer, no user-facing Link.
- `/coach/integrations` — self-referential; inbound only from itself.
- `/coach/tools`, `/coach/wellness` — QuickActions-only.

## Athlete survivors

| Route                                         | Inbound evidence                                                                                          | Grade |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----- |
| `/athlete/achievements`                       | `src/app/(dashboard)/athlete/profile/page.tsx:221` nav array; `athlete/throws/_chip-nav.tsx:36`            | strong |
| `/athlete/assessments`                        | `src/app/(dashboard)/athlete/profile/page.tsx:185`                                                         | strong |
| `/athlete/availability`                       | BottomTabBar matchPaths (weak); no other inbound                                                           | WEAK — tab-match-only |
| `/athlete/codex`                              | `src/components/ui/QuickActions.tsx:79` + `athlete/profile/page.tsx:200`                                   | strong |
| `/athlete/competitions`                       | BottomTabBar matchPaths; `AthleteAddMeetModal.tsx:93` router.push template                                 | strong |
| `/athlete/competitions/[id]`                  | `src/app/(dashboard)/athlete/competitions/page.tsx:74`                                                     | strong |
| `/athlete/drill-videos`                       | `athlete/profile/page.tsx:206`; `athlete/sessions/_training-hub.tsx:37`; `lib/data/training-hub.ts:609`    | strong |
| `/athlete/feedback`                           | Sidebar matchPaths registration (weak, sidebar isn't mounted in AthleteShell)                             | WEAK — dead-sidebar-only |
| `/athlete/goals`                              | Sidebar matchPaths (weak, sidebar isn't mounted)                                                           | WEAK — dead-sidebar-only |
| `/athlete/insights`                           | `athlete/profile/page.tsx` nav array                                                                       | strong |
| `/athlete/integrations`                       | `athlete/settings/page.tsx:124`; `api/whoop/callback/route.ts:17`                                          | strong |
| `/athlete/notifications`                      | BottomTabBar matchPaths; `src/components/ui/NotificationBell.tsx:408`                                      | strong |
| `/athlete/onboarding`                         | Middleware flag gate                                                                                       | strong |
| `/athlete/oura`                               | `api/oura/callback/route.ts:15`                                                                            | strong |
| `/athlete/profile`                            | BottomTabBar TABS[4]                                                                                       | strong |
| `/athlete/questionnaires`                     | `athlete/questionnaires/[id]/_questionnaire-form.tsx`                                                      | strong |
| `/athlete/questionnaires/[id]`                | `athlete/questionnaires/page.tsx`                                                                          | strong |
| `/athlete/review-profile`                     | `src/app/api/auth/register-claim/route.ts:142` server-side redirect                                        | strong |
| `/athlete/self-program`                       | `athlete/self-program/[id]/_program-detail.tsx:180` href; `athlete/sessions/_training-hub.tsx` references  | strong |
| `/athlete/self-program/[id]`                  | `athlete/self-program/_hub.tsx:495` template literal                                                       | strong |
| `/athlete/self-program/[id]/session/[sessionId]` | `athlete/self-program/[id]/_week-expansion.tsx:137` template literal                                   | strong |
| `/athlete/self-program/create`                | `athlete/self-program/_hub.tsx:181,391` href                                                               | strong |
| `/athlete/session/[id]`                       | `athlete/dashboard/_stale-session-checker.tsx:57` router.push; `sessions/[id]/_complete-button.tsx:34`    | strong |
| `/athlete/sessions`                           | BottomTabBar Training tab anchor; `athlete/dashboard/_widgets/today-workout.tsx`                          | strong |
| `/athlete/settings`                           | `athlete/oura/page.tsx`; `athlete/settings/notifications/page.tsx`                                        | strong |
| `/athlete/settings/notifications`             | `athlete/settings/page.tsx`                                                                                | strong |
| `/athlete/team`                               | BottomTabBar matchPaths                                                                                    | WEAK — tab-match-only |
| `/athlete/throws`                             | BottomTabBar Throws anchor; `athlete/dashboard/_welcome-card.tsx`                                          | strong |
| `/athlete/throws/[id]`                        | `api/athlete/session-recap/[sessionId]/notify-coach/route.ts:106`                                         | strong |
| `/athlete/throws/history`                     | BottomTabBar matchPaths + Sidebar                                                                          | strong |
| `/athlete/throws/quiz`                        | `athlete/throws/page.tsx` CTA                                                                              | strong |
| `/athlete/throws/readiness`                   | BottomTabBar matchPaths; Sidebar                                                                           | strong |
| `/athlete/throws/trends`                      | BottomTabBar matchPaths; Sidebar                                                                           | strong |
| `/athlete/tools`                              | `athlete/profile/_tab-core.tsx:279`; `QuickActions.tsx:74`                                                 | strong |
| `/athlete/videos`                             | `athlete/profile/page.tsx:212`; `athlete/dashboard/_widgets/recent-videos.tsx:25`                         | strong |
| `/athlete/videos/[id]`                        | `athlete/videos/page.tsx:51`; `athlete/dashboard/_widgets/recent-videos.tsx:56`                           | strong |
| `/athlete/wellness`                           | BottomTabBar matchPaths                                                                                    | WEAK — tab-match-only |
| `/athlete/whoop`                              | `api/whoop/callback/route.ts:17`                                                                           | strong |

### Athlete — WEAK-inbound shortlist for next pass

Athlete routes reachable only via BottomTabBar matchPaths (cosmetic, not an active link):

- `/athlete/availability`, `/athlete/team`, `/athlete/wellness` — reach only through matchPaths registration. If the Me tab (profile) were designed to link to them explicitly, these would be strong. Next pass: audit whether the profile page surfaces links to availability/team/wellness or whether they're effectively dead.
- `/athlete/feedback`, `/athlete/goals` — show up in the exported `ATHLETE_NAV_SECTIONS` sidebar config, but `AthleteShell` never mounts `<Sidebar>`. Dead in practice.

---

## Next-pass decision framework

For each WEAK survivor:

1. **Read the page.** What does it render? Is the content unique or duplicative of a stronger surface?
2. **Ask: does it pay rent?** Per CLAUDE.md §Ruthless Perfectionism — "should this exist? what's the one essential version?" Weak-inbound pages rarely do.
3. **If yes, wire a real Link** — either from `/athlete/profile` → feature surface, or from a coach sidebar entry with a dedicated row (not just matchPaths).
4. **If no, 307 + delete** — treat it like the redirect stubs in PR 1 Commit 3.

The goal of tracking survivors here (rather than deleting them) is that we want evidence, not gut calls. Every weak survivor needs a "would a staff engineer approve deletion of this?" test first.
