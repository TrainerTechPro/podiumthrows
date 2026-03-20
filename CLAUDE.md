# CLAUDE.md — Podium Throws

## Project Context

This is **Podium Throws**, a subscription coaching SaaS for Olympic-level track & field throws coaches. Built on Next.js 14.2 (App Router) + React 18.3 + TypeScript, PostgreSQL via Prisma, deployed on Vercel.

**Target users:** Division I and professional throws coaches managing rosters of athletes across shot put, discus, hammer, and javelin. Coaches pay $100+/month. Every screen must feel like it was built specifically for elite coaching.

**Competitors we must outperform:** BridgeAthletic, TrainHeroic, TeamBuildr, CoachMePlus.

### Tech Stack (Do NOT Change)
- Next.js 14.2 App Router + React 18.3 + TypeScript
- PostgreSQL via Prisma ORM (Vercel Postgres)
- Custom JWT auth (HttpOnly cookies, 7-day expiry, bcrypt)
- Stripe (free/pro/elite: 3/25/unlimited athletes)
- Cloudflare R2 for video storage
- Tailwind CSS 3.4 with custom theme
- Custom component library (~23 components) — NO shadcn, NO Material UI, NO Chakra, NO new UI dependencies
- Dark mode via `darkMode: "class"`
- Fonts: Outfit (headings) + DM Sans (body)
- Primary color: warm amber/gold
- Custom components: RPE slider, plate calculator, rest timer, voice recorder/player, video annotator, shimmer skeletons

### Key Directories
```
src/app/(auth)/              — login, register, forgot/reset-password
src/app/(dashboard)/coach/   — all coach pages
src/app/(dashboard)/athlete/ — all athlete pages
src/app/api/                 — API routes (the backend)
src/components/              — custom UI component library
src/lib/                     — auth, prisma, stripe, calculations
src/middleware.ts            — route protection
prisma/schema.prisma         — database schema
prisma/seed.ts               — test data seeder
```

### Database Migrations
- **Local dev:** `npm run db:migrate` — creates and applies migrations via `prisma migrate dev`
- **Production (build):** `prisma migrate deploy` — applies pending migrations only, never creates new ones
- **Do NOT use `prisma db push`** in production — it can silently drop data

### Test Accounts (after db:seed)
- Coach: coach@example.com / coach123
- Athlete 1: athlete1@example.com / athlete123
- Athlete 2: athlete2@example.com / athlete123

---

## Domain Rule — CRITICAL (Bondarchuk Methodology)

The entire app implements Dr. Anatoliy Bondarchuk's Transfer of Training methodology. These rules are NON-NEGOTIABLE and must be enforced in any code that touches throws sessions, exercise selection, or implement sequencing:

### Implement Weight Sequencing
**DESCENDING weight order is the ONLY correct sequence for natural athletes.**

| Sequence | Status |
|---|---|
| 9kg → 8kg → 7.26kg (heavy → comp) | ✅ CORRECT |
| 8kg only (single implement) | ✅ CORRECT |
| 6kg only, no heavy same day | ✅ CORRECT |
| 6kg → 8kg (ascending) | ❌ FORBIDDEN — causes 2-4m performance decrease |
| 7.26kg → 8kg (comp before heavy) | ❌ FORBIDDEN |
| Any light implement before any heavy implement | ❌ FORBIDDEN |

**Source:** Volume IV, p.114-117. All natural athletes in the study DECREASED 2-4 meters with ascending sequences.

### Session Structure
```
Throwing Block 1 (heaviest) → Strength Block → Throwing Block 2 (lighter) → Strength Block
```
NEVER two consecutive throwing blocks. Strength blocks between throwing blocks enable passive activation transfer.

### 15-20% Weight Differential Rule
Paired implements differing by more than 15-20% from competition weight create separate adaptations, not transfer. Flag these.

If you see ANY code that sequences light → heavy implements, it is WRONG. Fix it immediately.

---

## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness
- Run `tsc --noEmit` after any code changes

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

---

## Task Management

1. **Plan First:** Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan:** Check in before starting implementation
3. **Track Progress:** Mark items complete as you go
4. **Explain Changes:** High-level summary at each step
5. **Document Results:** Add review section to `tasks/todo.md`
6. **Capture Lessons:** Update `tasks/lessons.md` after corrections

---

## Core Principles

- **Simplicity First:** Make every change as simple as possible. Impact minimal code.
- **No Laziness:** Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact:** Changes should only touch what's necessary. Avoid introducing bugs.
- **Read Before Write:** Fully understand a file's purpose, imports, and dependencies before modifying it. Grep for all usages of a function/component before changing its interface.
- **Preserve the Design System:** Use existing Tailwind theme, colors, fonts, and custom components. Do NOT introduce new dependencies.
- **Think in User Flows:** Every change should improve a specific user journey, not just refactor code in isolation.

---

## Design System Rules (ALWAYS Follow)

### Cards
- **Navigable cards** (href, onClick that navigates, or opens detail view): ALWAYS add `card-interactive` CSS class. This gives hover scale (1.02), touch press-down (0.97) with spring-back, cursor pointer, and respects `prefers-reduced-motion`.
- **Static display cards** (data, settings, forms): Use plain `card` CSS class. No interactive effects.
- **Pattern**: `<Link className="card card-interactive p-4 ...">` or `<Card href="..." interactive>`.
- **Never** add manual `hover:shadow-md transition-shadow` to card Links — use `card-interactive` instead.

### Icons
- **Always Lucide React** — no inline SVGs, no other icon libraries.
- `strokeWidth={1.75}` on all icons (consistent weight).
- Add `aria-hidden="true"` to decorative icons.

### Color Tokens
- Use CSS custom properties: `var(--card-bg)`, `var(--card-border)`, `var(--foreground)`, `var(--muted)`.
- Semantic colors via Tailwind: `text-muted`, `bg-surface-100`, `text-primary-500`, etc.
- Status colors: success (emerald), warning (amber), danger (red), info (blue).
- **Never hardcode hex colors** — use the theme tokens.

### Typography
- Headings: `font-heading` (Outfit) — applied automatically to h1-h6.
- Body: `font-body` (DM Sans) — applied automatically to body.
- Section headers: `text-sm font-semibold text-muted uppercase tracking-wider`.
- Numeric values: `tabular-nums` for alignment.

### Responsive
- Mobile-first approach with `sm:`, `md:`, `lg:` breakpoints.
- Tables on desktop → stacked cards on mobile.
- Horizontal scroll with `overflow-x-auto custom-scrollbar` for card rows.

### Hover & Interaction States
- Card hover: `hover:bg-surface-50 dark:hover:bg-surface-800/50` for row items.
- Interactive cards: `card-interactive` class (CSS handles everything).
- **`<Button>` component** has spring bounce on click: primary/danger variants get `0.95→1.03→1.0` spring (300ms), secondary/outline/ghost get a subtle `0.97→1.0` settle (200ms). This is automatic — no extra props needed.
- **CSS utility buttons** (`btn-primary`, `btn-secondary`, `btn-danger`): keep existing `active:scale-[0.97]`. Prefer the `<Button>` component for new code to get the spring bounce.
- Links: `text-primary-500 hover:underline` for inline text links.

### Confirmations
- **High-stakes actions on mobile** (submit session, delete data): Use `<SlideToConfirm>` from `src/components/ui/SlideToConfirm.tsx`. Shows on mobile (`sm:hidden`), falls back to standard button or `ConfirmDialog` on desktop (`hidden sm:flex`).
- **Props**: `label` (text in track), `onConfirm` (callback), `disabled`, `variant` (`"confirm"` = amber, `"destructive"` = red).
- **Pattern**: Wrap both in the same parent — `<div className="sm:hidden"><SlideToConfirm /></div>` + `<div className="hidden sm:flex">...buttons...</div>`.
- **When to use**: Any action that is irreversible or high-stakes on a touch device — session saves, deletes, account changes. Not needed for low-stakes actions (navigation, toggles).
- **Desktop**: Keep `ConfirmDialog` or `window.confirm()` for destructive actions. `SlideToConfirm` is mobile-only.

### Numeric Display
Two components handle numeric animation — choose based on the use case:

**`<AnimatedNumber>`** — One-shot count-up on viewport entry (dashboard stats, hero numbers):
- Any prominent numeric value (stat cards, hero numbers, scores, distances, ratios, percentages) MUST use `<AnimatedNumber>` from `src/components/ui/AnimatedNumber.tsx`.
- **`StatCard` and `MiniStat` auto-animate**: Pass `value` as a `number` (not string) and animation happens automatically. Use `decimals` prop for decimal places (0 for counts, 1 for scores, 2 for distances/ratios).
- **`ScoreIndicator` auto-animates**: All variants (circle, pill, badge) already include animated count-up.
- **Hook for custom cases**: `useAnimatedCounter(target, duration, { decimals, unit })` from `src/lib/hooks/useAnimatedCounter.ts`. Returns `{ value, formatted, ref }` — attach `ref` to the container element.
- **Inline stats**: For numbers embedded in text (e.g. "12 athletes on roster"), wrap the number: `<AnimatedNumber value={count} />`.
- **Duration**: 1200ms default for stats, 700ms for ScoreIndicator.
- **Never render raw numbers** for dashboard/detail page hero stats — always use `AnimatedNumber` or a component that wraps it.

**`<NumberFlow>`** — Smooth transitions between value changes (sliders, timers, live totals):
- Use for any number that changes while the user is interacting: RPE slider display, rest timer countdown, running throw counts, live weight totals.
- Props: `value`, `decimals`, `suffix` ("kg", "m"), `prefix` ("$"), `duration` (default 400ms).
- Applies `font-variant-numeric: tabular-nums` automatically so digits don't shift layout.
- Also accepts `style` and `className` for inline styling (e.g. color from RPE).
- **Never render a raw number** that changes in response to user interaction — wrap it in `<NumberFlow>`.

**Both respect** `prefers-reduced-motion: reduce` — animation is skipped automatically.

### Tabs
- Use `<Tabs>`, `<TabList>`, `<TabTrigger>`, `<TabPanel>` from `src/components/ui/Tabs.tsx`.
- **Underline variant** has a sliding indicator that smoothly translates to the active tab (250ms ease-out). Do NOT manually add `border-b-2` to tab triggers — the indicator handles it.
- **Content transitions are automatic**: outgoing panel fades out (150ms), incoming fades in with slide-up (200ms). No extra code needed.
- `will-change` is applied only during transitions, removed after.
- Three variants: `"underline"` (default), `"pills"`, `"boxed"`. Pass the variant to both `<TabList>` and each `<TabTrigger>`.

### Toasts & Celebrations
- Use `useToast()` from `src/components/ui/Toast.tsx` for all notifications.
- **Standard variants**: `success()`, `error()`, `warning()`, `info()` — each has appropriate duration and color.
- **Celebration variant**: `celebration(title, { description?, highlight?, duration? })` — amber/gold gradient background, pulsing trophy icon, CSS confetti burst, large highlight text for PR distances.
- **When a PR is detected**: Fire `celebration("New Personal Best!", { highlight: "18.42m", description: "Shot Put" })`. This can complement the full-screen `PRCelebration` overlay.
- **Toast animation**: Slides up from bottom on mobile (full-width), slides in from top-right on desktop. Progress bar at bottom shows auto-dismiss countdown.
- **Legacy compat**: `useToast()` from `src/components/toast.tsx` also supports `toast(message, "celebration")`.

### Progress Bars
- `<ProgressBar>` auto-animates: fill starts at 0% and grows to target over 800ms with a gradient shimmer sweep, triggered by IntersectionObserver on viewport entry. No extra props needed — `animate` defaults to `true`.
- **Value changes after entrance** animate smoothly with 300ms ease-out (e.g. upload progress ticking up).
- Pass `animate={false}` only for bars that must render at their target instantly (rare).
- Respects `prefers-reduced-motion`.

### Loading States
- **DashboardWidget**: Pass `loading={true}` to show shimmer skeletons, then `loading={false}` to fade in real content with slide-up transition.
- **Skeleton → content pattern**: When data loads asynchronously in a widget, always transition from skeleton to content with a fade+slide, not a hard swap.
- Use the existing `shimmer` CSS class for skeleton placeholders.

### Scroll Progress
- **Any page with significant scroll depth** (wizards, long forms, detail pages with 3+ sections): Add `<ScrollProgressBar />` from `src/components/ui/ScrollProgressBar.tsx` as the first child inside the page wrapper.
- 3px amber/gold gradient bar fixed at the top of the viewport, fills left→right based on scroll position.
- Self-hides when the page isn't scrollable. `pointer-events: none`, `z-index: 9999`.
- Already applied to: athlete log-session, athlete onboarding, coach questionnaire builder, coach questionnaire responses, coach athlete detail, athlete throws profile.
- **Pattern**: `<div className="..."><ScrollProgressBar />{/* page content */}</div>`.

### Animation
- Page transitions: handled by `src/app/(dashboard)/coach/template.tsx` (framer-motion).
- Entry animations: `animate-fade-slide-in`, `animate-spring-up`.
- Animated numbers: `<AnimatedNumber>` for all visible numeric stats (see Numeric Display above).
- **Staggered lists**: Wrap any `.map()` grid or list in `<StaggeredList className="grid ...">`. Children fade in + slide up with 50ms stagger on first viewport entry. Props: `staggerDelay` (ms), `duration` (ms), `className`. Works in both Server and Client Components.
- **Tab content**: Automatic fade+slide transitions — just use `<TabPanel>`.
- Danger pulse: `animate-danger-pulse` on critical badges.
- **CSS transitions preferred**: Use CSS `transition` property for all micro-interactions. Only use framer-motion for page-level transitions. No other animation libraries.
- **Always respect** `prefers-reduced-motion` — all animation components skip animation automatically. Any new animation code MUST check `window.matchMedia("(prefers-reduced-motion: reduce)").matches`.

---

## Known Issues (Fix When Encountered)

1. **Missing back buttons** on quizzes, forms, and multi-step wizards
2. **Non-clickable cards** that display data but don't navigate to detail views
3. **Inconsistent profile pages** between coach and athlete
4. **Readiness check-ins lack context** — single score with no breakdown (sleep, soreness, stress, etc.)
5. **Rankings/scores shown without context** for what they mean

---

## Quality Bar

Every screen must pass this test:

> "If an Olympic throws coach opened this for the first time, would they immediately understand what they're looking at, trust the data, and feel like this tool was built specifically for them?"

If any screen makes you hesitate — fix it until the answer is yes.
