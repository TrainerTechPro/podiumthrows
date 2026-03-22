# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current squeeze page at `/` with a full marketing homepage featuring scroll-driven animations, code-rendered product mockups, and Framer-tier visual effects.

**Architecture:** Server component page shell (`page.tsx`) renders client components for each animated section. All animations use framer-motion (already installed). Landing-specific color tokens defined in `globals.css`. No new dependencies.

**Tech Stack:** Next.js 14.2 App Router, React 18.3, TypeScript, Tailwind CSS 3.4, framer-motion 12.x, Lucide React

**Spec:** `docs/superpowers/specs/2026-03-20-landing-page-redesign.md`

---

### Task 1: Landing Page Color Tokens + Grain Overlay

**Files:**
- Modify: `src/app/globals.css`

This task adds the landing-page-specific CSS custom properties and the grain overlay. All subsequent tasks reference these tokens.

- [ ] **Step 1: Add landing tokens to globals.css**

Add inside the `.dark` block in the `@layer base` section (after the existing dark theme vars):

```css
/* Landing page tokens */
--landing-bg: #050507;
--landing-surface: #0c0c10;
--landing-surface-2: #131318;
--landing-surface-3: #1a1a22;
--landing-border: #1a1a22;
--landing-border-light: #262630;
--landing-text: #eae6de;
--landing-text-secondary: #a09a90;
--landing-text-muted: #6a655c;
--landing-text-dim: #3a3630;
--landing-amber-glow: rgba(245,158,11,0.07);
--landing-amber-glow-strong: rgba(245,158,11,0.14);
```

- [ ] **Step 2: Add grain overlay utility class**

Add inside `@layer components`:

```css
.landing-grain::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.018;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

@media (prefers-reduced-motion: reduce) {
  .landing-grain::after {
    display: none;
  }
}
```

- [ ] **Step 3: Verify no visual regressions on dashboard**

Run: `npm run dev` and check coach dashboard pages still look correct — the new tokens are scoped to `.dark` and won't affect existing pages since they use different variable names.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add landing page color tokens and grain overlay utility"
```

---

### Task 2: Reusable Animation Components — TextReveal + ScrollReveal

**Files:**
- Create: `src/components/marketing/TextReveal.tsx`
- Create: `src/components/marketing/ScrollReveal.tsx`

These are small, reusable wrappers used by multiple sections.

- [ ] **Step 1: Create TextReveal component**

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";

interface TextRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export default function TextReveal({ children, delay = 0, className }: TextRevealProps) {
  const shouldReduce = useReducedMotion();

  if (shouldReduce) {
    return <span className={`block ${className ?? ""}`}>{children}</span>;
  }

  return (
    <span className={`block overflow-hidden ${className ?? ""}`}>
      <motion.span
        className="inline-block"
        initial={{ y: "115%", opacity: 0, filter: "blur(8px)" }}
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        transition={{
          duration: 0.9,
          delay,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {children}
      </motion.span>
    </span>
  );
}
```

- [ ] **Step 2: Create ScrollReveal component**

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export default function ScrollReveal({ children, delay = 0, className }: ScrollRevealProps) {
  const shouldReduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={shouldReduce ? undefined : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 3: Verify imports work**

Run: `npx tsc --noEmit` — should pass with no errors on the new files.

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/TextReveal.tsx src/components/marketing/ScrollReveal.tsx
git commit -m "feat: add TextReveal and ScrollReveal animation components"
```

---

### Task 3: Navigation — Restyle to Floating Pill

**Files:**
- Modify: `src/components/marketing/Nav.tsx`

Restyle the existing `MarketingNav` from full-width fixed header to a centered floating pill. Keep existing scroll-aware behavior and mobile hamburger.

- [ ] **Step 1: Update Nav.tsx to floating pill layout**

Replace the outer `<header>` and its inner layout. Key changes:
- Position: `fixed top-[14px] left-1/2 -translate-x-1/2` (centered pill, detached from edges)
- Background: `bg-[var(--landing-surface)]/65 backdrop-blur-xl border border-white/[0.06] rounded-[14px]`
- Inner: `px-4 h-[46px]` (compact)
- CTA button: white bg, dark text, rounded-lg
- Keep existing hamburger toggle and mobile menu
- Mobile menu: full-screen overlay with `bg-[var(--landing-surface)]` backdrop

- [ ] **Step 2: Verify Nav renders on existing pricing page**

Run: `npm run dev`, navigate to `/pricing`. The Nav should still work — floating pill on both pages.

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/Nav.tsx
git commit -m "feat: restyle MarketingNav to floating pill layout"
```

---

### Task 4: Hero Section — Text + Device Mockup

**Files:**
- Create: `src/components/marketing/HeroSection.tsx`
- Create: `src/components/marketing/HeroDeviceMockup.tsx`

The hero is the most complex section. Two sub-components: the text side uses TextReveal, the device side uses scroll-linked transforms.

- [ ] **Step 1: Create HeroDeviceMockup**

This is a pure visual component — browser chrome frame with a code-rendered dashboard inside. Contains:
- Traffic light dots (red/yellow/green)
- URL bar showing `podiumthrows.com/coach/dashboard`
- Sidebar nav (Dashboard, Athletes, Sessions, Videos, Programming, Codex)
- 4 stat cards (Athletes: 14, This Week: 8, Avg Dist: 17.2m, PRs: 3)
- SVG performance chart (amber gradient area + stroke line)
- Athlete table (3 rows: J. Martinez/Shot Put/18.42m/PR, K. Williams/Discus/54.1m/+1.2m, T. Smith/Hammer/62.8m/Steady)

All using `var(--landing-*)` tokens. No images. Pure HTML/CSS/SVG.

- [ ] **Step 2: Create HeroSection**

Client component with:
- Ambient background: 3 gradient orbs (CSS `filter:blur(100px)`, keyframe drift animation 22s), grid overlay with radial mask
- Two-column grid: `grid-cols-1 lg:grid-cols-[1.15fr_1fr]`
- Left: eyebrow → TextReveal title (3 lines, staggered 130ms) → subtitle → buttons → trust meta
- Right: HeroDeviceMockup wrapped in `motion.div` with:
  - Entry: `perspective(1200px) translateY(100px) rotateX(12deg) rotateY(-6deg) scale(0.92)` → `rotateX(3deg) rotateY(-3deg) scale(1)`
  - `useScroll` + `useTransform` to flatten rotateX/Y to 0 as user scrolls past hero
  - Hover: flatten to `rotateX(0) rotateY(0)`
- Mobile: single column, device loses 3D perspective, buttons stack full-width

- [ ] **Step 3: Verify hero renders**

Temporarily add `<HeroSection />` to `page.tsx` to see it render. Check desktop and mobile layouts.

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/HeroSection.tsx src/components/marketing/HeroDeviceMockup.tsx
git commit -m "feat: add hero section with text reveal and 3D device mockup"
```

---

### Task 5: Trust Marquee

**Files:**
- Create: `src/components/marketing/TrustMarquee.tsx`

Simple CSS-only infinite scroll. No framer-motion needed.

- [ ] **Step 1: Create TrustMarquee component**

Items: "Shot Put", "Discus", "Hammer Throw", "Javelin", "Bondarchuk Methodology", "D1 Programs", "Session Validation", "Video Analysis". Each separated by small amber dot. Content duplicated for seamless loop. Edge fade gradients (160px, `linear-gradient(to right, var(--landing-bg), transparent)`). CSS animation: `translateX(-50%)` over 35s linear infinite. Respects `prefers-reduced-motion` (pauses animation).

- [ ] **Step 2: Commit**

```bash
git add src/components/marketing/TrustMarquee.tsx
git commit -m "feat: add infinite trust marquee component"
```

---

### Task 6: Session Builder Mockup (Interactive)

**Files:**
- Create: `src/components/marketing/SessionMockup.tsx`

This is the interactive session builder mockup with the Two-a-day / Single session toggle. Used inside the sticky features section.

- [ ] **Step 1: Create SessionMockup component**

Client component with:
- Segmented control: "Two-a-day" / "Single session" with sliding amber indicator using framer-motion `layoutId`
- Status bar: mode label + "✓ Valid Sequence" badge
- Two views (AnimatePresence crossfade):
  - **Two-a-day:** T1 block (Standing Throw 12 throws 9kg + Half Turn 10 throws 9kg) → S1 (Power Clean 4×3@85%) → T2 block (South African 10 throws 7.26kg + Full Throw 15 throws 7.26kg) → S2 (Back Squat 3×5@80%)
  - **Single session:** Standing Throw → Half Turn → South African → Full Throw (all 7.26kg) → S1 (Power Clean + Back Squat)
- Group labels: "THROWING BLOCK 1 — OVERWEIGHT 9KG" etc.
- Left accent bars: amber for throw blocks, indigo for strength
- Sequence bar updates per mode
- **CRITICAL:** Throwing blocks show "N throws" (not sets × reps). Strength blocks show sets × reps.

- [ ] **Step 2: Verify toggle works**

Render SessionMockup in isolation, click between modes, verify blocks animate in/out and sequence text updates.

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/SessionMockup.tsx
git commit -m "feat: add interactive session builder mockup with mode toggle"
```

---

### Task 7: Video + Programming Mockups

**Files:**
- Create: `src/components/marketing/VideoMockup.tsx`
- Create: `src/components/marketing/ProgrammingMockup.tsx`

Simpler static mockups used in the sticky scroll features section.

- [ ] **Step 1: Create VideoMockup**

Browser-chrome frame containing:
- Video player area (dark bg) with play button
- SVG annotation lines (dashed amber lines between two circled points, angle label "42°")
- Timeline bar with scrubber at 35% position, timestamp "0:42 / 1:18"

- [ ] **Step 2: Create ProgrammingMockup**

Browser-chrome frame containing:
- Week view header (Mon-Fri)
- Color-coded session cards in each day (amber for throws sessions, indigo for strength)
- Each card: session name + brief detail
- Simple grid layout, static content

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/VideoMockup.tsx src/components/marketing/ProgrammingMockup.tsx
git commit -m "feat: add video annotator and programming mockup components"
```

---

### Task 8: Sticky Scroll Features Section

**Files:**
- Create: `src/components/marketing/StickyFeatures.tsx`

This is the scroll-linked section where text scrolls left and the mockup stays pinned right. Uses IntersectionObserver to determine which feature is active and swaps the mockup content.

- [ ] **Step 1: Create StickyFeatures component**

Client component with:
- Two-column grid: `grid-cols-1 lg:grid-cols-2`, `min-height: 240vh` on desktop
- Left column: 3 feature blocks (Session Builder, Video Analysis, Programming), each `min-h-[70vh]`, separated by 1px borders. Each has: number label ("01"), category label, title, description, optional tag.
- Right column: `lg:sticky lg:top-1/2 lg:-translate-y-1/2` wrapper
- Use IntersectionObserver on each feature block to track which is in viewport → set `activeFeature` state (0, 1, 2)
- AnimatePresence crossfade between SessionMockup, VideoMockup, ProgrammingMockup based on `activeFeature`
- Crossfade: outgoing `scale(0.98) + opacity(0)`, incoming `scale(1.02→1) + opacity(1)`, 250ms spring
- **Mobile:** No sticky. Stack feature text → mockup → feature text → mockup. Each mockup uses ScrollReveal (whileInView fade+slide).

- [ ] **Step 2: Verify sticky behavior on desktop**

Scroll through the section. Mockup should stay pinned while text scrolls. Content should swap at section boundaries.

- [ ] **Step 3: Verify mobile layout**

Resize to mobile width. Should show stacked layout with no sticky behavior.

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/StickyFeatures.tsx
git commit -m "feat: add sticky scroll features section with mockup crossfade"
```

---

### Task 9: Bento Features Grid

**Files:**
- Create: `src/components/marketing/BentoFeatures.tsx`

The asymmetric card grid with cursor spotlight effect.

- [ ] **Step 1: Create BentoFeatures component**

Client component with:
- Section header: label "EVERYTHING ELSE", title "Built for the ring, not the weight room.", subtitle
- 12-column CSS grid: 7 cards with varying spans (8,4,4,4,4,5,7)
- Each card: Lucide icon (amber bg, rounded square), title, description
- Featured card (Athlete Profiles, span-8): includes embedded mini-mockup (Readiness 8.2, Sleep 7.5h, Soreness 3/10, Stress Low)
- Cards: stagger in with ScrollReveal (30ms delay between each)
- **Spotlight effect:** `onMouseMove` handler sets `--mx` and `--my` CSS vars on each card. CSS `::after` pseudo-element shows radial gradient at those coordinates on hover. Throttle with `requestAnimationFrame`. Only on non-touch devices (check `window.matchMedia('(hover: hover)')`).
- Mobile: `grid-cols-1`, all cards full-width, spotlight disabled
- Icons: use Lucide icons (CirclePlus, Target, RefreshCw, PenLine, Grid3x3, Zap, BarChart3)

- [ ] **Step 2: Commit**

```bash
git add src/components/marketing/BentoFeatures.tsx
git commit -m "feat: add bento features grid with cursor spotlight effect"
```

---

### Task 10: Bondarchuk Proof Section

**Files:**
- Create: `src/components/marketing/BondarchukProof.tsx`

The "2–4m" stat with lamp effect and number ticker.

- [ ] **Step 1: Create BondarchukProof component**

Client component with:
- Lamp effect: `::before` pseudo-element with `conic-gradient(from 90deg at 50% -5%, transparent, var(--landing-amber-glow-strong), transparent)`, `blur(80px)`. Expand width on scroll using `useScroll` + `useTransform`.
- Two-column layout: stat left, context right
- "2–4m" stat: Outfit 900, `clamp(9rem, 18vw, 16rem)`, amber. Stroke outline echo via `::before` with `-webkit-text-stroke: 1px rgba(245,158,11,0.1)` offset 3px.
- Number ticker: use `useSpring` to animate from 0 to 2.4 on viewport entry (via `whileInView` trigger), format as "2–4m". Spring config: `stiffness: 100, damping: 15`.
- Right side: label, italic quote with amber emphasis, citation, event tags (staggered ScrollReveal, 60ms per tag)
- Mobile: stacked layout, stat centered above context

- [ ] **Step 2: Commit**

```bash
git add src/components/marketing/BondarchukProof.tsx
git commit -m "feat: add Bondarchuk proof section with lamp effect and number ticker"
```

---

### Task 11: Deficit Finder CTA + Pricing Preview + Final CTA

**Files:**
- Create: `src/components/marketing/DeficitFinderCTA.tsx`
- Create: `src/components/marketing/PricingPreview.tsx`
- Create: `src/components/marketing/FinalCTA.tsx`

Three simpler sections grouped into one task.

- [ ] **Step 1: Create DeficitFinderCTA**

Full-width card, two-column layout:
- Left: label "FREE TOOL", title, description, amber CTA button linking to `/deficit-finder`, note text
- Right: 3-step vertical flow (numbered circles with connector lines)
- Diagonal beam `::before` (linear gradient, rotated -25deg, blurred)
- Mobile: stacked, reduced padding

- [ ] **Step 2: Create PricingPreview**

Three pricing cards:
- Free ($0, 3 athletes), Pro ($20, 25 athletes, featured), Elite ($50, unlimited)
- Pro card: elevated (-8px), amber border, animated border beam (conic-gradient rotating 4s via CSS `@keyframes`), "Most Popular" tag
- Feature lists with amber dot bullets
- CTAs: outline for Free/Elite, amber fill for Pro
- Links: Free → `/register`, Pro → `/register`, Elite → `mailto:support@podiumthrows.com`
- Mobile: stack vertically, Pro first

- [ ] **Step 3: Create FinalCTA**

Centered section:
- Label "READY?", title with amber emphasis, dual buttons, trust meta
- Bottom ambient glow (radial gradient `::before`)

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/DeficitFinderCTA.tsx src/components/marketing/PricingPreview.tsx src/components/marketing/FinalCTA.tsx
git commit -m "feat: add deficit finder CTA, pricing preview, and final CTA sections"
```

---

### Task 12: Footer Restyle

**Files:**
- Modify: `src/components/marketing/Footer.tsx`

Minor restyle for visual consistency with the new landing page.

- [ ] **Step 1: Update Footer.tsx**

- Update background to use `var(--landing-bg)` with `var(--landing-border)` top border
- Update text colors to use landing tokens
- Keep existing 5-column structure (Brand, Product, Events, Company, Legal)
- Update brand tagline to "The coaching platform built for throws. Rooted in Bondarchuk methodology."
- Bottom bar: copyright + methodology credit

- [ ] **Step 2: Verify Footer on pricing page too**

Check that the footer still looks appropriate on `/pricing`.

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/Footer.tsx
git commit -m "feat: restyle marketing footer for landing page consistency"
```

---

### Task 13: Assemble Page — Rewrite `src/app/page.tsx`

**Files:**
- Modify: `src/app/page.tsx`

Replace the entire squeeze page with the new marketing homepage.

- [ ] **Step 1: Rewrite page.tsx**

Server component that:
- Sets metadata (title, description, OG, Twitter)
- Renders a wrapping `<div>` with `landing-grain` class and `bg-[var(--landing-bg)]`
- Composes all sections in order:
  1. `<MarketingNav />`
  2. `<HeroSection />`
  3. `<TrustMarquee />`
  4. Divider
  5. `<StickyFeatures />`
  6. Divider
  7. `<BentoFeatures />`
  8. Divider
  9. `<BondarchukProof />`
  10. Divider
  11. `<DeficitFinderCTA />`
  12. Divider
  13. `<PricingPreview />`
  14. Divider
  15. `<FinalCTA />`
  16. `<MarketingFooter />`
- Dividers: `<div className="h-px bg-[var(--landing-border)] max-w-[1400px] mx-auto" />`

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No new errors

- [ ] **Step 4: Visual verification**

Run: `npm run dev`, open `http://localhost:3000`. Walk through entire page:
- [ ] Nav floats as pill, collapses on mobile
- [ ] Hero text reveals animate, device mockup has 3D perspective
- [ ] Marquee scrolls infinitely with edge fades
- [ ] Sticky features: text scrolls, mockup pins and swaps content
- [ ] Session toggle switches between Two-a-day and Single session correctly
- [ ] Bento cards stagger in, spotlight follows cursor
- [ ] "2–4m" stat animates on scroll entry
- [ ] Deficit finder card renders with steps
- [ ] Pricing cards render with correct prices ($0/$20/$50), Pro has border beam
- [ ] Final CTA renders with ambient glow
- [ ] Footer matches new design
- [ ] Mobile: all sections stack properly, no horizontal overflow
- [ ] `prefers-reduced-motion`: animations skip (test in browser devtools)

- [ ] **Step 5: Verify deficit finder still accessible**

Navigate to `/deficit-finder` — should still work as before, unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: replace squeeze page with full marketing homepage"
```

---

### Task 14: Final Polish + Cleanup

**Files:**
- Possibly modify: any component needing spacing/alignment fixes

- [ ] **Step 1: Cross-browser check**

Test in Chrome and Safari. Check:
- Backdrop blur renders correctly
- CSS mask-image on grid works
- Sticky positioning works in both browsers
- Grain overlay doesn't cause performance issues

- [ ] **Step 2: Mobile scroll performance**

Test on mobile Safari (or simulator). Verify:
- No janky scroll on the sticky section
- Animations don't cause frame drops
- No horizontal overflow anywhere

- [ ] **Step 3: Lighthouse check**

Run Lighthouse on the page. Target:
- Performance: 90+
- Accessibility: 95+
- Fix any a11y issues (missing aria-labels, contrast ratios, etc.)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "polish: final landing page adjustments and fixes"
```
