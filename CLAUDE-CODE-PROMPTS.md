# Podium Throws — One-Shot Feature Prompts

Copy-paste these prompts into a fresh Claude Code session to implement each feature. They're ordered by dependency (1 before 2, rest are independent).

---

## Feature 1: Exercise Correlation Display

```
Read the spec at docs/superpowers/specs/2026-03-26-exercise-correlation-display-design.md and implement it fully.

Context: This is Podium Throws — a Next.js 14.2 / React 18.3 / TypeScript coaching SaaS. Read CLAUDE.md for all project rules and design system conventions. The app uses a dark OLED cyberpunk theme with amber/gold accent (#FFC800), chamfered clip-path corners, Outfit headings, DM Sans body, Lucide icons (strokeWidth 1.75).

The backend already exists:
- Exercise model has correlationData Json? field
- src/lib/throws/correlations.ts has getRankedExercises()
- Coach exercises page is at src/app/(dashboard)/coach/exercises/

Your job: Surface correlation coefficients (r values) in the exercise library UI. Each exercise shows its r value color-coded (green >= 0.75, amber >= 0.60, blue < 0.60) with classification badges (CE/SDE/SPE/GPE). Use the existing cyberpunk visual language — chamfered cards, classification-colored accents, glowing values for high correlations.

After implementation:
1. Run npx tsc --noEmit — must be 0 errors
2. Run npm run lint — must be 0 errors
3. Grep for any hardcoded hex colors that should use theme tokens
4. Verify the exercise library page still renders all existing functionality
5. Double-check: read back every file you modified and confirm the changes are correct
6. Triple-check: run tsc again after your final edit to catch any regressions
7. Commit with a descriptive message
8. DO NOT tell me you're done until steps 1-7 all pass. If any step fails, fix it and re-run ALL checks.
9. Tell me exactly what changed, what files were modified, and what to test manually
```

---

## Feature 2: Session Builder Validation Panel

```
Read the spec at docs/superpowers/specs/2026-03-26-session-builder-validation-design.md and implement it fully.

Context: This is Podium Throws — a Next.js 14.2 / React 18.3 / TypeScript coaching SaaS. Read CLAUDE.md for all project rules, especially the "Domain Rule — CRITICAL (Bondarchuk Methodology)" section. The app uses a dark OLED cyberpunk theme with amber/gold accent (#FFC800), chamfered clip-path corners, Outfit headings, DM Sans body, Lucide icons (strokeWidth 1.75).

The backend already exists:
- src/lib/throws/validation.ts has validateSession() and autoFixSequence()
- The session builder is at src/app/(dashboard)/coach/sessions/new/

Your job: Add a persistent validation panel to the session builder that shows all Bondarchuk domain rules with live [OK]/[WN]/[XX] status. The 7 rules: descending weight sequence, CE priority, correlation threshold (15-20%), volume balance, GPE presence, no consecutive throwing blocks, strength between throws.

Use chamfered cards with status-colored borders. [OK] = green #00FF88, [WN] = amber #FF8800, [XX] = red #FF2222. Each rule shows the rule name, status badge, and which blocks are affected. Panel updates live as blocks are added/removed/reordered.

After implementation:
1. Run npx tsc --noEmit — must be 0 errors
2. Run npm run lint — must be 0 errors
3. Read the validation.ts file to confirm your panel calls the right functions with the right arguments
4. Verify the builder still creates and saves sessions correctly (don't break the submit flow)
5. Double-check: read back every file you modified and confirm the changes are correct
6. Triple-check: run tsc again after your final edit to catch any regressions
7. Commit with a descriptive message
8. DO NOT tell me you're done until steps 1-7 all pass. If any step fails, fix it and re-run ALL checks.
9. Tell me exactly what changed, what files were modified, and what to test manually
```

---

## Feature 3: Coach Team Readiness Dashboard

```
Read the spec at docs/superpowers/specs/2026-03-26-coach-team-readiness-design.md and implement it fully.

Context: This is Podium Throws — a Next.js 14.2 / React 18.3 / TypeScript coaching SaaS. Read CLAUDE.md for all project rules and design system conventions. The app uses a dark OLED cyberpunk theme with amber/gold accent (#FFC800), chamfered clip-path corners, Outfit headings, DM Sans body, Lucide icons (strokeWidth 1.75).

The backend already exists:
- ReadinessCheckIn model with 15+ fields (sleep, soreness, stress, energy, hydration, wearable data)
- /api/readiness/team endpoint returns latest check-in per athlete
- /api/readiness/[athleteId] returns 30-day history
- Coach wellness page at src/app/(dashboard)/coach/wellness/page.tsx is currently a stub

Your job: Replace the "Coming Soon" stub with a full team readiness dashboard. Include:
- Hero stat: team average readiness score with AnimatedNumber
- Per-athlete readiness bars sorted by score (low readiness = red, flagged if below 5.0)
- 7-day trend sparklines per athlete (pure SVG, no chart library)
- Category breakdown: sleep, soreness, stress, energy averages across team
- Event group filter tabs
- Threshold alerts section for athletes below 5.0

Use the cyberpunk aesthetic throughout — chamfered stat cards, classification-colored accents, glowing low-readiness alerts, amber progress bars.

After implementation:
1. Run npx tsc --noEmit — must be 0 errors
2. Run npm run lint — must be 0 errors
3. Verify the page loads without crashing when there are 0 athletes, 1 athlete, and many athletes (handle empty states)
4. Verify the SVG sparklines don't break with missing data points
5. Double-check: read back every file you modified and confirm the changes are correct
6. Triple-check: run tsc again after your final edit to catch any regressions
7. Check all touch targets >= 44px, page works at 375px width
8. Commit with a descriptive message
9. DO NOT tell me you're done until steps 1-8 all pass. If any step fails, fix it and re-run ALL checks.
10. Tell me exactly what changed, what files were modified, and what to test manually
```

---

## Feature 4: Coach Analytics Dashboard

```
Read the spec at docs/superpowers/specs/2026-03-26-coach-analytics-dashboard-design.md and implement it fully.

Context: This is Podium Throws — a Next.js 14.2 / React 18.3 / TypeScript coaching SaaS. Read CLAUDE.md for all project rules and design system conventions. The app uses a dark OLED cyberpunk theme with amber/gold accent (#FFC800), chamfered clip-path corners, Outfit headings, DM Sans body, Lucide icons (strokeWidth 1.75).

The coach dashboard is at src/app/(dashboard)/coach/dashboard/page.tsx. It already fetches athlete data in parallel.

Your job: Add an analytics section to the coach dashboard with:
- 3 hero stat cards: Team Avg Distance Delta (% improvement), Compliance Rate (sessions completed / assigned), Average Readiness
- Weekly volume bar chart: 7 bars (one per day of current week) showing total throws. Pure CSS/HTML — no chart libraries. Bars use amber accent, hover shows exact count.
- Season gains leaderboard: top 5 athletes by distance improvement, with rank number, name, event badge, and delta (green, e.g., "+2.3m")

All stats use AnimatedNumber for count-up. Cards use chamfered clip-path corners. The analytics section lives below the existing dashboard widgets in a new "Performance Lab" section.

Create data fetching functions in src/lib/data/ that compute these metrics from ThrowsAssignment, ThrowsBlockLog, and ReadinessCheckIn data. Add them to the existing Promise.all parallel fetch in the dashboard page.

After implementation:
1. Run npx tsc --noEmit — must be 0 errors
2. Run npm run lint — must be 0 errors
3. Verify the dashboard still loads all existing widgets (don't break anything)
4. Verify empty states — a coach with no athletes or no sessions should see zeros, not crashes
5. Verify the bar chart renders correctly with partial week data
6. Double-check: read back every file you modified and confirm the changes are correct
7. Triple-check: run tsc again after your final edit to catch any regressions
8. Verify the dashboard page load time hasn't degraded significantly (analytics queries should be in the existing parallel fetch)
9. Commit with a descriptive message
10. DO NOT tell me you're done until steps 1-9 all pass. If any step fails, fix it and re-run ALL checks.
11. Tell me exactly what changed, what files were modified, and what to test manually
```

---

## Feature 5: Visual Phase Timeline

```
Read the spec at docs/superpowers/specs/2026-03-26-visual-phase-timeline-design.md and implement it fully.

Context: This is Podium Throws — a Next.js 14.2 / React 18.3 / TypeScript coaching SaaS. Read CLAUDE.md for all project rules and design system conventions. The app uses a dark OLED cyberpunk theme with amber/gold accent (#FFC800), chamfered clip-path corners, Outfit headings, DM Sans body, Lucide icons (strokeWidth 1.75).

The self-program detail page is at src/app/(dashboard)/athlete/self-program/[id]/_program-detail.tsx. It currently uses a tab-per-phase layout with a session list under each tab.

Your job: Replace the tab-per-phase layout with a horizontal visual timeline:
- Each phase is a proportionally-sized colored segment (Accumulation=blue #4488FF, Transmutation=amber #FFC800, Realization=green #00FF88, Competition=red #FF4444)
- Diamond checkpoints at each week position along the timeline
- Done weeks: filled diamond with phase color
- Current week: glowing diamond with pulse animation
- Future weeks: outlined diamond, muted
- Click a diamond to expand that week's sessions below the timeline (using the existing SessionCard component)
- On mobile (< 640px): switch to vertical layout with diamonds on the left edge

Use the cyberpunk aesthetic — chamfered phase segments, glowing current indicator, phase-colored accents. The timeline replaces the tab system but the session cards below stay the same.

Preserve: phase content details (volume distribution, classification percentages), session cards with their status badges, and the "Generate Next Phase" CTA.

After implementation:
1. Run npx tsc --noEmit — must be 0 errors
2. Run npm run lint — must be 0 errors
3. Verify the timeline renders correctly with 1 phase and with 4 phases
4. Verify clicking a diamond expands the correct week's sessions
5. Verify mobile layout at 375px width switches to vertical
6. Verify the "Generate Next Phase" CTA still works
7. Double-check: read back every file you modified and confirm the changes are correct
8. Triple-check: run tsc again after your final edit to catch any regressions
9. Commit with a descriptive message
10. DO NOT tell me you're done until steps 1-9 all pass. If any step fails, fix it and re-run ALL checks.
11. Tell me exactly what changed, what files were modified, and what to test manually
```

---

## Usage

1. Open a fresh Claude Code session in the Podium Throws directory
2. Copy-paste one prompt
3. Let it run — it will read the spec, implement, verify, and commit
4. Review the output, test manually, push when satisfied
5. Move to the next feature

**Recommended order:** 1 → 2 → 3 → 4 → 5
(Features 3, 4, 5 are independent and can run in any order after 1+2)
