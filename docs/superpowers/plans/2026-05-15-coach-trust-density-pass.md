# Coach Trust and Density Pass — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Each PR ships independently via feat/\* branch + auto-merge per `feedback_use_feat_branch_workflow.md`.

**Goal:** Make coach MVP surfaces feel trustworthy and faster than spreadsheets — quiet, tabular, throws-specific. Strip athlete-app celebration leakage from coach surfaces, wire stats to drill-through detail, repair search→detail routing, and replace generic empty states with coach-job copy.

**Architecture:** Five small, themed PRs against `main` via auto-merge. Each PR is self-contained and revertable. PR1 is the highest-leverage trust fix (one file, fixes broken ⌘K routing); ship it first.

**Tech Stack:** Next.js 14.2 App Router, React 18.3, TypeScript, Tailwind, custom UI primitives in `src/components/ui/`.

---

## Source audits (read-only, performed 2026-05-15)

- **Audit A** — `/coach/dashboard`, `/coach/athletes`, `/coach/athletes/[id]`
- **Audit B** — `/coach/calendar`, `/coach/builder`, `/coach/library`, `/coach/settings`
- **Audit C** — ⌘K command palette + `/coach/search`

Findings are inlined into each task below — no need to cross-reference.

---

## PR 1 — Fix ⌘K href bug (sessions/plans/drills → detail, not list)

**Why first:** Coach hits ⌘K, types "Hammer Friday", sees the session, presses Enter → lands on `/coach/sessions` (an index). The exact "search lands me where I started" trust hit. One-file fix; ships immediately.

**Files:**

- Modify: `src/app/api/search/route.ts` — entity result hrefs only.

### Task 1.1 — Repoint session/plan/drill hrefs to canonical detail

- [ ] **Step 1: Read current state**

```bash
sed -n '240,290p' src/app/api/search/route.ts
```

Expect to see three href constructions: sessions (`/coach/sessions`), plans (`/coach/plans`), drills (`/coach/drills`).

- [ ] **Step 2: Edit hrefs in place**

Mirror the choices already made in `src/app/api/search/content/route.ts` (the content endpoint uses the right URLs):

- Session row → `/coach/throws/${s.id}` (content route `:294`)
- Plan row → `/coach/plans/${p.id}` (content route `:347`)
- Drill row → `/coach/throws/drills?focus=${d.id}` (content route `:324`)

- [ ] **Step 3: Verify locally**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expect: 0 errors in `api/search/route.ts`.

- [ ] **Step 4: Commit + ship**

```bash
git checkout -b feat/coach-search-href-detail
git add src/app/api/search/route.ts
git commit -m "fix(coach/search): route session/plan/drill hits to detail pages, not list"
git push -u origin feat/coach-search-href-detail
gh pr create --title "fix(coach/search): route session/plan/drill hits to detail pages" --body "..."
gh pr merge --auto --squash
```

---

## PR 2 — Athlete detail trust pass

**Why:** The single worst trust offender. 8× `AnimatedNumber` instances, the `DecisionHero` is athlete-app-style tile theatre, 🔥 streak emojis, and 12+ stats with no drill-through.

**Files:**

- Modify: `src/app/(dashboard)/coach/athletes/[id]/page.tsx`
- Optionally extract: `src/app/(dashboard)/coach/athletes/[id]/_decision-meta-bar.tsx` (new)

### Task 2.1 — Strip every `AnimatedNumber` from athlete detail

Per CLAUDE.md (and the dashboard's own header comment): "AnimatedNumber on every stat (count-up theatrics erode trust)." Replace with `tabular-nums` static numbers.

**Locations (8 sites):**

- `:210` readiness (DecisionHero)
- `:221` ACWR (DecisionHero)
- `:308` attendance.rate
- `:323` attendance.currentStreak
- `:339` 4× breakdown cards (Present/Late/Absent/Excused)
- `:386` ACWRGauge ratio
- `:901` per-event best (ThrowsTab)
- `:1416` wellness summary card

- [ ] **Step 1: Locate the imports**

```bash
grep -n "AnimatedNumber" src/app/\(dashboard\)/coach/athletes/\[id\]/page.tsx
```

- [ ] **Step 2: Replace each `<AnimatedNumber value={n} />` with the literal number wrapped in `<span className="tabular-nums">{n}</span>`**

Mechanical: keep formatting (decimals, units) identical. If `<AnimatedNumber value={x.toFixed(1)} />`, write `<span className="tabular-nums">{x.toFixed(1)}</span>`.

- [ ] **Step 3: Remove the import** `AnimatedNumber` once no callsites remain.

- [ ] **Step 4: Verify**

```bash
grep -n "AnimatedNumber" src/app/\(dashboard\)/coach/athletes/\[id\]/page.tsx
# expect: no matches
npx tsc --noEmit 2>&1 | grep "athletes/\[id\]" | head
# expect: clean
```

### Task 2.2 — Demote DecisionHero to a tabular meta-bar

Current `page.tsx:198-253` renders a rounded `bg-surface-50` panel containing 3 large stat tiles. That's athlete-app pattern. Replace with the dashboard's MetaBar register: one-line `name · type · readiness 7.2 · ACWR 1.18 (Optimal) · Healthy`, each stat clickable (drill-through).

- [ ] **Step 1: Read the current DecisionHero block (:198-253) to capture every data point** (readiness, ACWR, injury, athlete name, event type).

- [ ] **Step 2: Replace with a flex-row meta bar** — `flex flex-wrap items-baseline gap-x-6 gap-y-1 text-caption text-muted border-b border-[var(--card-border)] pb-3 mb-4`, with each metric as a `<button>` or `<Link>` that scrolls to the matching detail section on the page (`#readiness`, `#load`, `#injury`).

- [ ] **Step 3: Wire scroll-to-section drill-through.** Use `<Link href="#readiness">` (Next.js handles smooth scroll via `scrollIntoView` from the section ids; check that ReadinessSection has `id="readiness"` — add if missing).

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit 2>&1 | grep "athletes/\[id\]"
```

### Task 2.3 — Drop 🔥 emoji from coach-surface streak badges

Cite: `page.tsx:144-146`, `:315-326`, and `src/app/(dashboard)/coach/athletes/_table.tsx:156`.

Per CLAUDE.md Dual Product table: coach copy is "neutral". Emojis are athlete-register.

- [ ] **Step 1: Replace `🔥 {n}d streak` with `<span className="tabular-nums">{n}</span>d streak`** in all three locations.

- [ ] **Step 2: Verify**

```bash
grep -rn "🔥" src/app/\(dashboard\)/coach/athletes/
# expect: no matches
```

### Task 2.4 — Make AttendanceSection breakdown cards drill-through

`page.tsx:307-348` renders 4 unactionable stat cards (Present / Late / Absent / Excused). Each should link to a filtered attendance view.

If the attendance detail route doesn't exist, settle for an in-page hash anchor (`#attendance-log`) and ensure the rendered roll-call rows below match the filter. Otherwise link to `/coach/athletes/{id}/attendance?status=absent`.

- [ ] **Step 1: Check whether `/coach/athletes/[id]/attendance` exists.** If not, set hash anchor and ensure `<section id="attendance-log">` wraps the records list.

- [ ] **Step 2: Wrap each card in `<Link>`** with the corresponding filter param/hash.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean.

### Task 2.5 — Wire per-event throw tiles to filtered throw history

ThrowsTab `page.tsx:898-908` renders "Best · N throws" per event. Clicking the event name should scroll to / filter the throw table below.

- [ ] **Step 1: Add `onClick`/`<Link href="#throws-table?event=hammer">`** with state managed in the existing throws filter.

### Task 2.6 — Commit + ship PR 2

- [ ] Commit per task, then push branch `feat/coach-athlete-detail-trust-pass`, open PR, auto-merge.

---

## PR 3 — Dashboard density pass

**Why:** One `AnimatedNumber` survivor on analytics, "Performance Lab" zone header duplicates the real `<SectionHeader title="Analytics">` rendered right above it, 7 MetaBar stats lack drill-through.

**Files:**

- Modify: `src/app/(dashboard)/coach/dashboard/page.tsx` (MetaBar drill-through)
- Modify: `src/app/(dashboard)/coach/dashboard/_analytics-section.tsx` (kill zone header + AnimatedNumber + StaggeredList)

### Task 3.1 — Kill the "Performance Lab" zone header

`_analytics-section.tsx:47-62` renders `═══ ZONE 4: PERFORMANCE LAB ═══` style decoration. The page already has `<SectionHeader title="Analytics" …>` at `page.tsx:899` (rendered immediately above) — net effect: two competing titles.

- [ ] **Step 1: Delete the glow-divider + zone header block** in `_analytics-section.tsx:47-62`.

- [ ] **Step 2: Remove the `<StaggeredList>` wrapper at `:62, :162`** — render cards as a plain `grid grid-cols-1 md:grid-cols-3 gap-4` (per CLAUDE.md motion budget for coach: "Restrained (state changes only)" — page-load stagger of static analytics cards is decorative).

- [ ] **Step 3: Strip the surviving `<AnimatedNumber>` at `:79`** — replace with `tabular-nums` static.

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean.

### Task 3.2 — Wire MetaBar stats to drill-through

`dashboard/page.tsx:451-575` MetaBar exposes 7 stats. Wire each to a relevant filtered view:

| Stat              | File:line | Target                                                                                                                  |
| ----------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `totalAthletes`   | `:482`    | `/coach/athletes`                                                                                                       |
| `sessionsToday`   | `:492`    | `/coach/calendar?date=today` (existing query param if present, else `/coach/calendar`)                                  |
| `complianceRate`  | `:514`    | `/coach/athletes?filter=low-compliance` (add to roster filter if not present; if not, accept `/coach/athletes` for now) |
| `throwsThisWeek`  | `:526`    | `/coach/throws?range=7d`                                                                                                |
| `attendance.rate` | `:548`    | `/coach/athletes?filter=absent-week` (or `/coach/athletes` if no roster filter exists)                                  |
| `prsThisWeek`     | `:560`    | `/coach/throws?range=7d&prs=true`                                                                                       |
| `lowReadiness`    | `:569`    | `/coach/athletes?filter=low-readiness`                                                                                  |

If a deep-link query param doesn't exist on the destination, link to the destination root for now — partial drill-through still beats none. **Don't** add new server params in this PR; that's scope creep.

- [ ] **Step 1: Wrap each MetaBar stat** in `<Link href={…} className="…hover:text-foreground transition-colors">`.

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean.

- [ ] **Step 3: Commit + push** — `feat/coach-dashboard-density-pass`, auto-merge.

---

## PR 4 — Coach-job empty-state copy pass

**Why:** 8 generic "No data / No X yet" copies leak SaaS-default tone into surfaces that should know what coach job is unfinished.

**Pure copy changes, one PR.**

### Task 4.1 — Replace empty-state copy at these 8 sites

- [ ] `src/app/(dashboard)/coach/calendar/_by-event-view.tsx:60-62`
  - From: "No event groups yet — Create event groups (Shot Put, Discus, Hammer, Javelin) to slice your week by event."
  - To: **"No event groups yet — split your roster by event so you can program shot put without discus noise in the way."**

- [ ] `src/app/(dashboard)/coach/calendar/_live-sessions-view.tsx:186-190`
  - From: "No practice sessions yet…"
  - To: **"No live practice running — start one to log attempts in real time as athletes throw."**

- [ ] `src/app/(dashboard)/coach/calendar/print/page.tsx:183`
  - From: "No sessions programmed for this week."
  - To: **"No sessions programmed this week — schedule one in the calendar before printing."**

- [ ] `src/app/(dashboard)/coach/library/_drills-tab.tsx:125-128`
  - From: "No drill videos yet"
  - To: **"No drill videos yet — attach demo footage to a drill in the Drills tab and it'll surface here."**

- [ ] `src/app/(dashboard)/coach/library/_drill-grid.tsx:101-106` (or wherever it currently lives in `src/components/` after recent refactor)
  - From: "No drills match your filters. Try adjusting or add a custom drill."
  - To: **"No drills match — clear filters or add a drill in the Builder."**

- [ ] `src/app/(dashboard)/coach/exercises/_exercises-table.tsx:394-399`
  - From emptyTitle: "No exercises found" / emptyDescription: "Add custom exercises to get started."
  - To: **"No exercises in your library — add one or import the catalog."**

- [ ] `src/components/coach/library/SessionsLibraryView.tsx:276-281`
  - From: "No sessions created yet."
  - To: **"No throws sessions saved — build one in the Session tab."**

- [ ] `src/app/(dashboard)/coach/settings/autoregulation/page.tsx:402`
  - From: "No athletes on active programs."
  - To: **"No athletes on active programs — autoreg overrides activate once you assign someone a program."**

### Task 4.2 — Drop the "Browse →" softeners in library All tab section descriptions

`src/app/(dashboard)/coach/library/_all-tab.tsx:73-104` uses "Browse Plans →"/"Browse Exercises →" — soft SaaS verb. Replace with "Open" (or kill entirely if we kill the All tab brochure in PR 5).

- [ ] **Step 1:** Replace "Browse" with "Open" (or defer to PR 5 — pick one).

### Task 4.3 — Commit + ship PR 4

- [ ] `feat/coach-empty-states-copy`, auto-merge.

---

## PR 5 — Settings + library cleanup

**Why:** Settings has 15+ inline SVGs (CLAUDE.md violation), 35-checkmark pricing-style features list, hand-rolled assign-session modal, and a library "All" tab that's a marketing brochure duplicating the tabs above it.

**This is the biggest PR. Split if it gets unwieldy.**

### Task 5.1 — Replace hand-rolled "Assign Session" modal with `<Modal>` primitive

`src/components/coach/library/SessionsLibraryView.tsx:351-446` rolls its own backdrop + panel. Today it happens to use `bg-[var(--surface-overlay)]` correctly, but a future edit could fork `bg-black/50` into the panel (CLAUDE.md overlay rule).

- [ ] **Step 1: Read `src/components/ui/Modal.tsx`** to learn the contract (open/onClose/title/children).

- [ ] **Step 2: Replace the manual backdrop+panel** with `<Modal open={…} onClose={…} title="Assign session to athlete">{body}</Modal>`.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean, modal still opens/closes from existing trigger.

### Task 5.2 — Kill library "All" tab brochure cards

`src/app/(dashboard)/coach/library/_all-tab.tsx:168-201` renders 4 marketing-style category pick-cards duplicating the tabs nav directly above. Coach desktop wants ⌘K, not a brochure.

- [ ] **Step 1: Replace the 4-card grid** with full-bleed cross-surface search results. The search input at `:109-124` already searches across surfaces — make the search content the "All" tab body.

- [ ] **Step 2: When query is empty**, render a quiet "Search across sessions, plans, exercises, and drills, or open a tab above" hint (1 sentence, no decorative icon halo).

### Task 5.3 — Purge inline SVGs from `settings/page.tsx`, replace with Lucide

CLAUDE.md: "Lucide React only. No inline SVGs."

Locations (sample, full sweep): `:593-611` profile camera, `:695-702` saved checkmark, `:886-1069` 35 plan-features checkmarks, `:1156-1170` invitations empty SVG, `:1235-1247` activity empty SVG.

- [ ] **Step 1:** `grep -n "<svg" src/app/\(dashboard\)/coach/settings/page.tsx | head -30` — enumerate.
- [ ] **Step 2:** Replace each with a Lucide equivalent (`Camera`, `Check`, `Mail`, `Activity`, etc.), `strokeWidth={1.75}`, `aria-hidden="true"` if decorative.
- [ ] **Step 3:** Verify — `grep -c "<svg" src/app/\(dashboard\)/coach/settings/page.tsx` returns 0 (or only `<svg>` from imported Lucide — but Lucide outputs as components, not raw `<svg`, so this should be zero).

### Task 5.4 — Convert the 35-checkmark plan features list to a terse comparison

`settings/page.tsx:881-1069` is pricing-page-style theatre on a back-office surface. Coach research register: list features in a `<dl>` or simple `<ul>` with one terminal check icon constant — no per-row check repeated 35×.

- [ ] **Step 1:** Replace inline `<svg>` per-row with one `<Check className="h-4 w-4 text-status-success-fg" aria-hidden />` constant; or better, a single column with bullet text.

### Task 5.5 — Lift `max-w-2xl` cap on Team + Security tabs; convert Invitations + Activity to tables

`settings/page.tsx:535` caps the entire settings surface to `max-w-2xl` (672px). Forms benefit; the Invitations list (`:1180-1218`) and Activity log (`:1255-1290`) are stacked rows in a narrow column on a wide coach desktop — sparse waste.

- [ ] **Step 1:** Scope the `max-w-2xl` to the form sections only; let Team and Security tabs render `max-w-5xl` or full-width.
- [ ] **Step 2:** Replace Invitations stacked rows with a `<DataTable>` (cols: Email | Event | Classification | Status | Sent | Action).
- [ ] **Step 3:** Replace Activity log stacked rows with a `<DataTable>` (cols: Time | Action | Actor | IP, or whatever columns the data exposes).
- [ ] **Step 4:** Ensure mobile collapses to cards (DataTable already supports this via `hideOnMobile` per its existing usage in `_plans-list.tsx`).

### Task 5.6 — Rename "By Athlete" calendar tab to "Roster"

`src/app/(dashboard)/coach/calendar/_calendar-tabs.tsx:86`. Trivial label tweak.

- [ ] **Step 1:** Edit label.

### Task 5.7 — Commit + ship PR 5

- [ ] `feat/coach-settings-library-cleanup`, auto-merge.

---

## Out-of-scope (note + defer)

- **Mount ⌘K palette in `AthleteShell`** — athlete-app product decision, not coach trust.
- **Add Athletes/PRs/Exercises to `/coach/search`** page — palette already covers them; the `/coach/search` page is content-only by current design.
- **Dashboard center-of-gravity gaps** (`what changed` digest, `what is scheduled` widget) — meaningful product work; would be its own plan.
- **Live Sessions tab dense-table view** — defer; current card list is acceptable until coaches run many concurrent sessions.
- **Drill videos list-view toggle** — defer; current 3-col grid is right at typical drill library size.

---

## Verification (Task 6 — Verify)

After all PRs merge to main:

```bash
git checkout main && git pull
npm run typecheck
npm run lint
npm run test:e2e -- e2e/coach-dashboard.spec.ts e2e/coach-roster-detail.spec.ts e2e/coach-sideline.spec.ts
```

Expect: all green. If any spec fails, the fix is in the corresponding PR or a small follow-up.

---

## Acceptance map

| Goal acceptance criterion                                                                       | Met by                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coach dashboard answers: who needs attention / what changed / what is scheduled / what happened | PR 3 makes MetaBar clickable (partial — `what changed`/`what scheduled` widgets are deferred)                                                                                   |
| Athlete detail answers: current state / trend / next action                                     | PR 2 demotes DecisionHero to scannable meta-bar with drill-through; current state + trend already present, next action is `CoachActionBar` (deferred for richer recommendation) |
| Builder/Calendar/Library labels match coach language                                            | PR 4 + PR 5 (Roster rename)                                                                                                                                                     |
| No coach core surface feels like a marketing page                                               | PR 5 (kill brochure cards, 35-checkmark theatre, inline SVGs) + PR 3 (kill Performance Lab zone header)                                                                         |
