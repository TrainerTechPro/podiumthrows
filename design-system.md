# Podium Throws — Design System

> The visual language for an elite coaching platform. Every decision here serves one goal: make Olympic-level throws coaches feel like this tool was built specifically for them.

---

## Brand Identity

**Aesthetic**: Cyberpunk-meets-athletic — deep dark surfaces, sharp cut corners, warm amber/gold accents. The visual identity communicates precision, power, and elite performance.

**Primary Color**: `#FFC800` (Warm Amber/Gold)
**Dark Surface**: `#0a0a0c`
**Status**: Cyber-tinted semantic colors (neon green, hot orange, electric red, cool blue)

---

## Color System

### Primary Palette (Gold)

| Token | Hex | Usage |
|-------|-----|-------|
| `primary-50` | `#fffdf0` | Lightest tint backgrounds |
| `primary-100` | `#fff9d6` | Light accent backgrounds |
| `primary-200` | `#fff2a8` | Hover states on light |
| `primary-300` | `#ffe866` | Highlights |
| `primary-400` | `#ffd700` | Strong accents |
| `primary-500` | `#FFC800` | **Brand gold** — CTAs, active states, focus rings |
| `primary-600` | `#e6b400` | Pressed/dark variant |
| `primary-700` | `#cc9f00` | Dark accents |
| `primary-800` | `#997700` | Very dark accents |
| `primary-900` | `#665000` | Darkest tint |
| `primary-950` | `#332800` | Near-black tint |

### Surface Palette (Deep Neutrals)

| Token | Hex | Usage |
|-------|-----|-------|
| `surface-50` | `#e8e8ea` | Light mode text, dark mode hover bg |
| `surface-100` | `#c8c8cc` | Light borders |
| `surface-200` | `#92929a` | Muted text |
| `surface-300` | `#6a6a74` | Secondary text |
| `surface-400` | `#44444e` | Disabled states |
| `surface-500` | `#2a2a34` | Card backgrounds (dark) |
| `surface-600` | `#1e1e28` | Elevated surfaces |
| `surface-700` | `#16161e` | Default dark surface |
| `surface-800` | `#101016` | Deep background |
| `surface-850` | `#0d0d12` | Deeper background |
| `surface-900` | `#0a0a0e` | Deepest surface |
| `surface-950` | `#06060a` | Near-black base |

### Semantic Status Colors

| Status | 500 (Main) | 600 | 700 | 50 (Background) |
|--------|-----------|-----|-----|-----------------|
| **Success** | `#00FF88` | `#00cc6d` | `#009952` | `#0a1a10` |
| **Warning** | `#FF8800` | `#e67a00` | `#cc6c00` | `#1a1400` |
| **Danger** | `#FF2222` | `#e61e1e` | `#cc1a1a` | `#1a0808` |
| **Info** | `#4488FF` | `#3d7ae6` | `#366dcc` | `#0a1020` |

### Event Colors

| Event | Color | Hex |
|-------|-------|-----|
| Shot Put | Warm Terracotta | `#D4915A` |
| Discus | Steel Blue | `#6A9FD8` |
| Hammer | Jade Green | `#5BB88A` |
| Javelin | Soft Red | `#D46A6A` |

### CSS Custom Properties

```css
/* Light Mode (:root) */
--background: #fafafa;
--foreground: #171717;
--card-bg: #ffffff;
--card-border: #e5e5e5;
--muted: #737373;
--muted-bg: #f5f5f5;
--gold: #FFC800;
--gold-dim: rgba(255, 200, 0, 0.15);

/* Dark Mode (.dark) */
--background: #0a0a0c;
--foreground: #e8e8ea;
--card-bg: rgba(255, 255, 255, 0.04);
--card-border: rgba(255, 200, 0, 0.12);
--muted: #838390;
--muted-bg: #101016;
--gold: #FFC800;
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

| Role | Font | Tailwind Class | CSS Variable | Weights |
|------|------|---------------|-------------|---------|
| **Headings** | Chakra Petch | `font-heading` | `--font-chakra-petch` | 400, 500, 600, 700 |
| **Body** | DM Sans | `font-body` | `--font-dm-sans` | 400, 500, 600 |
| **Data/Numbers** | IBM Plex Mono | `font-mono` | `--font-ibm-plex-mono` | 400, 500, 600 |

All fonts loaded via `next/font/google` with `display: "swap"`.

### Type Scale

| Token | Size | Line Height | Weight | Letter Spacing | Usage |
|-------|------|------------|--------|---------------|-------|
| `display` | 2rem | 1.2 | 800 | -0.02em | Hero titles |
| `title` | 1.5rem | 1.25 | 700 | -0.015em | Page titles |
| `section` | 1.25rem | 1.3 | 600 | -0.01em | Section headers |
| `body-lg` | 1.0625rem | 1.5 | 400 | — | Large body text |
| `body` | 0.9375rem | 1.5 | 400 | — | Default body text |
| `caption` | 0.8125rem | 1.4 | 400 | — | Small labels |
| `micro` | 0.6875rem | 1.3 | 500 | 0.05em | Tiny labels/badges |

### Legacy Display Scale

| Token | Size | Line Height | Weight |
|-------|------|------------|--------|
| `display-xl` | 3.5rem | 1.1 | 700 |
| `display-lg` | 2.5rem | 1.15 | 700 |
| `display-md` | 2rem | 1.2 | 600 |
| `display-sm` | 1.5rem | 1.3 | 600 |

### Rules

- h1–h6 automatically use `font-heading` (Chakra Petch)
- Body text automatically uses `font-body` (DM Sans)
- **`font-mono` is for data only** — distances, timestamps, statistics, IDs, scores. Never for prose, labels, or descriptions.
- Section headers: `text-sm font-semibold text-muted uppercase tracking-wider`
- Numeric values: always add `tabular-nums` for column alignment

---

## Spacing & Layout

### Breakpoints

| Prefix | Min Width | Target |
|--------|----------|--------|
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small desktops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large desktops |

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

| Class | Cut Size | Usage |
|-------|---------|-------|
| `.cut-corner` | 12px | Default cards, modals |
| `.cut-corner-sm` | 8px | Small elements, badges |
| `.cut-corner-lg` | 16px | Large containers |
| `.cut-corner-tr` | 12px (top-right only) | Asymmetric elements |

```css
/* Example: .cut-corner */
clip-path: polygon(
  0 0,
  calc(100% - 12px) 0,
  100% 12px,
  100% 100%,
  12px 100%,
  0 calc(100% - 12px)
);
```

### Traditional Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-2xl` | 1rem | Cards when not using cut corners |
| `rounded-3xl` | 1.25rem | Extra-large elements |

---

## Shadows & Effects

### Box Shadows

| Token | Shadow | Usage |
|-------|--------|-------|
| `shadow-card` | `0 1px 3px rgb(0 0 0 / 0.3), 0 0 1px rgb(255 200 0 / 0.05)` | Default card |
| `shadow-card-hover` | `0 4px 20px rgb(0 0 0 / 0.4), 0 0 15px rgb(255 200 0 / 0.1)` | Card hover (gold glow) |
| `shadow-glow` | `0 0 20px rgb(255 200 0 / 0.2)` | Medium gold glow |
| `shadow-glow-lg` | `0 0 40px rgb(255 200 0 / 0.3)` | Large gold glow |
| `shadow-glow-green` | `0 0 20px rgb(0 255 136 / 0.2)` | Success glow |
| `shadow-glow-red` | `0 0 20px rgb(255 34 34 / 0.2)` | Danger glow |
| `shadow-glow-blue` | `0 0 20px rgb(68 136 255 / 0.2)` | Info glow |

### Decorative Elements

- `.glow-divider` — thin horizontal gold gradient line (0.3 opacity)
- `.glow-divider-strong` — stronger gold gradient line (0.6 opacity)
- `.diamond` — 8px rotated square indicator (variants: `-sm` 6px, `-lg` 12px)
- `.landing-grain` — fractal noise texture overlay (1.8% opacity) on landing page

---

## Dark Mode

**Implementation**: `darkMode: "class"` in Tailwind config. HTML receives `class="dark"`.

**Toggle**: `ModeToggle` component — saves preference as cookie, default is dark mode.

| Property | Light Mode | Dark Mode |
|----------|-----------|-----------|
| Background | `#fafafa` | `#0a0a0c` |
| Card BG | `#ffffff` | `rgba(255,255,255,0.04)` |
| Card Border | `#e5e5e5` | `rgba(255,200,0,0.12)` |
| Foreground | `#171717` | `#e8e8ea` |
| Muted Text | `#737373` | `#838390` |

The landing/marketing page always uses dark mode tokens regardless of the theme setting.

---

## Icons

**Library**: [Lucide React](https://lucide.dev) — no inline SVGs, no other icon libraries.

### Conventions

| Property | Value |
|----------|-------|
| `strokeWidth` | `1.75` (all icons) |
| Default size | `16` or `20` depending on context |
| Decorative | Add `aria-hidden="true"` |
| Color | Inherits `currentColor` from parent |

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

| Class | Effect |
|-------|--------|
| `.card` | Cyber-styled card — cut corners, border, shadow, gold glow |
| `.card-rounded` | Traditional rounded card (`rounded-2xl`) |
| `.card-hover` | Card with hover shadow lift |
| `.card-interactive` | Hover scale (1.02), gold border tint, active scale (0.98), cursor pointer |

**Rule**: Navigable cards always use `card-interactive`. Static display cards use plain `card`.

### Buttons

| Class | Style |
|-------|-------|
| `.btn-primary` | Gold BG, dark text, uppercase, cut-corner |
| `.btn-secondary` | Surface BG, border, hover gold tint, cut-corner |
| `.btn-danger` | Red BG, white text, uppercase, cut-corner |

The `<Button>` component is preferred for new code — it adds spring bounce animation automatically.

### Inputs

| Class | Effect |
|-------|-------|
| `.input` | Text field with amber glow focus, cut-corner clip-path |
| `.label` | Small uppercase label with tracking |

### Loading

| Class | Effect |
|-------|-------|
| `.shimmer` | Animated gradient skeleton loader with cut-corner |

### Scrollbar

| Class | Effect |
|-------|-------|
| `.custom-scrollbar` | 4px thin scrollbar, muted thumb on hover |

---

## Animation System

### Timing Functions

| Name | Curve | Usage |
|------|-------|-------|
| `ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bouncy overshoot |
| `ease-smooth-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Smooth deceleration |
| `ease-spring-gentle` | `cubic-bezier(0.16, 1, 0.3, 1)` | Subtle spring |

### Keyframe Animations

| Animation | Duration | Easing | Description |
|-----------|----------|--------|-------------|
| `shimmer` | 2s infinite | — | Skeleton loading gradient |
| `fadeIn` | 0.3s | ease | Simple opacity entrance |
| `slideUp` | 0.3s | ease | Y 8px up + fade |
| `slideDown` | 0.3s | ease | Y 8px down + fade |
| `slideInUp` | 0.35s | spring-gentle | Y 40px up + fade |
| `slideInDown` | 0.35s | spring-gentle | Y 40px down + fade |
| `slideOutUp` | 0.25s | ease-in | Y 40px up + fade out |
| `slideOutDown` | 0.25s | ease-in | Y 40px down + fade out |
| `spring-in` | 0.5s | spring | X 40px + scale 0.98→1 (from left) |
| `spring-up` | 0.45s | spring | Y 20px + scale 0.98→1 (from bottom) |
| `scale-spring` | 0.4s | spring | Scale 0.85→1 entrance |
| `count-up-spring` | 0.6s | spring | Y 12px + scale 0.9→1 (number reveal) |
| `bar-grow` | 0.5s | spring | scaleY 0→1 from bottom |
| `chip-in` | 0.3s | ease | Y 8px + scale 0.95→1 |
| `fade-slide-in` | 0.4s | ease-out | Y -4px + fade (subtle) |
| `danger-pulse` | 2s infinite | ease-in-out | Opacity 1↔0.85 pulse |
| `streak-flame` | 2s infinite | ease-in-out | Flame flicker (scaleY + rotate) |
| `progress-fill` | 1s | ease-out | Width 0→100% |

### Button Bounce

| Variant | Animation | Duration |
|---------|-----------|----------|
| Primary / Danger | `btnBounceSpring` — scale 1→0.95→1.03→1 | 300ms |
| Secondary / Ghost | `btnBounceSubtle` — scale 1→0.97→1 | 200ms |

### Accessibility

**All animations respect `prefers-reduced-motion: reduce`**:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
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

| Component | Description |
|-----------|-------------|
| `AnimatedNumber` | Count-up animation on viewport entry (1200ms) |
| `Avatar` | User avatar with initials fallback + status indicator (5 sizes) |
| `Badge` | Colored pills — primary, success, warning, danger, info, neutral |
| `Breadcrumbs` | Navigation breadcrumbs with chevron separators |
| `Button` | Multi-variant button with spring bounce — primary, secondary, outline, danger, ghost |
| `Card` | Cyber-styled card with cut corners + interactive mode |
| `CommandPalette` | Cmd+K search — athletes, sessions, programs, throws |
| `ConfirmDialog` | Modal confirmation — default and danger variants |
| `DashboardWidget` | Hero card with skeleton→content fade transition |
| `DataTable` | Sortable, filterable, paginated table |
| `EmptyState` | Illustration + title + description + action CTA |
| `Input` | Text input with label, error, password toggle, icons |
| `InteractiveBodyMap` | SVG body map for selecting sore areas (3-level severity) |
| `Modal` | Portal modal — sm, md, lg, xl, full sizes |
| `ModeToggle` | Coach/Training mode switcher |
| `NotificationBell` | Bell icon with dropdown (polls every 30s) |
| `NumberFlow` | Smooth transition between values (400ms) — for live-changing numbers |
| `ProgressBar` | Horizontal bar — 5 variants, auto-animates on mount |
| `PRCelebration` | Full-screen confetti overlay for personal records |
| `QuickActions` | Floating action button with expandable action grid |
| `RPESlider` | Custom 1-10 slider with gradient coloring + labels |
| `ScoreIndicator` | Circle/pill/badge for 1-10 scores — color-coded |
| `ScrollProgressBar` | Fixed 3px amber bar showing page scroll position |
| `Select` | Dropdown with search, keyboard nav, clear button |
| `Sidebar` | Collapsible nav with nested sections, badges, active state |
| `Skeleton` | Shimmer loaders — line, circle, card variants |
| `SlideToConfirm` | Mobile drag-to-confirm for high-stakes actions |
| `StatCard` | Stat display with label, value, trend arrows, auto-animation |
| `StaggeredList` | Wraps children with staggered fade+slide entrance (50ms stagger) |
| `StreakBadge` | Training streak counter with animated flame |
| `Tabs` | Tabbed interface with sliding underline + content transitions |
| `Toast` | Notification toasts — success, error, warning, info, celebration |
| `UpgradeModal` | Plan comparison modal with Stripe checkout |

### Numeric Display Components

| Component | When to Use |
|-----------|------------|
| `<AnimatedNumber>` | One-shot count-up on viewport entry — dashboard stats, hero numbers |
| `<NumberFlow>` | Smooth transition between values — sliders, timers, live totals |

**Rule**: Never render raw numbers for stats or live values. Always wrap in one of these.

### Confirmation Patterns

| Context | Component |
|---------|-----------|
| Mobile high-stakes | `<SlideToConfirm>` (touch drag) |
| Desktop high-stakes | `<ConfirmDialog>` (modal) |
| Low-stakes | Standard button click |

### Loading States

| Pattern | Implementation |
|---------|---------------|
| Page loading | `<Skeleton>` shimmer variants |
| Widget loading | `<DashboardWidget loading={true}>` — skeleton→content fade |
| Button loading | `<Button loading>` — shows spinner |
| Data loading | Skeleton→content with fade+slide transition |

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

| RPE | Color | Hex |
|-----|-------|-----|
| 8-10 | Cyber Green | `#00FF88` |
| 7 | Bright Lime | `#66FF66` |
| 6 | Cyber Gold | `#FFC800` |
| 5 | Cyber Orange | `#FF8800` |
| 4 | Hot Orange | `#FF6600` |
| 3 | Cyber Red | `#FF2222` |
| 1-2 | Deep Red | `#CC1A1A` |

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
