# Podium Throws — Design System

> The visual language for an elite coaching platform. Every decision here serves one goal: make Olympic-level throws coaches and athletes feel like this tool was built specifically for them.

---

## Visual Doctrine (2026-05-18)

**Premium is restraint.** Every additional gradient, glow, or animated flourish moves the product toward "AI-generated SaaS" and away from "research software an Olympic coach trusts." Default to nothing. Earn each effect.

The product is not one app — it is two. The coach desktop and the athlete phone share tokens but **never share visual register**. Different surfaces, different vocabularies, different quality bars.

### Allowed and forbidden

| Allowed                                                   | Forbidden in default surfaces                                                     |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Plain elevation (`shadow-card`, `shadow-warm-md`)         | Omnidirectional glow on cards, buttons, inputs                                    |
| Brand amber as a punctuation accent                       | Amber haze rendered behind content for "vibe"                                     |
| Focus-visible ring (focus indicator)                      | Decorative gradients on non-milestone surfaces                                    |
| Status colors signalling state                            | Raw Tailwind `text-emerald-*` / `bg-amber-*` / `text-red-*` — use semantic tokens |
| Opaque overlay panels (`bg-[var(--surface-overlay)]`)     | `bg-*/N` opacity suffix on content (scrim-only)                                   |
| `backdrop-blur` on a scrim backdrop                       | `backdrop-blur` on a content panel                                                |
| Explicit transition lists                                 | `transition-all`                                                                  |
| Type tokens (`text-body`, `text-caption`, `text-section`) | Bracketed `text-[Npx]` in app surfaces                                            |

Five ratcheting lint scripts enforce the doctrine. Run `npm run lint:design` to check all five:

| Script            | Catches                                                    | Baseline file              |
| ----------------- | ---------------------------------------------------------- | -------------------------- |
| `lint:hex`        | Hardcoded `#RRGGBB` in app surfaces                        | `.hex-baseline.txt`        |
| `lint:text`       | Bracketed `text-[Npx]` in app surfaces                     | `.text-size-baseline.txt`  |
| `lint:palette`    | Raw default-Tailwind palettes (amber/emerald/red/gray/...) | `.palette-baseline.txt`    |
| `lint:transition` | `transition-all` in app surfaces                           | `.transition-baseline.txt` |
| `lint:focus`      | `focus:outline-none` (the unconditional suppressor)        | `.focus-baseline.txt`      |

The pre-push hook runs all five. CI runs them on every PR. Baselines ratchet ONLY downward — never up. Add a new violation to a primitive and the push fails. Fix three and lower the baseline by exactly three.

### Glow is a milestone effect, not an ambient effect

`shadow-glow`, `shadow-glow-lg`, `shadow-glow-green`, `shadow-glow-red`, `shadow-glow-blue` (defined in `tailwind.config.ts`) are reserved for **milestone moments only**:

- PR celebration
- Streak milestone reveal (7 / 14 / 30 / 60 / 100 / 365 days)
- Session-completion celebration overlay
- Urgent-status pulse (e.g. critical wellness flag — paired with `animate-danger-pulse`)

Every other surface uses `shadow-card`, `shadow-card-hover`, or `shadow-warm-md` (subtle warm-tinted directional shadow). Hover states on a roster row, a sidebar item, a button, or a tab **do not** earn the glow.

### Translucency is reserved for scrims

Translucent backgrounds (`bg-black/70`, `bg-*/N`, `backdrop-blur-*`) are correct **only** on full-screen backdrop scrims behind modals, sheets, and command palette. Translucency on any content panel is a bug — the panel may render over a portal where the parent is no longer the page background. Use `bg-[var(--surface-overlay)]` on content; reserve translucency for scrims.

---

## Role-specific contracts

### Coach desktop — research software

A D1 throws coach using this on a MacBook between practices should feel he is reading an instrument, not a phone.

- **Mood**: calm, dense, trustworthy. Editorial typography, abundant whitespace at the page level, dense data in tables.
- **Default theme**: system, light-leaning.
- **Amber usage**: punctuation only — active nav indicator, primary CTA, focus ring, brand mark. Never as ambient haze or background tint on content.
- **Glow**: focus-visible ring + urgent-status pulse only. No card hover glow. No "research software" gradient backgrounds.
- **Motion budget**: state changes only (200ms ease-out). No celebration theatrics, no bouncy entries on data.
- **Layout**: sidebar + top bar + content. Tables and grids where data is dense; cards where data is hero-level.
- **Copy register**: neutral, professional ("Session saved", "Roster updated"). No personality.

Quality test: _"If a D1 throws coach opened this on his MacBook during office hours, would he trust the numbers and feel this was built specifically for his profession?"_

### Athlete mobile — tactile performance app

A 19-year-old D1 hammer thrower opening this on her iPhone after practice should feel a native consumer app, not a website pretending to be one.

- **Mood**: tactile, premium, just-restrained-enough to feel adult. Whoop / Strava / Apple Fitness adjacent — never game-skin neon.
- **Default theme**: system (no forced dark or light).
- **Shape language**: rounded corners (`rounded-xl` / `rounded-2xl`), never clip-path notches. The athlete shell overrides `.btn-primary` / `.input` / `.card` to drop notches automatically.
- **Touch targets**: 44px minimum (all primary actions).
- **Input typography**: 16px on all athlete forms — iOS Safari zooms anything smaller on focus. Enforced shell-wide in `globals.css` `.athlete-shell input`.
- **Safe areas**: every sticky bar uses `env(safe-area-inset-bottom)`; bottom-tab bar is fixed and safe-area-padded.
- **No viewport-scaled type** in primary content. Fluid scaling is only used inside `text-micro` / `text-nano` for dense labels.
- **No horizontal overflow** at viewport widths down to 360px.
- **Mobile keyboard rule**: any fixed control that mutates form state must not be coverable by the iOS keyboard. Sticky save bars use `position: sticky; bottom: 0` inside the form, not `position: fixed`.
- **Celebration**: full stack (overlay + toast + haptic + glow) is reserved for PR, streak milestone, and session completion. Routine interactions get quiet feedback.
- **Motion budget**: generous compared to coach (animated stats, count-ups, page transitions). Always respects `prefers-reduced-motion`.

Quality test: _"If a 19-year-old D1 hammer thrower opened this on her iPhone after practice, would it feel like the app she already wants to open every day?"_

### Marketing — always-dark editorial

The marketing surface (`/`, `/pricing`, `/changelog`, `/privacy`, `/terms`) is always-dark per CLAUDE.md §"Marketing Routes — Always-Dark". The visual register is editorial — confident, dramatic, restrained.

- **Tokens**: dedicated `--landing-*` scope. Do NOT use `--color-*` semantic tokens on marketing.
- **Forbidden**: glassmorphism, ornamental glow behind text, decorative gradients, faux 3D.
- **Allowed**: precise typography, large editorial spacing, restrained amber accent, subtle film grain, directional shadows.
- **Hover**: directional translate or scale, no glow.

### Mobile — applies everywhere, especially athlete

All viewports under 640px obey:

1. 44px minimum tap targets
2. 16px minimum input font-size (iOS zoom defence)
3. Safe-area-inset padding on every fixed/sticky bottom element
4. Bottom 80–96px of viewport reserved for chrome (tab bar, sticky save)
5. No horizontal scroll at 360px viewport width
6. No `vw`/`vh`-scaled body type
7. No `position: fixed` form controls that the iOS keyboard can cover

---

## Brand reference

**Primary Color**: `#FFC800` (warm amber-gold). Used as punctuation accent on coach surfaces, as the tactile brand throughout athlete surfaces, and as the editorial amber on marketing.
**Dark Surface**: `#0a0a0c`. The marketing canvas; also `--color-bg-canvas` resolved in `.dark`.
**Status**: theme-aware semantic colors — deep palette on light surfaces, vivid palette on dark, with documented WCAG ratios in `src/app/globals.css` Layer 1.

---

## Color System

### Primary Palette (Gold)

| Token         | Hex       | Usage                                             |
| ------------- | --------- | ------------------------------------------------- |
| `primary-50`  | `#fffdf0` | Lightest tint backgrounds                         |
| `primary-100` | `#fff9d6` | Light accent backgrounds                          |
| `primary-200` | `#fff2a8` | Hover states on light                             |
| `primary-300` | `#ffe866` | Highlights                                        |
| `primary-400` | `#ffd700` | Strong accents                                    |
| `primary-500` | `#FFC800` | **Brand gold** — CTAs, active states, focus rings |
| `primary-600` | `#e6b400` | Pressed/dark variant                              |
| `primary-700` | `#cc9f00` | Dark accents                                      |
| `primary-800` | `#997700` | Very dark accents                                 |
| `primary-900` | `#665000` | Darkest tint                                      |
| `primary-950` | `#332800` | Near-black tint                                   |

### Surface Palette (Deep Neutrals)

| Token         | Hex       | Usage                               |
| ------------- | --------- | ----------------------------------- |
| `surface-50`  | `#e8e8ea` | Light mode text, dark mode hover bg |
| `surface-100` | `#c8c8cc` | Light borders                       |
| `surface-200` | `#92929a` | Muted text                          |
| `surface-300` | `#6a6a74` | Secondary text                      |
| `surface-400` | `#44444e` | Disabled states                     |
| `surface-500` | `#2a2a34` | Card backgrounds (dark)             |
| `surface-600` | `#1e1e28` | Elevated surfaces                   |
| `surface-700` | `#16161e` | Default dark surface                |
| `surface-800` | `#101016` | Deep background                     |
| `surface-850` | `#0d0d12` | Deeper background                   |
| `surface-900` | `#0a0a0e` | Deepest surface                     |
| `surface-950` | `#06060a` | Near-black base                     |

### Semantic Status Colors

| Status      | 500 (Main) | 600       | 700       | 50 (Background) |
| ----------- | ---------- | --------- | --------- | --------------- |
| **Success** | `#00FF88`  | `#00cc6d` | `#009952` | `#0a1a10`       |
| **Warning** | `#FF8800`  | `#e67a00` | `#cc6c00` | `#1a1400`       |
| **Danger**  | `#FF2222`  | `#e61e1e` | `#cc1a1a` | `#1a0808`       |
| **Info**    | `#4488FF`  | `#3d7ae6` | `#366dcc` | `#0a1020`       |

### Event Colors

| Event    | Color           | Hex       |
| -------- | --------------- | --------- |
| Shot Put | Warm Terracotta | `#D4915A` |
| Discus   | Steel Blue      | `#6A9FD8` |
| Hammer   | Jade Green      | `#5BB88A` |
| Javelin  | Soft Red        | `#D46A6A` |

### CSS Custom Properties

```css
/* Light Mode (:root) */
--background: #fafafa;
--foreground: #171717;
--card-bg: #ffffff;
--card-border: #e5e5e5;
--muted: #737373;
--muted-bg: #f5f5f5;
--gold: #ffc800;
--gold-dim: rgba(255, 200, 0, 0.15);

/* Dark Mode (.dark) */
--background: #0a0a0c;
--foreground: #e8e8ea;
--card-bg: rgba(255, 255, 255, 0.04);
--card-border: rgba(255, 200, 0, 0.12);
--muted: #838390;
--muted-bg: #101016;
--gold: #ffc800;
--gold-dim: rgba(255, 200, 0, 0.08);
```

### Rules

- **Never hardcode hex colors** — use theme tokens (`text-primary-500`, `bg-surface-800`, etc.)
- **Never use pure black** (`#000`) or pure white (`#fff`) — use `surface-950` and `surface-50`
- **Never put gray text on colored backgrounds** — use a shade of the background color or transparency
- **Status colors mean one thing everywhere** — green = good, amber = caution, red = bad, blue = info

---

## Typography

### Font Stack

| Role             | Font          | Tailwind Class | CSS Variable           | Weights            |
| ---------------- | ------------- | -------------- | ---------------------- | ------------------ |
| **Headings**     | Chakra Petch  | `font-heading` | `--font-chakra-petch`  | 400, 500, 600, 700 |
| **Body**         | DM Sans       | `font-body`    | `--font-dm-sans`       | 400, 500, 600      |
| **Data/Numbers** | IBM Plex Mono | `font-mono`    | `--font-ibm-plex-mono` | 400, 500, 600      |

All fonts loaded via `next/font/google` with `display: "swap"`.

### Type Scale

| Token     | Size      | Line Height | Weight | Letter Spacing | Usage              |
| --------- | --------- | ----------- | ------ | -------------- | ------------------ |
| `display` | 2rem      | 1.2         | 800    | -0.02em        | Hero titles        |
| `title`   | 1.5rem    | 1.25        | 700    | -0.015em       | Page titles        |
| `section` | 1.25rem   | 1.3         | 600    | -0.01em        | Section headers    |
| `body-lg` | 1.0625rem | 1.5         | 400    | —              | Large body text    |
| `body`    | 0.9375rem | 1.5         | 400    | —              | Default body text  |
| `caption` | 0.8125rem | 1.4         | 400    | —              | Small labels       |
| `micro`   | 0.6875rem | 1.3         | 500    | 0.05em         | Tiny labels/badges |

### Legacy Display Scale

| Token        | Size   | Line Height | Weight |
| ------------ | ------ | ----------- | ------ |
| `display-xl` | 3.5rem | 1.1         | 700    |
| `display-lg` | 2.5rem | 1.15        | 700    |
| `display-md` | 2rem   | 1.2         | 600    |
| `display-sm` | 1.5rem | 1.3         | 600    |

### Rules

- h1–h6 automatically use `font-heading` (Chakra Petch)
- Body text automatically uses `font-body` (DM Sans)
- **`font-mono` is for data only** — distances, timestamps, statistics, IDs, scores. Never for prose, labels, or descriptions.
- Section headers: `text-sm font-semibold text-muted uppercase tracking-wider`
- Numeric values: always add `tabular-nums` for column alignment

---

## Spacing & Layout

### Breakpoints

| Prefix | Min Width | Target         |
| ------ | --------- | -------------- |
| `sm`   | 640px     | Large phones   |
| `md`   | 768px     | Tablets        |
| `lg`   | 1024px    | Small desktops |
| `xl`   | 1280px    | Desktops       |
| `2xl`  | 1536px    | Large desktops |

Custom media queries:

- `landscape` — `@media (orientation: landscape)`
- `portrait` — `@media (orientation: portrait)`

### Layout Patterns

- **Mobile-first** — base styles are mobile, `sm:` / `md:` / `lg:` for larger screens
- **Tables → stacked cards** on mobile
- **Horizontal scroll** — `overflow-x-auto custom-scrollbar` for card rows
- **Touch targets** — minimum 44px for all interactive elements

---

## Border Radius & Cut Corners

The cyberpunk aesthetic uses **clip-path polygon cuts** instead of traditional border-radius for cards, buttons, and inputs.

### Cut Corner Classes

| Class            | Cut Size              | Usage                  |
| ---------------- | --------------------- | ---------------------- |
| `.cut-corner`    | 12px                  | Default cards, modals  |
| `.cut-corner-sm` | 8px                   | Small elements, badges |
| `.cut-corner-lg` | 16px                  | Large containers       |
| `.cut-corner-tr` | 12px (top-right only) | Asymmetric elements    |

```css
/* Example: .cut-corner */
clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
```

### Traditional Radius

| Token         | Value   | Usage                            |
| ------------- | ------- | -------------------------------- |
| `rounded-2xl` | 1rem    | Cards when not using cut corners |
| `rounded-3xl` | 1.25rem | Extra-large elements             |

---

## Shadows & Effects

### Box Shadows

| Token               | Shadow                                      | Usage                                                      |
| ------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| `shadow-card`       | Plain depth, no glow                        | Default card                                               |
| `shadow-card-hover` | Plain hover lift, no glow                   | Card hover — interactive lists, dashboard tiles            |
| `shadow-warm-md`    | Directional shadow with subtle brand warmth | Elevated CTAs, sticky bars                                 |
| `shadow-glow`       | `0 0 20px rgb(255 200 0 / 0.2)`             | **Milestone only** — PR celebration / streak reveal        |
| `shadow-glow-lg`    | `0 0 40px rgb(255 200 0 / 0.3)`             | **Milestone only** — PR celebration overlay                |
| `shadow-glow-green` | `0 0 20px rgb(0 255 136 / 0.2)`             | **Milestone only** — success celebration                   |
| `shadow-glow-red`   | `0 0 20px rgb(255 34 34 / 0.2)`             | **Urgent only** — critical wellness flag, never decorative |
| `shadow-glow-blue`  | `0 0 20px rgb(68 136 255 / 0.2)`            | **Reserved** — info-state celebration                      |

**Rule**: `shadow-glow*` is forbidden on routine hover, focus (use the focus ring), card backgrounds, or "premium" decoration. Use `shadow-card-hover` or `shadow-warm-md` for routine elevation; the glow tokens fire only on the moments the doctrine names.

### Decorative Elements

- `.glow-divider` — thin horizontal gold gradient line (0.3 opacity)
- `.glow-divider-strong` — stronger gold gradient line (0.6 opacity)
- `.diamond` — 8px rotated square indicator (variants: `-sm` 6px, `-lg` 12px)
- `.landing-grain` — fractal noise texture overlay (1.8% opacity) on landing page

---

## Dark Mode

**Implementation**: `darkMode: "class"` in Tailwind config. HTML receives `class="dark"`.

**Toggle**: `ModeToggle` component — saves preference as cookie, default is dark mode.

| Property    | Light Mode | Dark Mode                |
| ----------- | ---------- | ------------------------ |
| Background  | `#fafafa`  | `#0a0a0c`                |
| Card BG     | `#ffffff`  | `rgba(255,255,255,0.04)` |
| Card Border | `#e5e5e5`  | `rgba(255,200,0,0.12)`   |
| Foreground  | `#171717`  | `#e8e8ea`                |
| Muted Text  | `#737373`  | `#838390`                |

The landing/marketing page always uses dark mode tokens regardless of the theme setting.

---

## Icons

**Library**: [Lucide React](https://lucide.dev) — no inline SVGs, no other icon libraries.

### Conventions

| Property      | Value                               |
| ------------- | ----------------------------------- |
| `strokeWidth` | `1.75` (all icons)                  |
| Default size  | `16` or `20` depending on context   |
| Decorative    | Add `aria-hidden="true"`            |
| Color         | Inherits `currentColor` from parent |

### Examples

```tsx
// Sidebar icon
<LayoutDashboard size={18} strokeWidth={1.75} />

// Button with icon
<Button leftIcon={<Upload size={16} strokeWidth={1.75} aria-hidden="true" />}>
  Upload Video
</Button>

// Decorative icon
<Target size={20} strokeWidth={1.75} aria-hidden="true" />
```

---

## CSS Utility Classes

### Cards

| Class               | Effect                                                                    |
| ------------------- | ------------------------------------------------------------------------- |
| `.card`             | Cyber-styled card — cut corners, border, shadow, gold glow                |
| `.card-rounded`     | Traditional rounded card (`rounded-2xl`)                                  |
| `.card-hover`       | Card with hover shadow lift                                               |
| `.card-interactive` | Hover scale (1.02), gold border tint, active scale (0.98), cursor pointer |

**Rule**: Navigable cards always use `card-interactive`. Static display cards use plain `card`.

### Buttons

| Class            | Style                                           |
| ---------------- | ----------------------------------------------- |
| `.btn-primary`   | Gold BG, dark text, uppercase, cut-corner       |
| `.btn-secondary` | Surface BG, border, hover gold tint, cut-corner |
| `.btn-danger`    | Red BG, white text, uppercase, cut-corner       |

The `<Button>` component is preferred for new code — it adds spring bounce animation automatically.

### Inputs

| Class    | Effect                                                 |
| -------- | ------------------------------------------------------ |
| `.input` | Text field with amber glow focus, cut-corner clip-path |
| `.label` | Small uppercase label with tracking                    |

### Loading

| Class      | Effect                                            |
| ---------- | ------------------------------------------------- |
| `.shimmer` | Animated gradient skeleton loader with cut-corner |

### Scrollbar

| Class               | Effect                                   |
| ------------------- | ---------------------------------------- |
| `.custom-scrollbar` | 4px thin scrollbar, muted thumb on hover |

---

## Animation System

### Timing Functions

| Name                 | Curve                               | Usage               |
| -------------------- | ----------------------------------- | ------------------- |
| `ease-spring`        | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bouncy overshoot    |
| `ease-smooth-out`    | `cubic-bezier(0.22, 1, 0.36, 1)`    | Smooth deceleration |
| `ease-spring-gentle` | `cubic-bezier(0.16, 1, 0.3, 1)`     | Subtle spring       |

### Keyframe Animations

| Animation         | Duration    | Easing        | Description                          |
| ----------------- | ----------- | ------------- | ------------------------------------ |
| `shimmer`         | 2s infinite | —             | Skeleton loading gradient            |
| `fadeIn`          | 0.3s        | ease          | Simple opacity entrance              |
| `slideUp`         | 0.3s        | ease          | Y 8px up + fade                      |
| `slideDown`       | 0.3s        | ease          | Y 8px down + fade                    |
| `slideInUp`       | 0.35s       | spring-gentle | Y 40px up + fade                     |
| `slideInDown`     | 0.35s       | spring-gentle | Y 40px down + fade                   |
| `slideOutUp`      | 0.25s       | ease-in       | Y 40px up + fade out                 |
| `slideOutDown`    | 0.25s       | ease-in       | Y 40px down + fade out               |
| `spring-in`       | 0.5s        | spring        | X 40px + scale 0.98→1 (from left)    |
| `spring-up`       | 0.45s       | spring        | Y 20px + scale 0.98→1 (from bottom)  |
| `scale-spring`    | 0.4s        | spring        | Scale 0.85→1 entrance                |
| `count-up-spring` | 0.6s        | spring        | Y 12px + scale 0.9→1 (number reveal) |
| `bar-grow`        | 0.5s        | spring        | scaleY 0→1 from bottom               |
| `chip-in`         | 0.3s        | ease          | Y 8px + scale 0.95→1                 |
| `fade-slide-in`   | 0.4s        | ease-out      | Y -4px + fade (subtle)               |
| `danger-pulse`    | 2s infinite | ease-in-out   | Opacity 1↔0.85 pulse                 |
| `streak-flame`    | 2s infinite | ease-in-out   | Flame flicker (scaleY + rotate)      |
| `progress-fill`   | 1s          | ease-out      | Width 0→100%                         |

### Button Bounce

| Variant           | Animation                               | Duration |
| ----------------- | --------------------------------------- | -------- |
| Primary / Danger  | `btnBounceSpring` — scale 1→0.95→1.03→1 | 300ms    |
| Secondary / Ghost | `btnBounceSubtle` — scale 1→0.97→1      | 200ms    |

### Accessibility

**All animations respect `prefers-reduced-motion: reduce`**:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Rules

- **CSS transitions preferred** for micro-interactions. Only use Framer Motion for page-level transitions.
- **Only animate `transform` and `opacity`** — never layout properties (width, height, padding, margin).
- **Use exponential easing** (ease-out-quart/quint) for natural deceleration. Never bounce or elastic.
- **New animation code must check** `prefers-reduced-motion`.

---

## Component Library

### UI Components (`src/components/ui/`)

| Component            | Description                                                                          |
| -------------------- | ------------------------------------------------------------------------------------ |
| `AnimatedNumber`     | Count-up animation on viewport entry (1200ms)                                        |
| `Avatar`             | User avatar with initials fallback + status indicator (5 sizes)                      |
| `Badge`              | Colored pills — primary, success, warning, danger, info, neutral                     |
| `Breadcrumbs`        | Navigation breadcrumbs with chevron separators                                       |
| `Button`             | Multi-variant button with spring bounce — primary, secondary, outline, danger, ghost |
| `Card`               | Cyber-styled card with cut corners + interactive mode                                |
| `CommandPalette`     | Cmd+K search — athletes, sessions, programs, throws                                  |
| `ConfirmDialog`      | Modal confirmation — default and danger variants                                     |
| `DashboardWidget`    | Hero card with skeleton→content fade transition                                      |
| `DataTable`          | Sortable, filterable, paginated table                                                |
| `EmptyState`         | Illustration + title + description + action CTA                                      |
| `Input`              | Text input with label, error, password toggle, icons                                 |
| `InteractiveBodyMap` | SVG body map for selecting sore areas (3-level severity)                             |
| `Modal`              | Portal modal — sm, md, lg, xl, full sizes                                            |
| `ModeToggle`         | Coach/Training mode switcher                                                         |
| `NotificationBell`   | Bell icon with dropdown (polls every 30s)                                            |
| `NumberFlow`         | Smooth transition between values (400ms) — for live-changing numbers                 |
| `ProgressBar`        | Horizontal bar — 5 variants, auto-animates on mount                                  |
| `PRCelebration`      | Full-screen confetti overlay for personal records                                    |
| `QuickActions`       | Floating action button with expandable action grid                                   |
| `RPESlider`          | Custom 1-10 slider with gradient coloring + labels                                   |
| `ScoreIndicator`     | Circle/pill/badge for 1-10 scores — color-coded                                      |
| `ScrollProgressBar`  | Fixed 3px amber bar showing page scroll position                                     |
| `Select`             | Dropdown with search, keyboard nav, clear button                                     |
| `Sidebar`            | Collapsible nav with nested sections, badges, active state                           |
| `Skeleton`           | Shimmer loaders — line, circle, card variants                                        |
| `SlideToConfirm`     | Mobile drag-to-confirm for high-stakes actions                                       |
| `StatCard`           | Stat display with label, value, trend arrows, auto-animation                         |
| `StaggeredList`      | Wraps children with staggered fade+slide entrance (50ms stagger)                     |
| `StreakBadge`        | Training streak counter with animated flame                                          |
| `Tabs`               | Tabbed interface with sliding underline + content transitions                        |
| `Toast`              | Notification toasts — success, error, warning, info, celebration                     |
| `UpgradeModal`       | Plan comparison modal with Stripe checkout                                           |

### Numeric Display Components

| Component          | When to Use                                                         |
| ------------------ | ------------------------------------------------------------------- |
| `<AnimatedNumber>` | One-shot count-up on viewport entry — dashboard stats, hero numbers |
| `<NumberFlow>`     | Smooth transition between values — sliders, timers, live totals     |

**Rule**: Never render raw numbers for stats or live values. Always wrap in one of these.

### Confirmation Patterns

| Context             | Component                       |
| ------------------- | ------------------------------- |
| Mobile high-stakes  | `<SlideToConfirm>` (touch drag) |
| Desktop high-stakes | `<ConfirmDialog>` (modal)       |
| Low-stakes          | Standard button click           |

### Loading States

| Pattern        | Implementation                                             |
| -------------- | ---------------------------------------------------------- |
| Page loading   | `<Skeleton>` shimmer variants                              |
| Widget loading | `<DashboardWidget loading={true}>` — skeleton→content fade |
| Button loading | `<Button loading>` — shows spinner                         |
| Data loading   | Skeleton→content with fade+slide transition                |

---

## Design Tokens (JavaScript)

`src/lib/design-tokens.ts` exports constants for use in JavaScript/Canvas rendering:

```typescript
BRAND.primary          // #FFC800
BRAND.primaryDark      // #e6b400
CHART_DEFAULT_COLOR    // #FFC800

SCORE_FILL.success     // #00FF88
SCORE_FILL.warning     // #FF8800
SCORE_FILL.danger      // #FF2222

EVENT_COLORS.SP        // #D4915A (Shot Put)
EVENT_COLORS.DT        // #6A9FD8 (Discus)
EVENT_COLORS.HT        // #5BB88A (Hammer)
EVENT_COLORS.JT        // #D46A6A (Javelin)

getRpeHex(rpe: number) // Returns color for RPE 1-10

POSE_COLORS.skeleton   // #00ff88
POSE_COLORS.joint      // #ffffff
```

### RPE Color Scale

| RPE  | Color        | Hex       |
| ---- | ------------ | --------- |
| 8-10 | Cyber Green  | `#00FF88` |
| 7    | Bright Lime  | `#66FF66` |
| 6    | Cyber Gold   | `#FFC800` |
| 5    | Cyber Orange | `#FF8800` |
| 4    | Hot Orange   | `#FF6600` |
| 3    | Cyber Red    | `#FF2222` |
| 1-2  | Deep Red     | `#CC1A1A` |

---

## Print Styles

```css
@media print {
  /* White background, black text */
  /* Hide navigation, sidebars, .no-print */
  /* Show only #main-content */
  /* print-color-adjust: exact */
}
```

---

## Quick Reference

### Do

- Use `card-interactive` for navigable cards
- Use `font-mono tabular-nums` for all numeric data
- Use `AnimatedNumber` or `NumberFlow` for displayed numbers
- Use CSS custom properties for colors (`var(--foreground)`, `var(--muted)`)
- Add `aria-hidden="true"` to decorative icons
- Respect `prefers-reduced-motion` in all animations
- Use the `<Button>` component for new code (spring bounce built in)
- Use `<StaggeredList>` for any `.map()` grid or list
- Use `<ScrollProgressBar>` on pages with significant scroll depth

### Don't

- Don't hardcode hex colors — use tokens
- Don't use `font-mono` for prose, labels, or descriptions
- Don't add manual `hover:shadow-md` to card Links — use `card-interactive`
- Don't use inline SVGs — use Lucide React
- Don't animate layout properties (width, height, padding, margin)
- Don't use bounce or elastic easing — use exponential deceleration
- Don't add new UI dependencies (no shadcn, Material UI, Chakra)
- Don't render raw numbers for dashboard/detail page stats
- Don't use `transition-all` — list the properties explicitly so paint scopes are predictable
- Don't put `text-white` on `bg-primary-500` — use `text-[var(--color-text-on-brand)]` (11.4:1 AAA)
- Don't render translucent backgrounds on content panels (modals, sheets, popovers, toasts) — use `bg-[var(--surface-overlay)]`
- Don't use `shadow-glow*` for routine hover, focus, or decoration — milestone surfaces only

---

## Pending design-system follow-ups

Baselines as of 2026-05-18 (after the bulk-sweep + status-palette-expansion pass):

| Lint              | Initial | After bulk sweep | Target |
| ----------------- | ------- | ---------------- | ------ |
| `lint:hex`        | 344     | 344              | 0      |
| `lint:text`       | 0       | 0                | hold   |
| `lint:palette`    | 1769    | **55**           | 0      |
| `lint:transition` | 125     | **0** ✅         | hold   |
| `lint:focus`      | 99      | **0** ✅         | hold   |

Three of five lints are at zero. The remaining 55 raw-palette hits are decorative `indigo` / `purple` / `violet` / `teal` / `fuchsia` / `pink` accents — NOT on the goal's named anti-pattern list (`gray` / `amber` / `emerald` / `red`, which are all at zero in app surfaces). They mark intentional category coding in non-MVP surfaces; a future pass can promote them to a `decoration-*` project namespace.

How the sweep landed:

- Status palette in `tailwind.config.ts` expanded from 4-shade (`50/500/600/700`) to full 11-shade (`50..950`) for `success` / `warning` / `danger` / `info`. The `-500` row stays theme-aware via `var(--color-status-*-fg)`; the rest mirror Tailwind's emerald/amber/red/blue defaults so existing visual intent is preserved.
- Bulk perl mappings applied across 271 files (`src/app/(dashboard)` / `(fullscreen)` / `(auth)` / `(squeeze)` / `src/components/{ui,coach,session}`):
  - `amber-*` → `primary-*` (full 50–950 scale)
  - `red-*` → `danger-*` ; `rose-*` → `danger-*`
  - `emerald-*` → `success-*` ; `green-*` → `success-*`
  - `orange-*` → `warning-*` ; `yellow-*` → `warning-*`
  - `blue/sky/cyan-*` → `info-*`
  - `gray/slate/zinc/stone/neutral-*` → `surface-*`
  - `transition-all` → `transition-colors`
  - `focus:outline-none` → `focus-visible:outline-none`
- Verified by `next build` (all 139 routes compiled), `tsc --noEmit` (0 errors), `next lint` (0 warnings), nav vitest (2/2).

Remaining follow-ups (smaller in scope):

- **Decorative accent migration (55 hits).** Map indigo/purple/violet/teal/fuchsia/pink to project tokens. Most are questionnaire-category or AI-architect feature accents in non-MVP surfaces.
- **Hex literal cleanup (344 hits).** Outside the documented allowlist (canvas/SVG constants, email HTML, OG images, marketing register, PlateCalculator IPF colors, video-analysis event colors), every hex should map to a token. Sweep top files per pass.
- **Opacity-suffix on content panels.** Scrim usage (`bg-black/70` behind modals, sheets, command palette) is correct. Content-panel usage (`bg-surface-800/60` on dropdowns, `bg-primary-50/40` on highlight rows) needs `var(--surface-overlay)` or a solid token shade.
- **Marketing surface audit.** Verify `/pricing` and `/changelog` card hovers obey the "no glow" rule; the `--landing-*` token scope is dark-only and should never inherit `--color-*` semantic tokens.
- **Coach mobile sideline view.** Currently flag-gated. When it ships, it inherits the athlete tactile vocabulary (rounded, 44px targets, 16px inputs) rather than the coach desktop vocabulary.
- **Browser-screenshot verification.** This pass was completed in a background session without a dev server (the test/e2e-prod-safety-20260421 incident makes `npm run dev` here unsafe — it would inherit prod `.env.local`). The production `next build` succeeded as static verification, but pre-merge you should still run `npm run screenshots:canonical` locally and visually inspect coach dashboard, coach athlete detail, athlete dashboard, athlete log session, athlete throws, pricing, auth login in both themes — the bulk-sweep mapped Tailwind shades 1:1 but a tonal QA at the pixel level is still owed.
