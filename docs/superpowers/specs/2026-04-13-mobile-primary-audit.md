# Mobile-Primary Comprehensive Audit

**Date:** 2026-04-13
**Scope:** Full codebase audit for mobile-primary usage (iPhone 14 Pro / 390px, outdoor practice, one-handed, sweaty hands)
**Auditors:** 3 parallel agents covering Responsive/Touch, Accessibility, Theming/Anti-Patterns

---

## Anti-Patterns Verdict

**Pass.** This does NOT look AI-generated. The app has a strong, intentional design identity: dark OLED surfaces, amber/gold brand accent, Chakra Petch headings, IBM Plex Mono for data, purpose-built components (RPE slider, plate calculator, body map). No gradient text, no decorative glassmorphism, no cyan-on-dark palette, no bounce easing (except one misapplied instance on a readiness bar). The aesthetic is "coaching instrument panel" — purposeful, domain-specific, and memorable.

**One weak signal:** The dashboard's `QuickStatsWidget` uses three identical card layouts (big number + small label) which is the "hero metric template" pattern. Not egregious — these ARE stats — but differentiating them visually would elevate the design.

---

## Executive Summary

| Severity  | Count  | Categories                                                                     |
| --------- | ------ | ------------------------------------------------------------------------------ |
| Critical  | 6      | Touch targets, inputMode, keyboard access, focus indicators                    |
| High      | 15     | Touch targets, ARIA labels, form labels, theming                               |
| Medium    | 18     | Font sizes, scroll affordance, heading hierarchy, color-only info, token drift |
| Low       | 8      | Minor inconsistencies                                                          |
| **Total** | **47** |                                                                                |

### Top 5 Critical Issues

1. **26 numeric inputs missing `inputMode`** — iOS shows QWERTY keyboard instead of numeric pad on every distance/weight field during practice
2. **Throw count +/- buttons at 32px** — most-tapped buttons in the app are 12px below the 44px minimum
3. **`focus:outline-none` without replacement on live workout inputs** — keyboard/switch control users cannot see which field is focused
4. **Body map SVG has zero keyboard access** — soreness check-in is impossible for switch control users
5. **SlideToConfirm has no keyboard arrow key support** — session submission is unreachable without touch

### Overall Quality Score: 7/10

Strong design system, good component architecture, correct semantic HTML patterns. The gaps are concentrated in: (a) touch target sizes across interactive chips/buttons, (b) missing `inputMode` on raw `<input>` elements that bypass the `<Input>` component, (c) ARIA attributes on the live workout flow, and (d) ~38 instances of `text-gray-*` instead of design system surface tokens in session components.

---

## Detailed Findings

### Critical Issues (6)

#### C-1. 26 `type="number"` inputs missing `inputMode` — QWERTY on iOS

- **Location:** `throws/log/page.tsx:169,194`, `throws/readiness/page.tsx:435,495`, `log-session/_log-session-wizard.tsx:646,723`, `self-program/create/_steps/step-experience.tsx:37,86,111,137`, `profile/_tab-strength.tsx:164,201,254,277`, `profile/_tab-core.tsx:181,321,340`, `profile/_tab-competition.tsx:264,280,367`, `onboarding/_wizard.tsx:428,530,550`, `goals/_goals-client.tsx:216`, `dashboard/_widgets/weekly-goal.tsx:231`
- **WCAG:** N/A (usability)
- **Impact:** Every numeric field during practice shows full QWERTY keyboard. Athletes must manually switch to numeric pad every time.
- **Fix:** Replace raw `<input type="number">` with the existing `<Input>` component which auto-injects `inputMode`. Architectural fix prevents regression.

#### C-2. Throw count stepper buttons at 32×32px

- **Location:** `throws/log/page.tsx:237-249`
- **Impact:** Most-tapped buttons in the app. 12px below 44px minimum. Misses constantly with sweaty/gloved hands.
- **Fix:** Increase to `w-11 h-11` (44px) or add invisible 44px tap zone wrapper.

#### C-3. `focus:outline-none` on live workout distance input

- **Location:** `_throwing-block.tsx:347`, `_strength-block.tsx:187,211`, `_completion-view.tsx:313`
- **WCAG:** 2.4.7 Focus Visible
- **Impact:** Keyboard and switch control users cannot see which field is active in the live workout — the most critical data entry flow.
- **Fix:** Replace `focus:outline-none` with `focus:outline-none focus:ring-2 focus:ring-primary-500/60`.

#### C-4. Body map SVG has no keyboard access

- **Location:** `src/components/ui/InteractiveBodyMap.tsx`
- **WCAG:** 2.1.1 Keyboard
- **Impact:** The soreness body map (used in wellness check-in) responds only to pointer/touch. Switch control and keyboard users cannot mark soreness areas.
- **Fix:** Add `tabIndex`, `role="button"`, and `onKeyDown` to SVG regions. Add Front/Back toggle `aria-pressed`.

#### C-5. SlideToConfirm missing keyboard arrow key support

- **Location:** `src/components/ui/SlideToConfirm.tsx`
- **WCAG:** 2.1.1 Keyboard
- **Impact:** The "Slide to Submit Session" control is the ONLY way to submit a completed workout on mobile. No keyboard/switch path.
- **Fix:** Add `onKeyDown` handler for Arrow keys (increment/decrement) and Enter (confirm at 100%).

#### C-6. Feedback reaction buttons at 32×32px

- **Location:** `feedback/_feedback-list.tsx:263,277`
- **Impact:** Primary athlete-to-coach communication channel. Thumbs up/down at 32px with 16px icons.
- **Fix:** Increase to `min-h-[44px] min-w-[44px]`.

### High Issues (15)

#### H-1. Live workout inputs missing form label association

- **Location:** `_throwing-block.tsx:308-355`, `_strength-block.tsx:175-220`
- **WCAG:** 1.3.1, 4.1.2
- **Impact:** VoiceOver announces "number field" with no context. Labels exist visually but lack `htmlFor`/`id` binding.

#### H-2. RPE value buttons missing `aria-label` and `aria-pressed`

- **Location:** `_strength-block.tsx:236-253`
- **WCAG:** 4.1.2
- **Impact:** Screen reader hears only the number, no "RPE" context or selected state.

#### H-3. Quick-log weight picker missing `aria-expanded`, `aria-haspopup`

- **Location:** `_quick-log-client.tsx:867-875`
- **WCAG:** 4.1.2
- **Impact:** Screen reader cannot discover or navigate the weight picker.

#### H-4. Weight preset pills missing `aria-pressed`

- **Location:** `_quick-log-client.tsx:884-901`
- **WCAG:** 4.1.2
- **Impact:** Selected weight communicated only by color.

#### H-5. DataTable pagination buttons at 28×28px

- **Location:** `src/components/ui/DataTable.tsx:306`
- **Impact:** Smallest interactive element in the component library.

#### H-6. `text-[9px]` on wearable dashboard labels

- **Location:** `_wearable-dashboard.tsx:57,323`
- **Impact:** Below iOS Safari minimum rendered size. Illegible outdoors.

#### H-7. `text-[9px]` on readiness scale sublabels

- **Location:** `throws/readiness/page.tsx:483,506`
- **Impact:** Bondarchuk self-feeling scale labels unreadable — athletes may select wrong value.

#### H-8. History filter chips: hidden scrollbar + no gradient + 30px height

- **Location:** `throws/history/_history-filter-chips.tsx:46,87`
- **Impact:** Chips off-screen with zero scroll affordance. Chips too small to tap reliably.

#### H-9. Session completion "END" button has no focus ring

- **Location:** `_live-workout.tsx:484`
- **WCAG:** 2.4.7
- **Impact:** Irreversible action with no keyboard visibility.

#### H-10. Profile tab icons lose accessible name below 360px

- **Location:** `_profile-tabs.tsx:66-86`
- **WCAG:** 1.1.1, 4.1.2
- **Impact:** On iPhone SE (320px), all 6 profile tabs are icon-only with `aria-hidden="true"`. Screen readers get nothing.

#### H-11. Profile tabs missing `role="tablist"` / `role="tab"` / `aria-selected`

- **Location:** `_profile-tabs.tsx`
- **WCAG:** 4.1.2
- **Impact:** Screen reader users cannot identify the active tab.

#### H-12. 38 instances of `text-gray-*` instead of surface tokens in session components

- **Location:** `throw-block-card.tsx`, `strength-block-card.tsx`, `completion-bottom-sheet.tsx`, `completed-session-summary.tsx`, `warmup-checklist.tsx`
- **Impact:** `dark:bg-gray-800` is blue-tinted `#1f2937` vs design system `surface-800` `#101016`. Visible mismatch on OLED.

#### H-13. HeroSection CTA uses `#f59e0b` (amber-500) not `#FFC800` (brand gold)

- **Location:** `src/components/marketing/HeroSection.tsx:109,121,175`
- **Impact:** Landing page CTA button is a different shade of gold than the rest of the app.

#### H-14. Unit toggle buttons inverted — shrink on `sm:` breakpoint

- **Location:** `throws/log/page.tsx:180`, `log-session/_log-session-wizard.tsx:669`
- **Impact:** Gets SMALLER on larger phones in landscape. Inverted responsive pattern.

#### H-15. SlideToConfirm missing on non-`limitedMode` throw log save

- **Location:** `throws/log/page.tsx:699`
- **Impact:** High-stakes save action on touch device without confirm gesture.

### Medium Issues (18)

| #    | Issue                                                           | Location                                                                    | WCAG  |
| ---- | --------------------------------------------------------------- | --------------------------------------------------------------------------- | ----- |
| M-1  | `text-[10px]` on throws/log field labels (outdoor readability)  | `throws/log/page.tsx:164,190,208,232`                                       | —     |
| M-2  | Availability status chips at 30px height                        | `_availability-client.tsx:236`                                              | —     |
| M-3  | Training hub action chips at 30px height                        | `_training-hub.tsx:49`                                                      | —     |
| M-4  | Toggle switches at 24px height (h-6)                            | `_availability-client.tsx:1105`, `_notification-preferences-client.tsx:160` | —     |
| M-5  | m/ft unit toggle at 20px height                                 | `_log-session-wizard.tsx:710-719`                                           | —     |
| M-6  | overflow-x-auto tables with no gradient (session detail)        | `sessions/[id]/page.tsx:79,146,284`                                         | —     |
| M-7  | Readiness factor bars missing `role="progressbar"`              | `readiness-hero.tsx:161-165`                                                | 4.1.2 |
| M-8  | Week strip color-only session type dots                         | `_week-strip.tsx:47-54`                                                     | 1.4.1 |
| M-9  | Workout calendar `aria-label` on `<span>` without `role="img"`  | `workout-calendar.tsx:128-141`                                              | 4.1.2 |
| M-10 | `<h2>` inside `<button>` in RecentCompletions                   | `_training-hub.tsx:115`                                                     | 1.3.1 |
| M-11 | Profile page has no `<h1>`                                      | `profile/page.tsx`                                                          | 2.4.6 |
| M-12 | Spring easing on readiness bar fill (overshoots container)      | `readiness-hero.tsx:192`                                                    | —     |
| M-13 | 5 off-brand cyan usages (`text-cyan-500`)                       | QuickActions, wellness, session pages                                       | —     |
| M-14 | Sidebar hardcoded `dark:bg-[#0c0c10]` vs surface token          | `Sidebar.tsx:212`                                                           | —     |
| M-15 | Coach profile page: 4 hardcoded hex swatches in calendar legend | `coach/throws/profile/page.tsx:1247-1250`                                   | —     |
| M-16 | Completion bottom sheet uses `bg-gray-*` not surface tokens     | `completion-bottom-sheet.tsx:61,90,52`                                      | —     |
| M-17 | Notification bell button at 32×32px                             | `NotificationBell.tsx:30`                                                   | —     |
| M-18 | Throws/log drill type `<select>` suppresses focus outline       | `throws/log/page.tsx:139`                                                   | 2.4.7 |

### Low Issues (8)

| #   | Issue                                                                           | Location                      |
| --- | ------------------------------------------------------------------------------- | ----------------------------- |
| L-1 | PR filter chip `★` announced as "star" by VoiceOver                             | `_history-filter-chips.tsx`   |
| L-2 | Event badges abbreviations (SP/DT/HT/JT) small + color-only                     | `_history-day-card.tsx:53-63` |
| L-3 | `xs` Avatar uses 9px initials text                                              | `Avatar.tsx:16`               |
| L-4 | Feedback "Reply" link at 11px with no padding                                   | `_feedback-list.tsx:214`      |
| L-5 | ReadinessHero widget has no heading element                                     | `readiness-hero.tsx`          |
| L-6 | Feeling group buttons not wrapped in `<fieldset>/<legend>`                      | `_quick-log-client.tsx:299`   |
| L-7 | Dashboard `QuickStatsWidget` uses identical card template ×3                    | `quick-stats.tsx:7,14,21`     |
| L-8 | 12 dashboard widgets use manual `hover:shadow-md` instead of `card-interactive` | Multiple widget files         |

---

## Patterns & Systemic Issues

1. **Raw `<input type="number">` bypassing the `<Input>` component** — the existing `<Input>` component auto-injects `inputMode`. 26 inputs bypass it. Fix: replace all raw numeric inputs with `<Input>`.

2. **`focus:outline-none` without ring replacement** — concentrated in the live workout flow (5 instances). These are the highest-traffic inputs in the app.

3. **`text-gray-*` token drift in session components** — 38 instances across 5 files. These components predate the design token system and were never migrated. `dark:bg-gray-800` (#1f2937) is visibly different from `surface-800` (#101016) on OLED.

4. **Touch targets below 44px on interactive chips/pills** — at least 10 distinct chip/button patterns across the app render at 28-32px height. A shared `chip` utility class with `min-h-[44px]` would fix all of them.

5. **`sm:` breakpoint making elements SMALLER** — two unit toggle buttons use `sm:py-1 sm:text-[10px]` which shrinks the target on tablets and landscape phones.

---

## Positive Findings

1. **Semantic HTML is excellent** — no clickable `<div>` or `<span onClick>` violations found anywhere. All interactive elements are proper `<button>` or `<a>` elements.

2. **`<Input>` component auto-handles `inputMode`** — the fix for 26 raw inputs is architectural, not per-element.

3. **Icons consistently use `aria-hidden="true"`** — Lucide icons are correctly hidden from screen readers throughout.

4. **`prefers-reduced-motion` consistently respected** — all animation components check and skip motion for accessibility.

5. **Design system is cohesive** — amber/gold brand, OLED dark surfaces, correct font family assignments (Chakra Petch headings, DM Sans body, IBM Plex Mono data).

6. **No gradient text, no decorative glassmorphism, no bounce easing** — the app passes the "AI slop test" cleanly.

7. **SlideToConfirm has correct ARIA slider semantics** — just needs keyboard handlers added.

8. **RPESlider component has full ARIA** — `aria-valuetext`, proper role, keyboard support. Should be the reference for other slider-like components.

---

## Recommendations by Priority

### Immediate (Critical blockers)

1. Replace 26 raw `<input type="number">` with `<Input>` component (fixes inputMode globally)
2. Add `focus:ring-2 focus:ring-primary-500/60` to all `focus:outline-none` inputs in live workout
3. Increase throw count stepper to 44px minimum
4. Add keyboard arrow key support to `SlideToConfirm`

### Short-term (This sprint)

5. Add `htmlFor`/`id` binding to all form labels in live workout and throws/log
6. Add `aria-label`/`aria-pressed` to RPE buttons, weight picker, filter chips
7. Add `role="tablist"`/`role="tab"`/`aria-selected` to profile tab bar
8. Replace all `text-gray-*` with surface tokens in session components (38 instances)
9. Fix HeroSection CTA color: `#f59e0b` → `#FFC800`
10. Add scroll affordance gradient to history filter chips

### Medium-term (Next sprint)

11. Create shared `chip` utility class with `min-h-[44px]` for all interactive pills
12. Fix inverted `sm:` breakpoint on unit toggles
13. Add keyboard access to InteractiveBodyMap
14. Remove 5 off-brand cyan color usages
15. Add `role="progressbar"` to readiness factor bars
16. Add `role="img"` to workout calendar dot indicators

### Long-term (Nice to haves)

17. Replace hardcoded hex values in coach profile calendar legend
18. Differentiate QuickStatsWidget card designs
19. Migrate `hover:shadow-md` to `card-interactive` on dashboard widgets
20. Add `<fieldset>/<legend>` to feeling button groups
