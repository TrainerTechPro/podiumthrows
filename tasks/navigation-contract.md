# Navigation Contract — canonical

Podium Throws is two products sharing a database: an **athlete app** that ships through a thumb on a phone, and a **coach desktop** that runs a roster. Navigation is the product contract — the sidebar and the bottom-tab bar are the two screens the user must be able to read the product from. If a surface can't earn a slot in those two screens, it doesn't earn a daily build of the user's attention.

This document is the living source of truth. The dated snapshot at `navigation-contract-2026-05-18.md` records the consolidation pass that brought us here; this file supersedes it.

## The weekly coaching loop

```
coach plans throws training
   ↓
athlete executes / logs
   ↓
coach reviews readiness / compliance / results
   ↓
coach adjusts next session
```

Every primary nav item must serve a step in this loop. Surfaces that don't move the loop forward are deep-links, flag-gated modules, or gone.

---

## Athlete contract — five bottom tabs, no sidebar

Mobile is the design source of truth. The desktop athlete view is the same `BottomTabBar` at a wider container — a roomy fallback, not an alternate product. There is no athlete sidebar.

Defined in `src/components/layout/BottomTabBar.tsx`.

| Tab | Route | What lives here | Why it earns primary nav |
|---|---|---|---|
| **Home** | `/athlete/dashboard` | Today's state, next action, readiness check-in, streak, week-at-a-glance | The opening screen has to answer "what now?" in under a second. Readiness ladders up here because it gates the next training decision — not because it's a profile setting. |
| **Training** | `/athlete/sessions` | Assigned sessions, upcoming plan, self-program (when flag on) | The athlete's relationship with the coach is the assigned session. This is its home. |
| **Log** | `/athlete/log-session` | New session capture — single-screen form, not a wizard | The reason the product exists. Elevated as the primary action: center button, amber, haptic on tap. |
| **Throws** | `/athlete/throws` | PRs, trends, history, competitions, readiness detail, quiz | The throws-specific identity layer — the part that justifies a throws-only app over generic strength-coaching software. |
| **Me** | `/athlete/profile` | Profile, settings, notifications | The setup-and-forget shelf. Wellness check-in is **not** here — it moved to Home. |

### Tab matchPath behaviour (highlighting)

| Visited route | Highlighted tab |
|---|---|
| `/athlete/dashboard`, `/athlete/wellness` | Home |
| `/athlete/sessions`, `/athlete/self-program/*` | Training |
| `/athlete/log-session`, `/athlete/quick-start` | Log |
| `/athlete/throws/*` (`history`, `trends`, `readiness`, `quiz`, `session`, `live`), `/athlete/achievements`, `/athlete/competitions/*` | Throws |
| `/athlete/profile`, `/athlete/settings/*`, `/athlete/notifications` | Me |
| `/athlete/availability`, `/athlete/integrations` | **no tab** (deep-link only) |

Deep-link surfaces with no tab highlight are honest — the athlete got there from a coach calendar share or a wearable banner, not from a tab. The bottom bar doesn't pretend that's a primary destination.

---

## Coach contract — six sidebar items, plus conditional Video

Defined in `src/components/ui/coach-nav-sections.tsx` (`getCoachNavSections`). The coach layout resolves feature flags server-side and passes the resulting `NavSection[]` to `DashboardLayout` so the sidebar never points at a route the middleware would immediately redirect away from.

| Item | Route | What lives here | Why it earns primary nav |
|---|---|---|---|
| **Dashboard** | `/coach/dashboard` | Today's roster pulse: readiness, compliance, attention list, recent sessions | The 30-second answer to "is anything on fire this morning?" Wellness is a tab here (`?tab=readiness`), not its own destination. |
| **Athletes** | `/coach/athletes` | Roster, plus six children: Throws, Invitations, Groups, Event Groups, Goals, Announcements. Roster header pills cover Tier-1: Self-Logs, Competitions. | The roster is the asset. Tier-2 admin surfaces live under it as siblings, not scattered under a generic "Manage." |
| **Calendar** | `/coach/calendar` | Schedule, per-athlete view, compliance, live practice mode | Coaches plan in weeks. One calendar absorbs four old top-level pages. |
| **Builder** | `/coach/builder` | Session, plan (manual + generate), drill — `?type=` and `?mode=` switches | Composing training is the act, not a category. One builder, switchable. Listed before Library because authoring precedes archiving in the weekly loop. |
| **Library** | `/coach/library` | Exercises, throws sessions, drills, plans, drill videos — `?view=` switches | Stored assets, separate from authoring. One library, switchable. |
| **Video** *(pilot-gated)* | `/coach/video-analysis` | Video upload, analysis, live pose detection — appears only when the `videoAnalysis` flag is on for the coach's tier | Pilot-tier feature. Hidden from the sidebar whenever the route would redirect, so a click never lies. |
| **Settings** | `/coach/settings` | Profile, security, notifications, autoregulation, integrations, tools — tabs in URL | Setup shelf, anchored at the bottom of the sidebar, away from daily work. |

### Mobile fallback

The coach sidebar slides in/out via hamburger on phone-class viewports. The full nav is available — there is no separate "coach mobile" IA. For true sideline triage on a phone-class UA there is the optional `/coach/sideline` route, gated behind `coachSideline`. The `SidelineFAB` only renders when the flag is on.

---

## Hidden / flag-gated modules

These routes exist in the codebase but never appear in primary nav. They are gated by `src/lib/flags.ts` and enforced by `src/middleware.ts` (block: "Feature flag gating") via `src/lib/flag-gated-routes.ts`. When the flag is off, middleware redirects to the role dashboard before the page renders.

| Route prefix | Flag | Default | Surfaces when on |
|---|---|---|---|
| `/coach/architect` | `aiArchitect` | off | AI program architect |
| `/coach/sideline` | `coachSideline` | off | Phone-class field UI + FAB |
| `/coach/video-analysis/*` | `videoAnalysis` | off | Sidebar entry "Video" |
| `/coach/videos` | `videoAnnotator` | off | Legacy video tooling |
| `/coach/questionnaires/*` | `questionnaireBuilder` | off | Builder + responses |
| `/coach/throws/practice` | `practiceMode` | on | Live practice |
| `/athlete/self-program/*` | `selfProgram` | off | Self-programming |
| `/athlete/questionnaires/*` | `questionnaireBuilder` | off | Athlete questionnaire fills |
| `/athlete/throws/trends` | `throwsAnalysis` | on | Trends graphs |
| `/athlete/oura` | `ouraIntegration` | on | Oura connect |
| `/athlete/whoop` | `whoopIntegration` | on | Whoop connect |

Defaults are MVP-shipping defaults; Edge Config overrides per-environment. A default of `on` means the gate exists but production ships with the surface available — flipping the flag off becomes the kill switch.

---

## Deep-link-only surfaces (resolve, not in primary nav)

These pages serve substantive UI and are reached from contextual entry points — coach calendar share, wearable banner, search result, athlete-detail breadcrumb, top-bar bell — never from primary nav.

### Athlete deep-links

`/athlete/achievements`, `/athlete/assessments`, `/athlete/availability`, `/athlete/competitions`, `/athlete/competitions/[id]`, `/athlete/drill-videos`, `/athlete/feedback`, `/athlete/goals`, `/athlete/integrations`, `/athlete/notifications`, `/athlete/onboarding`, `/athlete/quick-start`, `/athlete/session/[id]`, `/athlete/settings`, `/athlete/settings/fix-throw-history`, `/athlete/throws/[id]`, `/athlete/throws/history`, `/athlete/throws/log`, `/athlete/throws/quiz`, `/athlete/throws/readiness`, `/athlete/videos/[id]`, `/athlete/wellness`.

### Coach deep-links

`/coach/athletes/[id]/*` (Overview, Training, Throws, Performance, Readiness, Wellness, Goals, Assessments, Sessions, Fix-throws, Profile/edit), `/coach/athletes/print`, `/coach/calendar/print`, `/coach/competitions/[id]`, `/coach/feedback-inbox`, `/coach/notifications`, `/coach/onboarding/welcome`, `/coach/plans/[planId]`, `/coach/plans/[planId]/print`, `/coach/practices/[id]`, `/coach/search`, `/coach/session/[id]`, `/coach/settings/*`, `/coach/throws/[id]`, `/coach/throws/[id]/print`.

---

## Redirect map

All redirects live in `next.config.mjs` (`redirects()`). Permanence reflects intent: `308` = real IA migration, do not downgrade; `307` = cleanup of in-tree stubs that may shift in a follow-up consolidation pass.

### Athlete (MVP cut, 307)

| Source | Destination | Reason |
|---|---|---|
| `/athlete/insights` | `/athlete/dashboard` | MVP cut |
| `/athlete/codex` | `/athlete/dashboard` | MVP cut |
| `/athlete/tools` | `/athlete/settings` | MVP cut |
| `/athlete/team` | `/athlete/dashboard` | MVP cut |
| `/athlete/hub` | `/athlete/dashboard` | Stub consolidation |
| `/athlete/settings/notifications` | `/athlete/settings?tab=notifications` | Settings consolidation |

### Athlete (IA migrations, 308)

| Source | Destination | Reason |
|---|---|---|
| `/athlete/throws/analysis` | `/athlete/throws/trends` | Renamed |
| `/athlete/throws/profile` | `/athlete/throws/readiness` | Renamed |
| `/athlete/review-profile` | `/athlete/onboarding?from=invite` | Onboarding consolidation |
| `/athlete/sessions/:id` | `/athlete/session/:id` | URL flattening |
| `/athlete/sessions/:id/recap` | `/athlete/session/:id?view=recap` | URL flattening |
| `/athlete/sessions/assignment/:id` | `/athlete/throws/:id` | URL flattening |
| `/athlete/throws/session/:id` | `/athlete/throws/:id` | URL flattening |
| `/athlete/throws/live/:id` | `/athlete/throws/:id?view=live` | URL flattening |

### Coach — Calendar absorbs

`/coach/schedule`, `/coach/schedule/:path*`, `/coach/practices` (list), `/coach/availability`, `/coach/throws/practice`, `/coach/log-session`, `/coach/programming`, `/coach/programming/:path*`.

### Coach — Library absorbs

`/coach/exercises`, `/coach/throws/library`, `/coach/throws/drills`, `/coach/plans` (list), `/coach/videos/drills`, `/coach/sessions` (legacy plans namespace).

### Coach — Builder absorbs

`/coach/throws/builder`, `/coach/plans/new`, `/coach/plans/generate`, `/coach/sessions/new`, `/coach/throws/program-builder`, `/coach/throws/programming`.

### Coach — Athletes absorbs

`/coach/teams` → `/coach/athletes/groups`, `/coach/event-groups` → `/coach/athletes/event-groups`, `/coach/goals` → `/coach/athletes/goals`, `/coach/competitions` (list) → `/coach/athletes/competitions`, `/coach/team` → `/coach/athletes/announcements`, `/coach/athlete-logs` → `/coach/athletes?tab=self-logs`, `/coach/throws/assessment/:athleteId` → `/coach/athletes/:athleteId/assessments`, `/coach/throws/roster` → `/coach/athletes/throws`, `/coach/invitations` → `/coach/athletes/invitations`, `/coach/throws/invite` → `/coach/athletes/invitations`.

### Coach — other cleanups

`/coach/throws` → `/coach/dashboard`, `/coach/hub` → `/coach/dashboard`, `/coach/wellness` → `/coach/dashboard?tab=readiness`, `/coach/tools` + `/coach/integrations` → `/coach/settings?tab=integrations`, `/coach/codex` → `/coach/dashboard`, `/coach/my-program` + `/coach/my-training` + `/coach/my-lifting` → `/athlete/dashboard`, `/coach/drill-videos` → `/coach/library?view=drills`.

### Coach — Video-analysis consolidation

`/coach/throws/analyze*` → `/coach/video-analysis*`, `/coach/videos*` → `/coach/video-analysis*` (with sub-paths preserved).

### Coach — Throws-Profile retirement

`/coach/throws/profile?athleteId=X` → `/coach/athletes/X`, `/coach/throws/profile` → `/coach/athletes`, `/coach/throws/profile/typing?athleteId=X` → `/coach/athletes/X/assessments`.

---

## Page files safely shadowed by redirects

These files exist in `src/app` but never render — `next.config.mjs` redirects fire before filesystem routing. They are safe to delete in a follow-up cleanup PR. Not deleted in this pass because some carry substantive UI we may want to preserve as reference; deletion is decoupled from the nav contract.

**Pure redirect stubs (safe to delete now):** `athlete/codex`, `coach/hub`, `coach/team`, `coach/teams`, `coach/competitions` (list only — detail page survives), `coach/athlete-logs`, `coach/log-session`, `coach/practices` (list only), `coach/availability`.

**Substantive code shadowed by config redirect (review before deletion):** `athlete/team`, `athlete/insights`, `athlete/tools`, `coach/schedule`, `coach/exercises`, `coach/plans` (list only), `coach/integrations`, `coach/tools`, `coach/videos`, `coach/wellness`.

**Keep (flag-gated, restored when flag flips on):** `coach/architect`, `coach/sideline`, `coach/video-analysis/*`, `coach/questionnaires/*`, `athlete/self-program/*`, `athlete/oura`, `athlete/whoop`, `athlete/questionnaires/*`, `athlete/throws/trends`, `coach/throws/practice`.

---

## Public / marketing / auth (out of scope for primary nav)

`/`, `/pricing`, `/privacy`, `/terms`, `/changelog` — marketing surface, always-dark per `CLAUDE.md`.
`/login`, `/register`, `/forgot-password`, `/reset-password`, `/login/mfa`, `/goodbye` — auth.
`/account-restore`, `/athletes/claim/[token]`, `/availability/[token]` — public token landings.
`/offline` — service-worker fallback.
`/(fullscreen)/athlete/quick-log` — focus-mode logging surface.
`/(squeeze)/deficit-finder` — marketing/squeeze conversion page.
`/internal/analytics-events` — internal/dev only.

---

## Acceptance check

| Criterion | Status |
|---|---|
| New coach can describe the product from the sidebar alone | ✅ Dashboard / Athletes / Calendar / Builder / Library / Video (pilot) / Settings |
| New athlete can describe the product from the bottom tabs alone | ✅ Home / Training / Log / Throws / Me |
| Athlete primary nav works on iPhone SE through 14/15 Pro | ✅ 5 fixed-width tabs, center primary, safe-area padded |
| Coach primary nav has usable mobile fallback | ✅ Slide-in sidebar via hamburger; sideline flag for true field use |
| No primary nav item points at a thin / duplicated / experimental surface | ✅ Each entry resolves to a substantive page or a redirect into one |
| No module in primary nav fails to serve the weekly coaching loop | ✅ Every nav item is plan / execute / log / review |
| Existing bookmarks for removed routes still redirect | ✅ Covered by `next.config.mjs` (50+ source patterns) |
| Sidebar regression guard (every href resolves) | ✅ `src/__tests__/nav/sidebar-resolution.test.ts` |
| Flag-gated routes are enforced at edge | ✅ `src/__tests__/nav/flag-gated-routes.test.ts` |

---

## How to add a new surface

1. **Does it serve the weekly coaching loop?** If no, it doesn't earn primary nav. Make it a deep-link.
2. **Is it pilot-only or post-MVP?** Add a flag in `src/lib/flags.ts`, register the prefix in `src/lib/flag-gated-routes.ts`, default `enabled: false`, and gate any sidebar entry on the resolved flag (see `coach/layout.tsx` for the pattern).
3. **Is it replacing an existing surface?** Add the 308 to `next.config.mjs`. Don't delete the old page until the redirect is shipped.
4. **Is it a new top-level tab?** It probably isn't. The sidebar has six slots and the bottom bar has five. Adding one is a strategic decision, not a cleanup.

The default answer to "should this be a new nav item?" is no.
