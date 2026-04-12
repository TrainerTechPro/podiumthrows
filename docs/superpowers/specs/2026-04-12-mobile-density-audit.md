# Athlete-Side Mobile Information Density Audit

**Date:** 2026-04-12
**Scope:** All 38 athlete-side pages audited for mobile density, progressive disclosure, and touch target compliance on a 390px viewport (iPhone 14 Pro)
**Trigger:** Production readiness review (2026-04-10) flagged "data is jumbled up on mobile"

---

## Executive Summary

19 pages audited in depth. 3 pages are excellent (History, Videos, Settings). 9 pages are good with minor fixes. 4 pages need significant work (Goals, Achievements, Wellness, Log Session Wizard drills step). 4 systemic issues cut across the entire athlete experience.

---

## Systemic Issues (apply across all pages)

### S1. Touch targets below 44px (HIGH)

Recurring offenders across 8+ pages:
- Unit toggle buttons (kg/lbs, m/ft): ~28-32px tall
- Implement weight filter chips: ~28px tall
- Date range `<select>` elements: ~28px tall
- Goals meta-row buttons (Abandon, Edit deadline): ~24px tall
- DayPill availability buttons: 40px (close but not 44px)

**Fix:** Create a shared `min-h-[44px]` convention. Apply to all interactive chips, toggles, and small buttons.

### S2. `ScrollProgressBar` inconsistently applied (LOW)

Present on: Throws Hub, History, Availability, Self-Program Hub
Missing from: Dashboard, Wellness, Goals, Achievements

CLAUDE.md rule: "Any page with significant scroll depth" should have it.

**Fix:** Add `<ScrollProgressBar />` to Dashboard, Wellness, Goals, Achievements.

### S3. `font-mono` inconsistently applied to numeric values (LOW)

Correct: History drill rows, Trends charts
Missing: Goals progress values, Wellness check-in scores, Achievements earned count

**Fix:** Audit all `tabular-nums` usages — any numeric data value needs both `font-mono tabular-nums`.

### S4. `window.confirm()` used instead of `ConfirmDialog` (MEDIUM)

Found in: Availability (`_availability-client.tsx:531`), Codex (`_codex-client.tsx:246`)

**Fix:** Replace both with `ConfirmDialog` component.

---

## Page-by-Page Findings

### Priority 1: Quick Wins (< 30 min each)

| # | Page | Issue | Fix | Impact |
|---|------|-------|-----|--------|
| Q1 | Dashboard | Missing `ScrollProgressBar` | Add as first child in wrapper div | Low effort, consistency |
| Q2 | Goals | No `inputMode="decimal"` on progress input | Add `inputMode="decimal"` to line 220 of `_goals-client.tsx` | iOS shows numeric keypad |
| Q3 | Goals | Touch targets below 44px on Abandon/Edit buttons | Add `min-h-[44px] min-w-[44px]` or increase padding to `px-3 py-2` | Accessibility |
| Q4 | Wellness | Inline SVG instead of Lucide `<Info>` | Replace lines 497-511 with `<Info size={10} strokeWidth={2.5} />` | Design system compliance |
| Q5 | Wellness | `space-y-8` → `space-y-6` on outer wrapper | Single class change at line 646 | Consistency |
| Q6 | History | Summary line too dim | Change `text-xs text-muted` to `text-sm text-[var(--foreground)] font-medium` with `font-mono` on numbers | Readability |
| Q7 | Sessions | `RecentCompletions` hides count | Show "Recent Sessions (N)" in the section header | Discoverability |
| Q8 | Achievements | Always show progress fraction | Remove `earnedCount > 0` condition, always show `{earned} / {total}` | Motivation |
| Q9 | Achievements | No `StaggeredList` animation | Wrap badge grid in `<StaggeredList>` | Polish |
| Q10 | Videos | Play affordance invisible on touch | Add static semi-transparent play icon on thumbnails (not hover-only) | Tap discoverability |
| Q11 | Videos | `text-[10px]` metadata below readable minimum | Change to `text-xs` (12px) | Readability |
| Q12 | Throws Log | Missing `SlideToConfirm` on final save | Add `SlideToConfirm` on mobile, standard button on desktop | Design system compliance |
| Q13 | Throws Log | Button loses background if `eventMeta` is undefined | Add fallback: `eventMeta?.color ?? 'var(--primary-500)'` | Edge case safety |
| Q14 | Trends | Date range select too small | Add `min-h-[44px]` to `<select>` | Touch target |
| Q15 | Trends | Weight toggle chips too small | Change to `py-2` minimum | Touch target |
| Q16 | Settings | Events display uses `join(", ")` — clips with truncate | Change to `flex flex-wrap gap-1` with badge chips | Readability |

### Priority 2: Medium Effort (1-2 hours each)

| # | Page | Issue | Fix | Impact |
|---|------|-------|-----|--------|
| M1 | Goals | Active/Completed/Abandoned as flat scroll | Replace 3 sections with `<Tabs>` component: "Active (N) / Completed (N) / Abandoned (N)" | Reduces page length ~75% |
| M2 | Wellness | TodayResultCard is 8-card wall | Split into `<Tabs>`: "Today" (score + factors), "Trend" (7-day chart + insights), "Vitals" (device biometrics) | Major density reduction |
| M3 | Wellness | History dumps all 14 entries | Show 3 entries by default, "Show all N" expand button | Scroll depth reduction |
| M4 | Achievements | No category-level collapse | Wrap each category in collapsible: show header with "Consistency — 3/5", default open if earned, closed if none | Progressive disclosure |
| M5 | Achievements | Badge descriptions illegible at 2-col | Change to `grid-cols-1 sm:grid-cols-2` or remove description from collapsed state | Readability |
| M6 | History | Filter chips not sticky | Add `sticky top-[60px] z-10 bg-[var(--background)]` to filter chip wrapper | Usability |
| M7 | History | No event grouping in expanded drill rows | Group drill rows by event with colored dot separator | Visual hierarchy |
| M8 | Sessions | QuickActions pills need scroll fade | Add `after:` right-edge gradient on overflow container | Scroll affordance |
| M9 | Codex | 3 rows of controls before first entry | Collapse to: search (60% width) + filter icon button → bottom sheet | Space efficiency |
| M10 | Trends | No "Jump to event" on long page | Add sticky anchor pills at top: Shot Put / Discus / Hammer / Javelin | Navigation |
| M11 | Self-Program | Phase timeline has no scroll affordance | Add right-edge gradient fade on `overflow-x-auto` container | Discoverability |

### Priority 3: Larger Redesigns (half day+)

| # | Page | Issue | Fix | Impact |
|---|------|-------|-----|--------|
| R1 | Log Session Wizard | Drills step is densest screen in app — 7 input rows per drill with no collapse | Collapse each drill to 1-line summary, expand on tap to edit | Major UX improvement |
| R2 | Log Session Wizard | Feedback step dumps 7 inputs on one screen | Split: RPE+feeling on screen 1, text fields behind "Add notes (optional)" expander | Progressive disclosure |
| R3 | Log Session Wizard | RPE 10-button row overflows at 390px (414px needed) | Use `flex flex-wrap` or split into 2 rows of 5 | Layout fix |
| R4 | Availability | Inline form expansion is jarring on mobile | Move block add/edit to bottom sheet on mobile | Better mobile pattern |
| R5 | Self-Program Create | Step indicator overflows at 10 steps | Replace with "Step 3 of 10" + thin progress bar | Layout fix |
| R6 | Self-Program Hub | 6 stacked full-width cards with no compression | Compress 3 StatCards into a single 3-col mini-stat row | Density |

---

## Reference: What "Good" Looks Like

The **Throws History** page is the gold standard:
- Collapsed day cards show date + event chips + throw count + best mark in ~80px
- ChevronRight rotation affordance for expand/collapse
- Infinite scroll with IntersectionObserver
- Filter chips for quick narrowing
- Skeleton loading states

The **Videos** page is the simplest good page:
- Single-column card grid on mobile
- Proper `aspect-video` thumbnails
- Truncated titles with date metadata
- No unnecessary controls

---

## Implementation Order

**Sprint 1 — Quick Wins (Q1-Q16):** Can be done in a single session. Mostly single-line or few-line changes. Ship as one commit.

**Sprint 2 — Medium Effort (M1-M11):** Group by page. Goals (M1), Wellness (M2+M3), Achievements (M4+M5), History (M6+M7) are the highest-impact medium fixes.

**Sprint 3 — Redesigns (R1-R6):** Log Session Wizard drills step (R1-R3) is the single biggest mobile UX improvement. Self-Program (R5-R6) and Availability (R4) are lower priority.
