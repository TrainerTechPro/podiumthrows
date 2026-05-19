# Athlete Route Ownership — 2026-05-18

The athlete app is a single mobile daily loop: **open → understand today → check readiness → log training → see progress → leave.** Every route below earns its place inside that loop or it gets demoted to deep-link.

This is the canonical answer to "which route owns *what* part of the athlete's mental model?" so primary surfaces stop overlapping.

## Daily loop

```
Home (Dashboard)
   ↓ what should I do now?
[Readiness / Today's session / Recap / Rest / PR follow-up]
   ↓ commit to the action
Training (open today) ──or── Log (new session)
   ↓ ritual
Session detail / Log form
   ↓ aftermath
PR celebration · streak · recap on Home
   ↓ scan progress
Throws (analytics: PRs, trends, history, comps)
   ↓ done
Leave.
```

Each tab is one thumb-reach from the previous. Nothing on the loop opens a settings menu.

## Canonical ownership

| Route | Tab | Owns | Notes |
|---|---|---|---|
| `/athlete/dashboard` | **Home** | "What now?" state-aware hero. Today's session, readiness ring, streak, last PR, week strip, recent moments. | Primary surface. The hero card's primary CTA sits in the lower half of the iPhone SE viewport. |
| `/athlete/sessions` | **Training** | Today's session at the top with a status-aware page header (Due Today / In progress / Rest day / Between blocks / Getting started). Week strip + recent completions below. | As of 2026-05-18 the generic "Training" h1 was replaced with a status-aware header so the page answers "what's the state of my training?" before scanning. |
| `/athlete/log-session` | **Log** | The single primary new-log entry. Center bottom-tab button only. | No competing CTAs anywhere else on athlete primary surfaces. As of 2026-05-18 the "Log Session" pill in Training's SecondaryActions was removed; the bottom tab is the sole entry. |
| `/athlete/quick-start` | Log (matchPath) | Smart routing for "Start Session" — picks the right destination (in-progress / self-program / coach-assigned / ad-hoc). | Reached only from QuickActions / FAB / programmatic redirects. Not a primary destination. |
| `/athlete/throws` | **Throws** | Analytics hub: readiness widget, PR tracker, this-week volume, throws volume. **Not** a second home — the comment in `throws/page.tsx:11-13` already enforces "today's session and Quick Log live on the dashboard and bottom tab respectively — never duplicated here." | The page header is `Throws — Trends, PRs, and volume across your throws.` and the chips route to history / trends / readiness / log (edit). |
| `/athlete/throws/history` | Throws (sub) | Session history list. | Reached from Throws hub chip + the dashboard's `Recent · All trends` trail. |
| `/athlete/throws/trends` | Throws (sub) | Volume / distance / RPE trends. Flag-gated (`throwsAnalysis`). | Tab-bar Throws also highlights here. |
| `/athlete/throws/readiness` | Throws (sub) | Readiness deep-dive. | Highlights Throws tab when visited from a Throws-hub deep-link. |
| `/athlete/wellness` | **Home** (matchPath) | Readiness check-in form. Reached from Home readiness ring, from Training's `Check-in` secondary action, and from low-readiness banner. | **Not** under Me. The 2026-05-18 nav contract moved `/athlete/wellness` from Me's matchPaths to Home's — readiness is a daily-state question, not a profile setting. |
| `/athlete/profile` | **Me** | Athlete profile + master profile builder. | One of three Me destinations. |
| `/athlete/settings` | **Me** | Account, notifications, integrations (tabs in URL), unit prefs, security. | Discrete sub-pages (settings/notifications, settings/fix-throw-history) for deep-linkable settings rows. |
| `/athlete/integrations` | (deep-link) | Wearable connect hub. Reached from coach calendar share, wearable banner, or settings tab. Never tab-highlighted. | Removed from Me matchPaths 2026-05-18 — appears only when an integration is connected or pilot-enabled. |
| `/athlete/availability` | (deep-link) | Coach-scheduling deep-link. | Removed from Me matchPaths in the 2026-05-18 nav contract — reached only from coach calendar share. No tab highlight. |

## Top bar contract

The athlete top bar (`DashboardLayout.tsx` `AthleteTopBar`) holds, in order: logo · spacer · notifications bell · user menu (theme toggle, settings, log out).

- Height: `min-h-[3rem]` (48px). Logo `30px`. As of 2026-05-18 the bar was reduced from 56px/34px-logo to reclaim viewport.
- Below the bar: `<OfflineIndicator />` renders only when offline. It appears in flow under the chrome, not stacked over content.
- There is no install prompt overlay on athlete surfaces.

## Haptics — only meaningful actions

Haptic feedback fires at:

- **Log tap** — bottom-tab Log button calls `haptic.medium()` (`BottomTabBar.tsx:118`).
- **Slide-to-confirm** — `haptic.medium()` for confirm, `haptic.heavy()` for destructive (`SlideToConfirm.tsx:81–82`).
- **Toast error** — `haptic.error()` on athlete shell only (Toast.tsx:109).
- **PR celebration** — routed through the celebration toast variant, which inherits the celebration sound + visual stack.

Other interactions are silent on purpose.

## What changed 2026-05-18

- `src/app/(dashboard)/athlete/sessions/page.tsx`: generic `Training / Here's what's on deck / Great work this week / Welcome to Podium Throws` h1+sub replaced with a five-state status-aware header (`Due today` / `In progress` / `Between blocks` / `Getting started` / `Rest day`).
- `src/app/(dashboard)/athlete/sessions/_training-hub.tsx`: `QuickActions` renamed `SecondaryActions`; the `Log Session` pill that competed with the bottom-tab Log button was removed. `Check-in` remains, conditional on whether readiness was logged today.
- `src/components/layout/DashboardLayout.tsx`: `AthleteTopBar` chrome reduced from `min-h-[3.5rem]` + 34px logo to `min-h-[3rem]` + 30px logo, reclaiming ~8px of viewport on every athlete page.
- `tasks/athlete-route-ownership-2026-05-18.md`: this document.

## What deliberately did NOT change

- **Dashboard hero** (`_athlete-home-client.tsx`). The hero is already state-aware: `PRESCRIBED` / `IN_PROGRESS` / `LOGGED` / `RestDay` / `MasterProfile-nudge`. Primary CTA already sits in the lower half of the iPhone SE viewport. Streak, last PR, week strip already shipped. Touching the hero would risk regression of a thing that works.
- **Throws hub**. The comment in `throws/page.tsx:11-13` already names the rule: today and Quick Log never duplicate here. The four widgets (readiness, PR tracker, this-week, volume) are analytics, not action surfaces. No "today's workout" duplication to remove.
- **Haptic wiring**. All four named surfaces (Log tap, session complete via celebration, PR via celebration, slide-to-confirm) are already wired.
- **Me cleanup**. The 2026-05-18 navigation contract already moved wellness/availability/integrations out of Me's matchPaths (see `tasks/navigation-contract-2026-05-18.md`).

## What can't be verified from this session

- **Playwright mobile screenshots** at iPhone SE 375×667, iPhone 14/15 Pro 390×844, landscape, keyboard-open. Background sessions cannot start `npm run dev` without inheriting prod `.env.local` (test/e2e-prod-safety-20260421 incident memo). The `next build` from the prior pass succeeded; static verification is the strongest evidence available.
- **Manual smoke with seeded athlete**. Requires local DB + dev server. Same constraint.

Pre-merge: run the screenshots locally (`npm run screenshots:canonical` or Playwright suite) and visually confirm the daily loop on both device sizes.
