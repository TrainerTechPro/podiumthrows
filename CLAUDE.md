# CLAUDE.md — Podium Throws

## Operating Stance

Staff-level engineer + product manager working on a coaching SaaS for elite throws coaches.

- **Taste over velocity.** "Fine" is a failure. Slower and correct beats fast and almost-right.
- **Strip before adding.** Argue for removing features. One thing done perfectly beats five half-built variants.
- **Details are the product.** Spring curves, copy, error states, empty states — these are the thing, not polish on top of the thing.
- **End-to-end ownership.** Schema → API → pixel → toast copy. No "that's a frontend problem."
- **Disagree when taste demands it.** Push back on scope creep, generalist patterns, anything that dilutes the "built for throws coaches" promise.

The athlete and coach products have separate quality tests — see §Dual Product Identity.

## Standards Capture

When the user states a durable rule (triggers: "always", "never", "from now on", correction to a recurring pattern, new architectural rule, quality bar that extends past the current task), don't save silently. Alert, confirm, persist:

> 📌 **Persistent Standard Detected**
> [one-sentence summary]
> Persist to: CLAUDE.md §[section] / memory / Notion?

On "save it everywhere that makes sense," apply judgment and report where each landed. Not durable: one-off UI picks, local renames.

## Protocol Library

Engineering / testing / DB / design / docs protocols live in `CLAUDE-standards.md`. Invoke by name when the task calls for it.

**Binding overrides — this file wins over any protocol:**

1. Comment density: default to none. Only when WHY is non-obvious.
2. Mode declarations: only when Development Mode Protocol is explicitly invoked.
3. Test ceremony: lightweight AAA with Vitest. No JSDoc-per-test.
4. DB naming: existing Prisma PascalCase + cuid is grandfathered. Snake_case rules apply to greenfield only.
5. Doc surface: CLAUDE.md + `tasks/` + Notion. No 6-file retrofit.

---

## Project Context

**Podium Throws** — subscription coaching SaaS for Olympic-level track & field throws coaches. Next.js 14.2 (App Router) + React 18.3 + TypeScript, PostgreSQL via Prisma, Vercel.

**Users:** D1 and pro throws coaches (shot put, discus, hammer, javelin) managing rosters. Free / Pro / Elite tiers ($20-50/mo).

**Competitors to outperform:** BridgeAthletic, TrainHeroic, TeamBuildr, CoachMePlus.

### Tech Stack (do not change)

- Next.js 14.2 App Router + React 18.3 + TypeScript
- PostgreSQL via Prisma (Vercel Postgres)
- Custom JWT auth (HttpOnly cookies, 7-day, bcrypt)
- Stripe (free 3 / pro 25 / elite unlimited athletes)
- Cloudflare R2 video storage
- Tailwind 3.4, custom theme, `darkMode: "class"`
- Custom component library (~23 components) — **no shadcn, no MUI, no Chakra, no new UI deps**
- Fonts: Chakra Petch (headings) + DM Sans (body) + IBM Plex Mono (data only)
- Brand: amber/gold `#FFC800`

### Directories

```
src/app/(auth)/              login, register, forgot/reset-password
src/app/(dashboard)/coach/   coach pages
src/app/(dashboard)/athlete/ athlete pages
src/app/api/                 backend
src/components/              UI library
src/lib/                     auth, prisma, stripe, calculations
src/middleware.ts            route protection
prisma/schema.prisma
prisma/seed.ts
```

### Migrations

- Local: `npm run db:migrate` (`prisma migrate dev`)
- Build: `prisma migrate deploy` (apply only)
- **Never** `prisma db push` in prod — silent data loss

### Test accounts (after `db:seed`)

- Coach: coach@example.com / coach123
- Athlete 1: athlete1@example.com / athlete123
- Athlete 2: athlete2@example.com / athlete123

---

## Domain Rule — Bondarchuk Methodology (NON-NEGOTIABLE)

The app implements Dr. Anatoliy Bondarchuk's Transfer of Training methodology. Any code touching throws sessions, exercise selection, or implement sequencing MUST enforce these.

### Implement Weight Sequencing — DESCENDING ONLY

| Sequence                                       | Status                    |
| ---------------------------------------------- | ------------------------- |
| 9kg → 8kg → 7.26kg (heavy → comp)              | ✅                        |
| 8kg only                                       | ✅                        |
| 6kg only, no heavy same day                    | ✅                        |
| 6kg → 8kg (ascending)                          | ❌ — causes 2-4m decrease |
| 7.26kg → 8kg (comp before heavy)               | ❌                        |
| Any light implement before any heavy implement | ❌                        |

Source: Volume IV, p.114-117. All natural athletes in the study DECREASED 2-4m with ascending sequences.

### Session Structure

```
Throwing Block 1 (heaviest) → Strength → Throwing Block 2 (lighter) → Strength
```

NEVER two consecutive throwing blocks. Strength between throwing blocks enables passive activation transfer.

### 15-20% Weight Differential

Paired implements differing >15-20% from competition weight create separate adaptations, not transfer. Flag these.

If you see ANY code sequencing light → heavy implements, fix it immediately.

---

## Workflow

- **Plan first** for non-trivial tasks (3+ steps, architectural). If something goes sideways, stop and re-plan.
- **Subagents liberally** for research, exploration, parallel analysis. Keep main context clean.
- **Verify before "done":** `tsc --noEmit`, run tests, check logs. Read before write — grep usages of a shared function before changing its interface.
- **Before any commit on `main`:** `git fetch origin && git log HEAD..origin/main --oneline` — detect parallel-session divergence early. See `feedback_parallel_terminal_git_race.md`.
- **Lessons:** capture user corrections in `tasks/lessons.md`. Multi-step plans live in `tasks/todo.md`.

---

## Code Quality Standards (each rule = a real shipped bug)

### 1. No empty catch blocks

```typescript
// ❌
try {
  await save();
} catch {
  /* ignore */
}
try {
  await save();
} catch (err) {
  console.log(err);
}

// ✅ log AND surface
try {
  await save();
} catch (err) {
  logger.error("save failed", { error: err });
  toast.error(err instanceof Error ? err.message : "Network error — please try again");
}
```

Empty catches lost user data in the Quick Log offline queue. Throws session save felt "stuck on Saving..." because validation failures were swallowed. Every catch must re-throw OR surface to the user.

### 2. API response shape — one convention

All API routes return one of:

```typescript
{ success: true, data: T }
{ success: false, error: string }
```

NOT `{ ok: true, data: T }` (legacy), NOT `{ success: true, user: T }`, NOT flat fields.

Client consumption:

```typescript
const res = await fetch("/api/...");
const payload = await res.json();
if (!res.ok || !payload.success) {
  toast.error(payload.error || `Request failed (${res.status})`);
  return;
}
const result = payload.data; // always read from .data
```

### 3. Numeric inputs — distinguish empty from zero

```typescript
// ❌ coerces "0" to null
const weight = parseFloat(input) || null;

// ✅ preserves 0
const weight =
  input === "" || input == null
    ? null
    : (() => {
        const n = parseFloat(input);
        return Number.isFinite(n) ? n : null;
      })();
```

Athletes use bodyweight (0kg), unweighted implements (0kg), zero RPE for recovery. `value || null` silently destroys these.

### 4. Zod `.optional()` ≠ `.nullable()`

```typescript
// ❌ fails when client sends null
field: z.number().optional();
// ✅ accepts null and undefined
field: z.number().nullable().optional();
```

React form state uses `null` for unset. `.optional()` only accepts `undefined`. Has caused 3+ "save doesn't work" bugs. Form-fed Zod fields should be `.nullable().optional()`.

### 5. Route handler params are async

```typescript
// ✅ Next 15-ready, used throughout
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

### 6. Validate ALL mutation endpoints with Zod

POST/PUT/PATCH/DELETE MUST use `parseBody(request, Schema)` from `@/lib/api-schemas`. Never destructure raw `request.json()`.

```typescript
const parsed = await parseBody(request, MySchema);
if (parsed instanceof NextResponse) return parsed;
const { ... } = parsed;
```

Without schemas, bad input reaches Prisma and produces opaque errors. With them, the user gets a clean field-level 400.

### 7. Save buttons need TWO feedback channels

After a successful save: toast + visual change, OR toast + redirect. Single channel isn't enough — coaches look away during toasts; athletes on slow connections miss subtle changes.

```typescript
if (res.ok) {
  toast.success("Session saved");
  setSaved(true); // or router.push(...)
}
```

### 8. Guard mutations with preconditions

```typescript
async function handleSave() {
  if (!athleteId) {
    toast.error("Profile not loaded yet — refresh and try again");
    return;
  }
}
```

Race conditions between mount-time fetches and user clicks WILL happen. Without a guard, mutations fire with `null` and the API returns a confusing 400.

---

## Dual Product Identity

Podium Throws is **two products sharing a database**, not one product with two roles. When a design rule below conflicts with this principle, this principle wins.

### Athlete app — mobile-primary, consumer-grade, delight-leaning

- Phone is primary. Desktop is fallback.
- Native-app slickness, Strava/Whoop polish.
- Bottom tab bar (Home / Training / Log / Trends / Me). No sidebar, no command palette.
- Amber-on-dark mood is defensible. Celebration moments, motion, streaks welcomed.
- Single-column, thumb-zone, big primary actions.
- Dark mode: system pref by default; athlete can override.

### Coach desktop — web-primary, back-office-grade, scientific-leaning

- Desktop is primary. Mobile for sideline glances.
- Editorial, confident, "research software."
- Sidebar with grouped sections, breadcrumbs, ⌘K palette.
- Restrained — kill the costume. No neon ambient lighting, no celebration theatrics. Amber is punctuation.
- Multi-column, tabular, glance-efficient.
- Dark mode: system pref, light-leaning.

### Divergence table

| Decision         | Athlete                                   | Coach                           |
| ---------------- | ----------------------------------------- | ------------------------------- |
| Layout           | `AthleteShell` — top + bottom tabs        | `CoachShell` — sidebar + top    |
| Theme default    | System                                    | System, light-leaning           |
| Primary CTA      | Rounded, thumb-friendly                   | Clip-path notches OK on hero    |
| Celebration      | Full stack (overlay + toast + haptic)     | Quiet toast                     |
| Motion budget    | Generous (animated stats, PR confetti)    | Restrained (state changes only) |
| Stats            | One hero number, thumb-zone               | Grid of small numbers OK        |
| Decorative icons | OK in moderation                          | Functional only                 |
| Copy             | Personal, warm ("Your session is logged") | Neutral ("Session saved")       |
| Settings shape   | Discrete sub-pages, list-of-rows          | Tabs or sidebar nav OK          |

### Shared tokens, different identity

Both products share `--color-*` semantic tokens. Divergence happens at component/layout level, not primitives. Don't fork tokens. Need a product variant? Scope it (`.athlete-only`, `.coach-only`) or build a new component — don't add `--athlete-*` tokens.

### Quality tests (replaces single bar)

- **Athlete:** "If a 19-year-old D1 hammer thrower opened this on her iPhone after practice, would it feel like the app she already wants to open every day?"
- **Coach:** "If a D1 throws coach opened this on his MacBook during office hours, would he trust the numbers and feel this was built specifically for his profession?"

Both must pass. They're not the same test.

---

## Marketing Routes — Always-Dark

Marketing surface (`/`, `/pricing`, `/changelog`, `/privacy`, `/terms`, future acquisition pages) is **always dark**, regardless of theme cookie or system preference.

**Why:** editorial coherence. Landing is dark, gold-on-near-black; flipping chrome to white between pages breaks the spell. `--landing-*` tokens have no light variant by design.

**How enforced:** each marketing page wraps its top-level container in `dark`:

```tsx
<div className="dark min-h-screen ...">{/* page content */}</div>
```

The `dark` wrapper makes child Tailwind `dark:` variants and `--background`/`--foreground` tokens resolve correctly. The inline `--landing-*` styles cover landing visuals. Both belong (belt + suspenders).

**Authoring:**

- Top-level wrapper MUST include `dark`. No exceptions.
- Don't add light variants for marketing-only components.
- Don't import `MarketingNav`/`MarketingFooter`/`src/components/marketing/*` from inside dashboard or auth shells.
- Want a light surface on a marketing page? You're building something that belongs in the app, or about to break the editorial register.

A coach landing on `/pricing` from inside the app may experience a jolt — that's the correct signal that they crossed app → marketing. Don't soften it.

---

## Design System Rules

### Cards

- **Navigable** (href / onClick that navigates): add `card-interactive` class. Hover scale (1.02), touch press-down (0.97), respects `prefers-reduced-motion`.
- **Static** (data, settings, forms): plain `card`.
- Pattern: `<Link className="card card-interactive p-4 ...">` or `<Card href="..." interactive>`.
- Never manual `hover:shadow-md transition-shadow` — use `card-interactive`.

### Overlay surfaces (CRITICAL — dark mode readability)

Any floating UI rendered above page content (modals, popovers, dropdowns, sheets, drawers, toasts) MUST use a fully opaque surface in BOTH themes.

- **Use `bg-[var(--surface-overlay)]`** for the content panel.
- **Never** opacity-suffix backgrounds (`bg-black/50`, `bg-surface-900/80`, etc.) on overlay content.
- **Never** `backdrop-blur-*` without an opaque base. Blur on translucent = invisible content.
- **Translucency only on backdrop scrims** (the full-screen dimmer behind a modal), never on content.
- Need intentional translucency on a known opaque parent? `bg-[var(--surface-glass)]` is the explicit opt-in.

**Why:** dark `--card-bg` was 4% white, which cascaded into overlays. Overlays render in portals, detached from parent DOM — they can't rely on what's behind them.

**Audit before shipping any overlay:**

- [ ] Content uses `bg-[var(--surface-overlay)]`
- [ ] No `bg-*/\d+` opacity suffix
- [ ] No `backdrop-blur` on content
- [ ] Tested in both themes
- [ ] Tested on mobile

### Icons

- Lucide React only. No inline SVGs, no other libs.
- `strokeWidth={1.75}`. `aria-hidden="true"` for decorative.

### Color tokens

- Brand accent (amber `#FFC800`) + semantic status + neutral surfaces.
- CSS custom props: `var(--card-bg)`, `var(--card-border)`, `var(--foreground)`, `var(--muted)`.
- Brand: `text-primary-500`, `bg-primary-500`, or `text-brand`.
- Surfaces: `bg-surface-100` → `bg-surface-950`.
- Status: success (`#00FF88`), warning (`#FF8800`), danger (`#FF2222`), info (`#4488FF`).
- **Never hardcode hex** — use tokens.

### Typography

- Headings: `font-heading` (Chakra Petch, auto h1-h6).
- Body: `font-body` (DM Sans, auto on body).
- Data: `font-mono` (IBM Plex Mono — distances, timestamps, stats, IDs only).
- Section headers: `text-sm font-semibold text-muted uppercase tracking-wider`.
- Numerics: `tabular-nums`.
- **Never `font-mono` for prose, labels, or marketing.**

### Sheets

- `<Sheet>` from `src/components/ui/Sheet.tsx` for any non-anchored edge-slide overlay.
- **Athlete:** `side="bottom"`. **Coach:** `side="right"`. The `side` prop records product intent.
- Always-on: focus trap, Escape close, click-outside, body scroll lock, `role=dialog`. Opt out of Escape + click-outside with `preventClose`.
- Pass `title` OR `ariaLabel` (dev warning fires if neither).
- `useSheet()` mirrors `useModal()`.
- All dialog-class sheets route through `<Sheet>`. New ones MUST use this primitive — no ad-hoc fixed/translate scaffolding.

### Confirmations

- High-stakes mobile actions (submit session, delete data): `<SlideToConfirm>` from `src/components/ui/SlideToConfirm.tsx`. Mobile only (`sm:hidden`); desktop falls back to `ConfirmDialog` (`hidden sm:flex`).
- Props: `label`, `onConfirm`, `disabled`, `variant` (`"confirm"` amber / `"destructive"` red).

### Numeric display

- **`<AnimatedNumber>`** — one-shot count-up on viewport entry. `StatCard` / `MiniStat` / `ScoreIndicator` auto-animate when given a `number`. Hook: `useAnimatedCounter(target, duration, { decimals, unit })`.
- **`<NumberFlow>`** — smooth transitions on changing values. RPE slider, rest timer, live totals. Auto applies `tabular-nums`.
- Never render raw numbers for dashboard hero stats or values that change with interaction.
- Both respect `prefers-reduced-motion`.

### Tabs

- `<Tabs>` / `<TabList>` / `<TabTrigger>` / `<TabPanel>` from `src/components/ui/Tabs.tsx`.
- Underline variant has a sliding indicator — don't manually add `border-b-2`.
- Panel transitions are automatic (fade-out 150ms, fade-in + slide-up 200ms).
- Variants: `"underline"` (default), `"pills"`, `"boxed"`. Pass to `<TabList>` AND each `<TabTrigger>`.

### Toasts & celebrations

- `useToast()` from `src/components/ui/Toast.tsx`.
- Standard: `success()`, `error()`, `warning()`, `info()`.
- PR-class moments: `celebration(title, { description?, highlight?, duration? })`. Amber gradient, pulsing trophy, CSS confetti, large highlight (e.g. distance).

### Progress bars

- `<ProgressBar>` auto-animates from 0% to target on viewport entry (800ms, gradient shimmer). Value changes after entry transition smoothly (300ms ease-out).
- `animate={false}` only when target must render instantly (rare).

### Loading states

- Use the `shimmer` CSS class for skeleton placeholders.
- Pattern: render the skeleton's structural layout (matching the real content's shape) with `shimmer` rectangles in place of text/image. On data ready, swap to real content. Optionally fade in via `animate-fade-slide-in` if the transition feels abrupt.

### Scroll progress

- **Never on wizards or multi-step forms** — the step indicator IS the progress.
- **Never on athlete shell by default** — thumb-first consumer software, not blog.
- Coach editorial surfaces (questionnaire builder/responses, athlete detail) keep it as reading cue.
- 3px amber gradient bar, fixed top, self-hides when not scrollable, `pointer-events: none`, `z-index: 9999`.

### Animation

- Page transitions: `src/app/(dashboard)/coach/template.tsx` (framer-motion).
- Entry: `animate-fade-slide-in`, `animate-spring-up`.
- Numbers: `<AnimatedNumber>` / `<NumberFlow>` (above).
- Lists: wrap `.map()` in `<StaggeredList>`. 50ms stagger, fade + slide on first viewport entry.
- Critical badges: `animate-danger-pulse`.
- **CSS transitions preferred** for micro-interactions. framer-motion only for page transitions. No other animation libs.
- All animation MUST check `prefers-reduced-motion`.

### Hover & interaction

- Card row hover: `hover:bg-surface-50 dark:hover:bg-surface-800/50`.
- `<Button>` has automatic spring bounce (primary/danger: 0.95→1.03→1.0 spring 300ms; secondary/outline/ghost: 0.97→1.0 settle 200ms).
- CSS utility buttons (`btn-primary`, etc.) keep `active:scale-[0.97]`. Prefer the `<Button>` component for new code.
- Inline links: `text-primary-500 hover:underline`.

### Responsive

- Mobile-first: `sm:`, `md:`, `lg:` breakpoints.
- Tables on desktop → stacked cards on mobile.
- Horizontal scroll: `overflow-x-auto custom-scrollbar`.
