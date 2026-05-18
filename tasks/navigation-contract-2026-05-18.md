# Navigation Contract — 2026-05-18

The product is two surfaces sharing a database: an **athlete app** that ships through a thumb on a phone, and a **coach desktop** that runs a roster. Everything else is plumbing.

Navigation is the product contract. If a surface doesn't earn primary nav, it doesn't earn a daily build of the user's attention. If a primary nav item lands on something thin or experimental, it lies about the product.

This document is the canonical answer to "what is Podium Throws today?" measured in clicks from the home tab and from the sidebar.

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

Every primary nav item must serve a step in this loop. Surfaces that don't move that loop forward are deep-links, flag-gated modules, or gone.

---

## Athlete contract — five bottom tabs, no sidebar

Mobile is the design source of truth. The desktop athlete view is the same bottom-tab shell at a wider container — a roomy fallback, not an alternate product. There is no athlete sidebar.

The bar lives in `src/components/layout/BottomTabBar.tsx`.

| Tab | Route | What lives here | Why it earns primary nav |
|---|---|---|---|
| **Home** | `/athlete/dashboard` | Today's state, next action, readiness check-in, streak, week-at-a-glance | The opening screen has to answer "what now?" in under a second. Readiness ladders up here because it gates the next training decision, not because it's a profile setting. |
| **Training** | `/athlete/sessions` | Assigned sessions + upcoming plan + self-program (if flag-gated on) | The athlete's relationship with the coach is the assigned session. This is its home. |
| **Log** | `/athlete/log-session` | New session capture (single-screen form, not a wizard) | The reason the product exists. Elevated as the primary action — center button, amber. |
| **Throws** | `/athlete/throws` | PRs, trends, history, competitions, readiness detail, quiz | The throws-specific identity layer — the part that justifies a throws-only app over generic strength-coaching software. |
| **Me** | `/athlete/profile` | Profile, settings, notifications | The setup-and-forget shelf. Wellness check-in is **not** here — it moved to Home. |

### Tab matchPath behavior (highlighting)

| Visited route | Highlighted tab |
|---|---|
| `/athlete/dashboard` | Home |
| `/athlete/wellness` | **Home** (moved 2026-05-18 from Me) |
| `/athlete/sessions`, `/athlete/self-program/*` | Training |
| `/athlete/log-session`, `/athlete/quick-start` | Log |
| `/athlete/throws/*` (`history`, `trends`, `readiness`, `quiz`, `session`, `live`) | Throws |
| `/athlete/achievements`, `/athlete/competitions/*` | Throws |
| `/athlete/profile`, `/athlete/settings/*`, `/athlete/notifications` | Me |
| `/athlete/availability`, `/athlete/integrations` | **no tab** (deep-link only) |

Deep-link surfaces with no tab highlight are honest — the athlete got there from a coach calendar share or a wearable banner, not from a tab. Don't pretend it's a profile setting.

---

## Coach contract — six sidebar items, plus conditional Video

The coach sidebar lives in `src/components/ui/Sidebar.tsx` (`getCoachNavSections`). The coach layout resolves feature flags server-side and passes the resulting sections to `DashboardLayout`.

| Item | Route | What lives here | Why it earns primary nav |
|---|---|---|---|
| **Dashboard** | `/coach/dashboard` | Today's roster pulse: readiness, compliance, attention list, recent sessions | The 30-second answer to "is anything on fire this morning?" Wellness is a tab here (`?tab=readiness`), not its own destination. |
| **Athletes** | `/coach/athletes` | Roster, plus six children: Throws, Invitations, Groups, Event Groups, Goals, Announcements. Roster header pills cover Tier-1: Self-Logs, Competitions. | The roster is the asset. Tier-2 admin surfaces live under it as siblings, not scattered under a generic "Manage." |
| **Calendar** | `/coach/calendar` | Schedule, per-athlete view, compliance, live practice mode | Coaches plan in weeks. One calendar absorbs four old top-levels. |
| **Builder** | `/coach/builder` | Session, plan (manual + generate), drill — `?type=` switches | Composing training is the act, not a category. One builder, switchable. |
| **Library** | `/coach/library` | Exercises, throws sessions, drills, plans, drill videos — `?view=` switches | Stored assets — separate from authoring. One library, switchable. |
| **Video** *(conditional)* | `/coach/video-analysis` | Video upload, analysis, live pose detection — appears only when `videoAnalysis` flag is on for the coach's tier | Pilot-tier feature. Hidden from the sidebar when the route would redirect, so a click never lies. |
| **Settings** | `/coach/settings` | Profile, security, notifications, autoregulation, integrations, tools (calculators) — tabs in URL | Setup shelf — bottom of sidebar, away from daily work. |

### Mobile fallback

The coach sidebar slides in/out via hamburger on phone-class viewports. The full nav is available — there is no separate "coach mobile" IA. For sideline triage on a phone-class UA, the optional `/coach/sideline` route (flag-gated) lives behind `coachSideline`. The MobileSidelineFAB only renders when the flag is on.

---

## Hidden / flag-gated modules

These routes exist in the codebase but never appear in primary nav. They live behind `src/lib/flags.ts` + middleware `FLAG_GATED_ROUTES`. When the flag is off, the middleware redirects to the role dashboard before the page renders.

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

A flag-gated route that defaults `enabled: true` is essentially production-on. The defaults above are MVP-shipping defaults — Edge Config overrides them per-environment.

---

## Deep-link-only surfaces (resolve, not in primary nav)

These surfaces have a real page.tsx that serves substantive UI. They are reached from contextual entry points (coach calendar share, wearable banner, search result, athlete detail breadcrumb) — never from primary nav.

### Athlete deep-links

- `/athlete/achievements` — PR collection (Throws tab matchPath)
- `/athlete/assessments` — Bondarchuk assessment results
- `/athlete/availability` — coach scheduling deep-link (no tab highlight)
- `/athlete/competitions`, `/athlete/competitions/[id]` — competition list + detail (Throws matchPath)
- `/athlete/drill-videos` — coach-assigned drill review
- `/athlete/feedback` — pilot feedback survey
- `/athlete/goals` — athlete goals page
- `/athlete/integrations` — wearable connect hub (no tab highlight; hidden until connected)
- `/athlete/notifications` — top-bar bell destination
- `/athlete/onboarding` — first-run wizard (focus mode)
- `/athlete/profile` — backed by Me tab
- `/athlete/quick-start` — smart-routing "Start Session" (Log matchPath)
- `/athlete/session/[id]` — single training session view
- `/athlete/settings`, `/athlete/settings/fix-throw-history` — settings shell
- `/athlete/throws/[id]` — single throws assignment
- `/athlete/throws/history`, `/athlete/throws/log`, `/athlete/throws/quiz`, `/athlete/throws/readiness` — sub-surfaces under Throws tab
- `/athlete/videos/[id]` — drill video viewer
- `/athlete/wellness` — readiness check-in (Home tab matchPath)

### Coach deep-links

- `/coach/athletes/[id]/*` — athlete detail (Overview, Training, Throws, Performance, Readiness, Wellness, Goals, Assessments, Sessions, Fix-throws, Profile/edit)
- `/coach/athletes/print` — print roster
- `/coach/calendar/print` — print weekly calendar
- `/coach/competitions/[id]` — competition detail (list redirected)
- `/coach/feedback-inbox` — top-bar inbox destination
- `/coach/notifications` — top-bar bell destination
- `/coach/onboarding/welcome` — first-run welcome
- `/coach/plans/[planId]`, `/coach/plans/[planId]/print` — plan detail + print
- `/coach/practices/[id]` — practice detail (list redirected)
- `/coach/search` — command-palette results page
- `/coach/session/[id]` — training-session detail
- `/coach/settings/*` — settings shell + tabs
- `/coach/throws/[id]`, `/coach/throws/[id]/print` — throws session detail + print

---

## Redirect map

All redirects live in `next.config.mjs`. Permanence reflects intent: `308` = real IA migration, do not downgrade; `307` = cleanup of in-tree stubs that might still shift in a follow-up consolidation pass.

### Athlete (4 redirects, all `307`)

| Source | Destination | Purpose |
|---|---|---|
| `/athlete/insights` | `/athlete/dashboard` | MVP cut |
| `/athlete/codex` | `/athlete/dashboard` | MVP cut |
| `/athlete/tools` | `/athlete/settings` | MVP cut |
| `/athlete/team` | `/athlete/dashboard` | MVP cut |
| `/athlete/settings/notifications` | `/athlete/settings?tab=notifications` | Settings consolidation |
| `/athlete/hub` | `/athlete/dashboard` | Stub consolidation |

`308` (permanent IA migrations): `/athlete/throws/analysis` → `/athlete/throws/trends`, `/athlete/throws/profile` → `/athlete/throws/readiness`, `/athlete/review-profile` → `/athlete/onboarding?from=invite`, plus the canonical session/throws URL flattening (sessions list → session detail, etc.).

### Coach (broad list — see `next.config.mjs:62`)

Calendar absorbs: `/coach/schedule`, `/coach/practices`, `/coach/availability`, `/coach/throws/practice`.
Library absorbs: `/coach/exercises`, `/coach/throws/library`, `/coach/throws/drills`, `/coach/plans`, `/coach/videos/drills`.
Builder absorbs: `/coach/throws/builder`, `/coach/plans/new`, `/coach/plans/generate`.
Athletes absorbs: `/coach/teams` (→ groups), `/coach/event-groups`, `/coach/goals`, `/coach/competitions`, `/coach/team` (→ announcements), `/coach/athlete-logs`.
Other consolidations: `/coach/hub` → dashboard, `/coach/log-session` → calendar, `/coach/wellness` → `dashboard?tab=readiness`, `/coach/tools` + `/coach/integrations` → `settings?tab=integrations`, `/coach/throws` → dashboard, `/coach/throws/analyze*` → `video-analysis*`, `/coach/videos*` → `video-analysis*`, `/coach/throws/profile*` → roster scope.

---

## Page files safely shadowed by redirects (deletion candidates)

The following page files exist in the tree but never render — `next.config.mjs` redirects fire before filesystem routing. They are safe to delete in a follow-up cleanup PR. Not deleted in this pass because some carry substantive UI we may want to preserve as reference, and deletion is decoupled from the nav contract itself.

**Pure redirect stubs (safe to delete now):** `athlete/codex`, `coach/hub`, `coach/team`, `coach/teams`, `coach/competitions` (list only — detail page survives), `coach/athlete-logs`, `coach/log-session`, `coach/practices` (list only), `coach/availability`.

**Substantive code, shadowed by config redirect (review before deletion):** `athlete/team`, `athlete/insights`, `athlete/tools`, `coach/schedule` (332 lines), `coach/exercises`, `coach/plans` (list only), `coach/integrations`, `coach/tools`, `coach/videos`, `coach/wellness`.

**Keep (flag-gated, restored when flag flips on):** `coach/architect`, `coach/sideline`, `coach/video-analysis/*`, `coach/questionnaires/*`, `athlete/self-program/*`, `athlete/oura`, `athlete/whoop`, `athlete/questionnaires/*`, `athlete/throws/trends`, `coach/throws/practice`.

---

## Public / marketing / auth (out of scope for primary nav)

`/`, `/pricing`, `/privacy`, `/terms`, `/changelog` — marketing surface, always-dark per CLAUDE.md.
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
| New coach can describe the product from the sidebar alone | ✅ — 6 named items, no jargon |
| New athlete can describe the product from the bottom tabs alone | ✅ — Home / Training / Log / Throws / Me |
| Athlete primary nav works on iPhone SE through 14/15 Pro | ✅ — 5 fixed-width tabs, center primary, safe-area padded |
| Coach primary nav has usable mobile fallback | ✅ — slide-in sidebar via hamburger; sideline flag for true field use |
| No primary nav item points at thin/duplicated/experimental surface | ✅ — each sidebar/tab entry resolves to a substantive page or a redirect into one |
| No module in primary nav fails to serve the weekly coaching loop | ✅ — every nav item is plan / execute / log / review |
| Existing bookmarks for removed routes still redirect | ✅ — covered by `next.config.mjs` (140+ source patterns) |

---

## What changed in this pass (2026-05-18)

- `src/components/layout/BottomTabBar.tsx`: `/athlete/wellness` moved from **Me** matchPaths to **Home** matchPaths; `/athlete/integrations` removed from **Me** matchPaths (deep-link only).
- `src/components/ui/Sidebar.tsx`: deleted unused `ATHLETE_NAV_SECTIONS` (athlete shell never rendered it); replaced `COACH_NAV_SECTIONS` with `getCoachNavSections({ videoAnalysisEnabled })` builder that conditionally inserts the **Video** entry.
- `src/app/(dashboard)/coach/layout.tsx`: resolves `videoAnalysis` flag server-side alongside `coachSideline`; passes computed `navSections` to `DashboardLayout`.
- `src/__tests__/nav/sidebar-resolution.test.ts`: dropped athlete sidebar assertion; coach assertion now runs against both flag variants.
- `tasks/navigation-contract-2026-05-18.md`: this document.

No new features. No new UI dependencies. No routes added.
