# UI/UX QA Checklist — Podium Throws

The repeatable gate that decides whether a UI change can ship. Run before every PR; the gate must be green before requesting review. CI runs the same scripts.

## The one command

```bash
npm run qa
```

This runs, in order: `tsc --noEmit`, the six design lints, and the full vitest suite. If it exits 0, the change has not regressed the type system, the design tokens, the rendering anti-patterns, or any unit/component test.

For the full pre-release loop (adds Playwright canonical-surface screenshots):

```bash
npm run qa:full
```

Requires a local Postgres at the URL documented in `CLAUDE.md §Dev Setup`. The Playwright project overrides `POSTGRES_*` env vars at the playwright.config.ts level so it cannot accidentally hit prod (see `feedback_e2e_tests_prod_db_incident.md`).

## What the gate enforces

### `npm run typecheck` — `tsc --noEmit`

Zero TypeScript errors across the project. The repo runs on `"strict": true` plus `"downlevelIteration": true` for Set/Map iteration.

### `npm run lint:design` — six ratcheting/hard-fail lints

| Script | Mode | What it checks | Baseline file |
|---|---|---|---|
| `lint:hex` | ratcheting | Hex literals in app surfaces — use tokens instead | `.hex-baseline.txt` |
| `lint:text` | ratcheting | Bracketed `text-[Npx]` — use `text-nano`/`text-micro`/`text-caption`/`text-body`/`text-section`/`text-title`/`text-display` | `.text-size-baseline.txt` |
| `lint:palette` | ratcheting | Raw Tailwind palettes (amber/emerald/red/gray/slate/etc.) in app surfaces — use `primary-*`/`status-*-fg`/`surface-*`/`text-muted` | `.palette-baseline.txt` |
| `lint:transition` | ratcheting | `transition-all` (paints every animatable property, causes jank) — list properties explicitly | `.transition-baseline.txt` |
| `lint:focus` | ratcheting | `focus:outline-none` without `focus-visible:` partner — kills keyboard focus rings | `.focus-baseline.txt` |
| `lint:slop` | **hard fail (no baseline)** | Generic SaaS phrases + `backdrop-blur` on content surfaces | n/a |

The five ratcheting lints accept the current state as the ceiling and refuse any new violations. To **ratchet a baseline DOWN** after cleanup:

```bash
# 1. Fix some violations.
# 2. Run the lint and read the new count off the failure line.
npm run lint:palette
# 3. Copy the new count into the baseline file and commit alongside the fix.
echo NEW_COUNT > .palette-baseline.txt
```

The hard-fail `lint:slop` enforces zero hits on the patterns nuked in the 2026-05-19 microcopy sweep (commit `ae5732e`): `"Loading..."`, `"Saving..."`, `Something went wrong`, `"Failed to <verb>"`, `"An unexpected error occurred"`, `showError("Error", …)`, and `backdrop-blur` on app-surface content panels (CLAUDE.md §Overlay surfaces forbids translucent content surfaces).

### `npm run test` — vitest

1008 tests across 105 files at time of writing. Includes:
- Nav-contract regression tests (`src/__tests__/nav/`) — flag-gated route guard + sidebar resolution
- Login focus tests (`src/app/(auth)/__tests__/login-focus.test.tsx`) — focus-first-error behavior
- API parse-body tests, insight templates, rate limits, parseNumeric, etc.

## Canonical screenshot surfaces — `npm run screenshots:canonical`

Captures `tasks/screenshots/pr1/`. Output is gitignored; only this checklist lives in the repo.

**Surfaces** (14 app + 2 marketing = 16):

App surfaces:
- Auth: `/login`, `/register` (no auth required)
- Athlete: `/athlete/dashboard`, `/athlete/sessions` (Training), `/athlete/log-session`, `/athlete/throws`, `/athlete/profile`, `/athlete/settings`
- Coach: `/coach/dashboard`, `/coach/athletes` (Roster), `/coach/calendar`, `/coach/library`, `/coach/builder`, `/coach/settings`

Marketing surfaces (always-dark, unauthenticated):
- `/`, `/pricing`

**Viewports** (4):
- `mobile-375-se` — 375×667 (iPhone SE — the tightest viewport the athlete app must work on)
- `mobile-390` — 390×844 (iPhone 14/15 Pro)
- `tablet-768` — 768×1024 (iPad portrait — coach sideline + occasional athlete use)
- `desktop-1440` — 1440×900

**Themes** (varies):
- App surfaces: `light` and `dark` (both must render — coach surfaces are not dark-only)
- Marketing surfaces: `dark` only (CLAUDE.md §Marketing Routes)

**Accessibility** — `@axe-core/playwright` runs against every (surface, theme) at the desktop-1440 capture, asserting **zero serious/critical violations** at WCAG 2.0 A/AA and WCAG 2.1 A/AA. Failures block the test. One scan per (surface, theme) instead of per viewport: a11y checks are content/markup issues, not layout sizing, so the same DOM at one viewport is sufficient.

Total: 14 app × 2 themes × 4 viewports + 2 marketing × 1 theme × 4 viewports = **120 PNGs**, plus **32 axe scans** (14 app × 2 themes + 2 marketing × 1 theme = 30, plus the 2 setup-storage-state tests = 32 total tests with a11y gate).

### Complementary screenshot specs

- `auth-onboarding-screenshots.spec.ts` — auth/onboarding/settings mobile screenshots at 375 + 390 widths (the trust + setup surfaces — includes athlete onboarding wizard + coach welcome screen which canonical doesn't)
- `data-surfaces-screenshots.spec.ts` — coach tables → mobile cards transitions at 390 + 1440 (the "one table" canonical fixture)
- `state-fixtures-screenshots.spec.ts` — 3 empty-state fixtures (wearable not-connected, achievements 0-earned, trends no-data-in-range) × themes × viewports = 18 PNGs (the "one empty state" canonical fixture)
- `mobile-keyboard-screenshots.spec.ts` — log-session, wellness, auth, settings at iOS keyboard-open viewports (375×409, 390×553) — verifies sticky CTAs clear the keyboard region (12 PNGs)
- `athlete-mobile-loop.spec.ts` — athlete daily-loop captures (UX audit 2)

Run any one project alone:

```bash
npx playwright test --project=canonical-screenshots
npx playwright test --project=auth-onboarding-screenshots
npx playwright test --project=data-surfaces-screenshots
npx playwright test --project=state-fixtures-screenshots
npx playwright test --project=mobile-keyboard-screenshots
npx playwright test --project=athlete-mobile-loop
```

## Visual review checklist (PR reviewer running through the screenshots)

Mobile shots (375 + 390) are release-blocking artifacts for any athlete flow. Coach mobile is the fallback shell, but still must be legible at 390.

For every PNG, confirm:

### Layout integrity

- [ ] No overlapping text
- [ ] No clipped buttons or labels (truncation OK; cutoff not OK)
- [ ] No unreadable foreground/background pairing — pass WCAG AA on text contrast
- [ ] No stacked overlay collisions (modal + tour + install prompt + toast)
- [ ] No horizontal page scroll on the 375 or 390 captures
- [ ] No desktop table squeezed into the athlete mobile shell (DataTable should have collapsed to a card list)

### Touch + focus

- [ ] Touch targets ≥ 44×44 px on mobile (CTAs, icon buttons, link affordances)
- [ ] Focus states visible (focus-visible ring, not the eternal default-outline that gets `:focus { outline: none }`'d)
- [ ] Sticky CTAs not hidden behind:
  - iOS keyboard (the log-session and auth forms must reserve space)
  - The athlete bottom tab bar (`AthleteShell` reserves padding-bottom)
  - Browser chrome on mobile Safari (use `100svh`, not `100vh`)
  - Safe-area inset (use `pb-safe` or `env(safe-area-inset-bottom)`)

### Coach vs athlete identity (CLAUDE.md §Dual Product Identity)

- [ ] Coach desktop reads as editorial / back-office — sidebar, breadcrumbs, ⌘K palette, neutral copy
- [ ] Athlete mobile reads as consumer-grade — bottom tabs, thumb-zone primary CTA, personal copy
- [ ] Coach is not in permanent dark mode — light theme must render cleanly too
- [ ] No athlete celebration theatrics leaking into coach surfaces

### Empty + error states (per the surfaces in the loop)

- [ ] Empty state has title + one useful sentence + one action
- [ ] Error toasts name the failed action ("Couldn't update practice"), bodies give a next step ("Try again in a moment.")
- [ ] Error boundary pages give a way back (Reload + Back to dashboard)

### Modal / sheet / table / overlay

- [ ] Modal content uses `bg-[var(--surface-overlay)]` — fully opaque in both themes
- [ ] No `backdrop-blur` on content; only on scrims (`lint:slop` enforces)
- [ ] Sheet `side` prop matches product intent (athlete: `bottom`, coach: `right`)
- [ ] DataTable shows card list on mobile, full table on desktop

## Loading state checklist

- [ ] Structural skeleton matches final layout (no spinning amber circle in place of a hero card)
- [ ] Loading text uses `…` (ellipsis character), not `...` (three periods) — enforced by `lint:slop`
- [ ] No blank server-rendered routes — `loading.tsx` exists for every high-traffic route

## Known drift (ratchet targets)

The branch shipped with two elevated baselines that should ratchet back down in follow-up PRs:

| Lint | Current baseline | Target | Path |
|---|---|---|---|
| `lint:palette` | 71 | 55 | Convert the 16 raw-palette violations in `_table.tsx` (status colors → `status-success-fg`/`status-warning-fg`/`status-danger-fg`), `_sideline-cards.tsx` (status colors), `Avatar.tsx` (consider domain-color allowlist), `_search-client.tsx`, `wearable-dashboard.tsx` (sleep-stage domain colors — propose allowlist), wellness sleep + summary steps. Drop the baseline back to 55 after the cleanup. |
| a11y serious+critical | sum: 56 violations across 30 (surface, theme) keys | 0 | First captured 2026-05-19. Mix is mostly `color-contrast` on text in dark mode + a handful of `aria-prohibited-attr` nodes. Fix per surface, drop that surface's count in `.a11y-baseline.json` in the same PR. New violations on any surface still fail canonical-screenshots; ratchet is per-key, not global. |

## CI integration

The same scripts run in CI (see `.github/workflows/` and `scripts/ship.sh`). A pre-push hook also runs the design lints — see `husky/` for the wired hooks.

## Future work

- **Safe-area inset screenshots** — `env(safe-area-inset-bottom)` can't be spoofed via viewport alone. Add a focused spec that injects a stylesheet forcing the safe-area to 34px (iPhone notch home-bar size) and captures the athlete bottom-tab routes + sticky-CTA screens.
- **Visual diff** — Playwright's `toMatchSnapshot()` could lock baseline PNGs and fail the build on pixel diffs above a threshold. Currently the screenshots are inspection-only.
- **Axe coverage expansion** — `state-fixtures-screenshots.spec.ts` and `auth-onboarding-screenshots.spec.ts` currently capture screenshots only; they should also run axe assertions on the rendered DOM. The canonical-screenshots spec covers the primary surfaces; these complementary specs should match.

## Do not

- Accept a visual pass without screenshots. The 120 PNGs from canonical-screenshots are the inspection record — plus 18 from state-fixtures, 12 from mobile-keyboard, and the existing auth-onboarding + data-surfaces + athlete-mobile-loop captures.
- Skip the mobile shots. Athlete is mobile-first; coach mobile is the sideline use case. Mobile shots block release for any athlete-flow change.
- Treat dark as the only product mode for coach surfaces — coach default leans light, athlete default is system.
- Update baselines up to hide drift. Document the ratchet path and fix the regression.
- Add `expect(blocking).toEqual([])` exceptions to the axe gate without recording the WCAG rule and the fix path in this checklist.
