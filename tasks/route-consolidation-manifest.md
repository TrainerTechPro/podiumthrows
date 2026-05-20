# Route Consolidation Manifest

Canonical inventory of every page route under `src/app/(dashboard)`. Each row
declares the route's status (canonical, redirect, flag-gated, detail-only), the
canonical target if it isn't itself canonical, and the action taken.

This manifest is the **single source of truth** for which dashboard URLs are
real product surfaces. It supersedes ad-hoc grepping when answering "is this
route alive?". Companion docs:

- `tasks/navigation-contract.md` — what appears in the sidebar / bottom tabs
- `next.config.mjs` — the actual redirect implementation
- `src/middleware.ts` + `src/lib/flag-gated-routes.ts` — flag gating

Supersedes the dated `tasks/route-consolidation-manifest.md@2026-04-23` first
pass. The May 18 nav-contract shipment expanded the redirect set; that is
reflected here.

## Status taxonomy

| Status        | Meaning                                                                                |
| ------------- | -------------------------------------------------------------------------------------- |
| `canonical`   | Real product surface — page.tsx renders, appears in primary nav or is a deep-link home |
| `detail`      | Dynamic-segment detail page — reached only via a canonical list (e.g. `/foo/[id]`)     |
| `flag-gated`  | Page renders only when its feature flag is on (middleware redirects otherwise)         |
| `redirect`    | Route is a `next.config.mjs` redirect source — page.tsx must be deleted                |
| `auth-router` | Role-agnostic post-login splitter (single role-router URL, not user-facing)            |

## Action taxonomy

| Action     | Meaning                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------- |
| `keep`     | Already canonical — no change                                                            |
| `delete`   | page.tsx exists but route is a redirect source; delete to remove shadow                  |
| `ghost`    | page.tsx kept (imported as a React module by a canonical page); URL is dead via redirect |
| `rewrite`  | In-app Link/router.push points here; update call site to canonical URL                   |

---

## Athlete routes

| Route                                            | Status      | Canonical target                      | Action     |
| ------------------------------------------------ | ----------- | ------------------------------------- | ---------- |
| `/athlete/dashboard`                             | canonical   | —                                     | keep       |
| `/athlete/sessions`                              | canonical   | —                                     | keep       |
| `/athlete/session/[id]`                          | detail      | (from sessions list)                  | keep       |
| `/athlete/log-session`                           | canonical   | —                                     | keep       |
| `/athlete/throws`                                | canonical   | —                                     | keep       |
| `/athlete/throws/[id]`                           | detail      | (from throws list)                    | keep       |
| `/athlete/throws/history`                        | canonical   | —                                     | keep       |
| `/athlete/throws/log`                            | canonical   | —                                     | keep       |
| `/athlete/throws/quiz`                           | canonical   | —                                     | keep       |
| `/athlete/throws/readiness`                      | canonical   | —                                     | keep       |
| `/athlete/throws/trends`                         | flag-gated  | flag `throwsAnalysis`                 | keep       |
| `/athlete/profile`                               | canonical   | —                                     | keep       |
| `/athlete/settings`                              | canonical   | —                                     | keep       |
| `/athlete/settings/fix-throw-history`            | canonical   | (utility sub-page)                    | keep       |
| `/athlete/wellness`                              | canonical   | —                                     | keep       |
| `/athlete/onboarding`                            | canonical   | —                                     | keep       |
| `/athlete/quick-start`                           | canonical   | —                                     | keep       |
| `/athlete/notifications`                         | canonical   | —                                     | keep       |
| `/athlete/feedback`                              | canonical   | —                                     | keep       |
| `/athlete/goals`                                 | canonical   | —                                     | keep       |
| `/athlete/competitions`                          | canonical   | —                                     | keep       |
| `/athlete/competitions/[id]`                     | detail      | —                                     | keep       |
| `/athlete/assessments`                           | canonical   | —                                     | keep       |
| `/athlete/availability`                          | canonical   | —                                     | keep       |
| `/athlete/achievements`                          | canonical   | —                                     | keep       |
| `/athlete/drill-videos`                          | canonical   | —                                     | keep       |
| `/athlete/videos`                                | canonical   | —                                     | keep       |
| `/athlete/videos/[id]`                           | detail      | —                                     | keep       |
| `/athlete/integrations`                          | canonical   | —                                     | keep       |
| `/athlete/oura`                                  | flag-gated  | flag `ouraIntegration`                | keep       |
| `/athlete/whoop`                                 | flag-gated  | flag `whoopIntegration`               | keep       |
| `/athlete/questionnaires`                        | flag-gated  | flag `questionnaireBuilder`           | keep       |
| `/athlete/questionnaires/[id]`                   | flag-gated  | flag `questionnaireBuilder`           | keep       |
| `/athlete/self-program`                          | flag-gated  | flag `selfProgram`                    | keep       |
| `/athlete/self-program/[id]`                     | flag-gated  | flag `selfProgram`                    | keep       |
| `/athlete/self-program/[id]/session/[sessionId]` | flag-gated  | flag `selfProgram`                    | keep       |
| `/athlete/self-program/create`                   | flag-gated  | flag `selfProgram`                    | keep       |
| `/athlete/codex`                                 | redirect    | `/athlete/dashboard`                  | **delete** |
| `/athlete/insights`                              | redirect    | `/athlete/dashboard`                  | **delete** |
| `/athlete/team`                                  | redirect    | `/athlete/dashboard`                  | **delete** |
| `/athlete/tools`                                 | redirect    | `/athlete/settings`                   | **delete** |
| `/athlete/sessions/[id]`                         | redirect    | `/athlete/session/[id]`               | **delete** |
| `/athlete/settings/notifications`                | redirect    | `/athlete/settings?tab=notifications` | **delete** |

## Coach routes

| Route                                       | Status     | Canonical target                          | Action     |
| ------------------------------------------- | ---------- | ----------------------------------------- | ---------- |
| `/coach/dashboard`                          | canonical  | —                                         | keep       |
| `/coach/athletes`                           | canonical  | —                                         | keep       |
| `/coach/athletes/[id]`                      | detail     | (from roster)                             | keep       |
| `/coach/athletes/[id]/profile`              | detail     | —                                         | keep       |
| `/coach/athletes/[id]/profile/edit`         | detail     | —                                         | keep       |
| `/coach/athletes/[id]/assessments`          | detail     | —                                         | keep       |
| `/coach/athletes/[id]/fix-throws`           | detail     | (utility sub-page)                        | keep       |
| `/coach/athletes/print`                     | canonical  | —                                         | keep       |
| `/coach/athletes/invitations`               | canonical  | —                                         | keep       |
| `/coach/athletes/groups`                    | canonical  | —                                         | keep       |
| `/coach/athletes/event-groups`              | canonical  | —                                         | keep       |
| `/coach/athletes/goals`                     | canonical  | —                                         | keep       |
| `/coach/athletes/competitions`              | canonical  | —                                         | keep       |
| `/coach/athletes/announcements`             | canonical  | —                                         | keep       |
| `/coach/athletes/throws`                    | canonical  | —                                         | keep       |
| `/coach/calendar`                           | canonical  | —                                         | keep       |
| `/coach/calendar/print`                     | canonical  | —                                         | keep       |
| `/coach/builder`                            | canonical  | —                                         | keep       |
| `/coach/library`                            | canonical  | —                                         | keep       |
| `/coach/settings`                           | canonical  | —                                         | keep       |
| `/coach/video-analysis`                     | flag-gated | flag `videoAnalysis`                      | keep       |
| `/coach/video-analysis/[id]`                | flag-gated | flag `videoAnalysis`                      | keep       |
| `/coach/video-analysis/live`                | flag-gated | flag `videoAnalysis`                      | keep       |
| `/coach/video-analysis/upload`              | flag-gated | flag `videoAnalysis`                      | keep       |
| `/coach/onboarding/welcome`                 | canonical  | —                                         | keep       |
| `/coach/notifications`                      | canonical  | —                                         | keep       |
| `/coach/feedback-inbox`                     | canonical  | —                                         | keep       |
| `/coach/search`                             | canonical  | (⌘K palette landing)                      | keep       |
| `/coach/competitions/[id]`                  | detail     | —                                         | keep       |
| `/coach/plans/[planId]`                     | detail     | (from library plan rows)                  | keep       |
| `/coach/plans/[planId]/print`               | detail     | —                                         | keep       |
| `/coach/practices/[id]`                     | detail     | (from calendar)                           | keep       |
| `/coach/throws/[id]`                        | detail     | (canonical throws-session view)           | keep       |
| `/coach/throws/[id]/print`                  | detail     | —                                         | keep       |
| `/coach/throws/practice/[sessionId]`        | flag-gated | flag `practiceMode`                       | keep       |
| `/coach/architect`                          | flag-gated | flag `aiArchitect`                        | keep       |
| `/coach/sideline`                           | flag-gated | flag `coachSideline`                      | keep       |
| `/coach/questionnaires`                     | flag-gated | flag `questionnaireBuilder`               | keep       |
| `/coach/questionnaires/[id]`                | flag-gated | flag `questionnaireBuilder`               | keep       |
| `/coach/questionnaires/[id]/responses`      | flag-gated | flag `questionnaireBuilder`               | keep       |
| `/coach/questionnaires/new`                 | flag-gated | flag `questionnaireBuilder`               | keep       |
| `/coach/schedule`                           | redirect   | `/coach/calendar`                         | **delete** |
| `/coach/practices`                          | redirect   | `/coach/calendar?view=by-athlete`         | **delete** |
| `/coach/availability`                       | redirect   | `/coach/calendar?view=compliance`         | **delete** |
| `/coach/throws/practice`                    | redirect   | `/coach/calendar?view=live`               | **delete** |
| `/coach/exercises`                          | redirect   | `/coach/library?view=exercises`           | **delete** |
| `/coach/throws/library`                     | redirect   | `/coach/library?view=sessions`            | **delete** |
| `/coach/throws/drills`                      | redirect   | `/coach/library?view=drills`              | **delete** |
| `/coach/plans`                              | redirect   | `/coach/library?view=plans`               | **delete** |
| `/coach/videos/drills`                      | redirect   | `/coach/library?view=drills`              | **delete** |
| `/coach/throws/builder`                     | redirect   | `/coach/builder?type=session`             | **delete** |
| `/coach/plans/new`                          | redirect   | `/coach/builder?type=plan`                | **delete** |
| `/coach/plans/generate`                     | redirect   | `/coach/builder?type=plan&mode=generate`  | **delete** |
| `/coach/teams`                              | redirect   | `/coach/athletes/groups`                  | **delete** |
| `/coach/event-groups`                       | redirect   | `/coach/athletes/event-groups`            | ghost      |
| `/coach/goals`                              | redirect   | `/coach/athletes/goals`                   | **delete** |
| `/coach/competitions`                       | redirect   | `/coach/athletes/competitions`            | **delete** |
| `/coach/team`                               | redirect   | `/coach/athletes/announcements`           | **delete** |
| `/coach/athlete-logs`                       | redirect   | `/coach/athletes?tab=self-logs`           | **delete** |
| `/coach/throws/assessment/[athleteId]`      | redirect   | `/coach/athletes/[athleteId]/assessments` | **delete** |
| `/coach/throws`                             | redirect   | `/coach/dashboard`                        | **delete** |
| `/coach/log-session`                        | redirect   | `/coach/calendar`                         | **delete** |
| `/coach/wellness`                           | redirect   | `/coach/dashboard?tab=readiness`          | **delete** |
| `/coach/hub`                                | redirect   | `/coach/dashboard`                        | **delete** |
| `/coach/tools`                              | redirect   | `/coach/settings?tab=integrations`        | **delete** |
| `/coach/integrations`                       | redirect   | `/coach/settings?tab=integrations`        | **delete** |
| `/coach/throws/analyze`                     | redirect   | `/coach/video-analysis`                   | **delete** |
| `/coach/throws/analyze/[id]`                | redirect   | `/coach/video-analysis/[id]`              | **delete** |
| `/coach/throws/analyze/history`             | redirect   | `/coach/video-analysis?tab=history`       | **delete** |
| `/coach/videos`                             | redirect   | `/coach/video-analysis`                   | **delete** |
| `/coach/videos/[id]`                        | redirect   | `/coach/video-analysis/[id]`              | **delete** |
| `/coach/videos/upload`                      | redirect   | `/coach/video-analysis/upload`            | **delete** |
| `/coach/settings/notifications`             | redirect   | `/coach/settings?tab=notifications`       | **delete** |
| `/coach/settings/security`                  | redirect   | `/coach/settings?tab=security`            | ghost      |
| `/coach/settings/autoregulation`            | redirect   | `/coach/settings?tab=autoregulation`      | ghost      |

## Auth-router

| Route        | Status      | Notes                                          |
| ------------ | ----------- | ---------------------------------------------- |
| `/dashboard` | auth-router | Single role-agnostic post-login splitter (RR). |

---

## Summary

- **Canonical pages**: 56 (47 coach + 9 athlete primary canonical surfaces)
- **Detail pages**: 16 (reached only via canonical list)
- **Flag-gated pages**: 19 (gated by `src/lib/flags.ts` keys)
- **Shadowed `page.tsx` to delete**: **40** (6 athlete + 34 coach)
- **Auth-router**: 1

## Canonical surfaces per user job

| User job              | Athlete                         | Coach                             |
| --------------------- | ------------------------------- | --------------------------------- |
| Dashboard / home      | `/athlete/dashboard`            | `/coach/dashboard`                |
| Roster / people       | (n/a — single-user)             | `/coach/athletes`                 |
| Calendar / scheduling | (via `/athlete/sessions`)       | `/coach/calendar`                 |
| Programming author    | (flag: `/athlete/self-program`) | `/coach/builder`                  |
| Programming library   | (via `/athlete/sessions`)       | `/coach/library`                  |
| Session detail        | `/athlete/session/[id]`         | `/coach/throws/[id]`              |
| Log session           | `/athlete/log-session`          | (contextual via Calendar)         |
| Onboarding            | `/athlete/onboarding`           | `/coach/onboarding/welcome`       |
| Throws performance    | `/athlete/throws`               | `/coach/athletes/throws` (cohort) |
| Video                 | `/athlete/videos`               | `/coach/video-analysis` (flag)    |
| Settings              | `/athlete/settings`             | `/coach/settings`                 |

## Verification

- All 41 dead page.tsx routes (40 listed + 1 param-aliased `/coach/athletes/[id]/sessions/[sessionId]`) have a matching `source:` entry in `next.config.mjs` redirects, verified statically via set-intersection.
- Sidebar / bottom tab hrefs already pointed to canonical destinations after the May 18 nav-contract pass.
- Test guard: `src/__tests__/nav/sidebar-resolution.test.ts` walks every sidebar href and asserts it resolves to either a page.tsx OR a redirect source — ensures we never sidebar-link a deleted route.

## Ghost routes (3 page.tsx files kept as React modules)

These three `page.tsx` files remain on disk but the URL is dead — `next.config.mjs` redirects intercept before file-system routing. They survive because a canonical page imports them as a React component:

| File                                            | Imported by                                   | Why                                                    |
| ----------------------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| `coach/event-groups/page.tsx`                   | `coach/athletes/event-groups/page.tsx`        | Default-export re-export of the event-groups view     |
| `coach/settings/security/page.tsx`              | `coach/settings/page.tsx` (dynamic)           | Rendered as the Security tab inside Settings shell    |
| `coach/settings/autoregulation/page.tsx`        | `coach/settings/page.tsx` (dynamic)           | Rendered as the Autoregulation tab inside Settings shell |

Follow-up: rename to `_*-view.tsx` and move under the canonical page directory so the file's intent matches its use. Out of scope for this consolidation pass.

## Orphan `_*.tsx` components

After deleting page.tsx files, the co-located `_*.tsx` components remain. Some are still imported by canonical pages (Library, Builder, Calendar, Athletes/* etc.) and must stay. The rest are truly orphan and can be removed in a follow-up cleanup PR. A grep audit (`grep -rn "_<component>"` against the deleted page's directory) will identify which ones.
