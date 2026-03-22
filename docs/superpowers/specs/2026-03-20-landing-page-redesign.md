# Landing Page Redesign — Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Mockup reference:** `.superpowers/brainstorm/331-1774061127/landing-v5.html`

---

## Overview

Complete redesign of the Podium Throws marketing homepage (`src/app/page.tsx`). Replaces the current squeeze page (deficit-finder-only funnel) with a full marketing homepage that showcases the platform, its features, methodology, and pricing — while keeping the Deficit Finder as a secondary conversion path.

**Primary target:** D1 college throws coaches comparing tools (TeamBuildr, TrainHeroic, etc.)
**Primary CTA:** Free account registration
**Secondary CTA:** Deficit Finder (lead magnet for coaches not ready to commit)
**Visual tone:** Athletic and energetic, dark premium aesthetic with Framer-tier scroll animations
**Pricing:** Free ($0, 3 athletes) / Pro ($20/mo, 25 athletes) / Elite ($50/mo, unlimited)

> **NOTE — Deliberate pricing change:** The current codebase has Pro at $100/mo and Elite at $199/mo. The user explicitly requested reducing prices to $20/mo and $50/mo. This landing page spec reflects the new prices. A separate task is required to update Stripe configuration (`src/lib/stripe.ts`), the full pricing page (`src/app/pricing/`), and CLAUDE.md to match.

---

## Page Structure

### 1. Navigation — Floating Pill

- Fixed, centered, detached from edges (`top: 14px`)
- Backdrop blur + subtle border + rounded corners (14px radius)
- Links: Features, Methodology, Pricing, Sign In
- Right-side CTA: "Start Free" (white bg, dark text)
- **Mobile:** Collapses to logo + hamburger icon. Tapping hamburger reveals full-screen overlay with nav links and CTAs stacked vertically.
- Uses existing `MarketingNav` component, restyled to floating pill form factor

### 2. Hero — Asymmetric Split Layout

**Layout:** Two-column grid (1.15fr text / 1fr device mockup), vertically centered, full viewport height.

**Left column — Text:**
- Eyebrow: amber bar + "FOR THROWS COACHES" (uppercase, letter-spacing 0.28em)
- Title: "Stop coaching / from a / **spreadsheet.**" — Outfit 900, clamp(3.2rem, 6.5vw, 5.8rem)
  - **Text mask reveal:** Each line wraps in an overflow:hidden container. Inner span animates `translateY(115%) → 0` with `blur(8px) → 0`, cubic-bezier(0.22, 1, 0.36, 1), 0.9s duration, staggered 130ms per line
  - "spreadsheet." in amber with text-shadow glow
- Subtitle: "The platform that enforces Bondarchuk methodology, validates implement sequencing, and gives you back the hours you lose to Excel every week."
- Buttons: "Start Free" (amber, box-shadow glow) + "Free Deficit Finder →" (ghost/outline)
- Trust meta: "No credit card · 3 athletes free · Cancel anytime" (small, dim)

**Right column — Device mockup:**
- Browser-chrome frame (traffic lights, URL bar showing `podiumthrows.com/coach/dashboard`)
- Code-rendered dashboard: sidebar nav, 4 stat cards (Athletes: 14, This Week: 8, Avg Dist: 17.2m, PRs: 3), SVG performance chart (amber gradient fill + stroke), athlete table with 3 rows (names, events, distances, trend badges)
- **Entry animation:** `perspective(1200px) translateY(100px) rotateX(12deg) rotateY(-6deg) scale(0.92)` → `rotateX(3deg) rotateY(-3deg) scale(1)`, 1.6s spring, 0.5s delay
- **Hover:** Flattens to `rotateX(0) rotateY(0)`, 0.8s spring
- **Scroll-linked:** As user scrolls past hero, `rotateX/Y` reduce to 0 via `useTransform(scrollYProgress)` — device "lands" flat like Apple MacBook reveal

**Background effects:**
- 3 floating gradient orbs (amber + indigo tints), `filter: blur(100px)`, drifting on 22s animation cycles
- Subtle grid overlay (`background-size: 100px`, fading radially via mask-image)
- Film grain overlay at 1.8% opacity (fixed, full viewport, SVG feTurbulence)

**Mobile adaptation:**
- Single column: title → subtitle → buttons → device mockup below
- Device mockup loses 3D perspective (static flat), scales to full width
- Title size clamps down to ~3.2rem
- Buttons stack full-width

### 3. Trust Marquee — Infinite Horizontal Scroll

- Single row, edge-to-edge, bordered top and bottom
- Items: "Shot Put · Discus · Hammer Throw · Javelin · Bondarchuk Methodology · D1 Programs · Session Validation · Video Analysis"
- Each item separated by small amber dot
- Duplicated content for seamless loop, `animation: scroll 35s linear infinite`
- Edge fade gradients (160px each side, `linear-gradient(to right, var(--bg), transparent)`)
- **Mobile:** Same behavior, naturally works

### 4. Sticky Scroll Features — Text Left, Mockup Pinned Right

**Desktop layout:** Two-column grid (1fr / 1fr), `min-height: 240vh` to create scroll room.

**Left column** — Three feature sections stacked, each `min-height: 70vh`, separated by 1px borders:

**Feature 01 — Session Builder:**
- Label: "SESSION BUILDER"
- Title: "Build sessions the way Bondarchuk intended."
- Description: Real-time sequencing validation, drill progression tracking, descending weight enforcement
- Tag: "✓ Bondarchuk-validated"

**Feature 02 — Video Analysis:**
- Label: "VIDEO ANALYSIS"
- Title: "Draw on throws. Share instantly."
- Description: Frame-by-frame annotation, release angles, voice notes, shareable links

**Feature 03 — Programming:**
- Label: "PROGRAMMING"
- Title: "Periodize across your entire roster."
- Description: Training blocks, event group assignment, batch updates

**Right column** — Sticky device mockup (`position: sticky; top: 50%; transform: translateY(-50%)`)

The mockup content **crossfades per section** as the user scrolls:
- Section 01 → **Session builder mockup** (detailed below)
- Section 02 → **Video annotator mockup** (video player with annotation lines, angles, timeline)
- Section 03 → **Programming calendar mockup** (week view with color-coded session cards)

Each transition: outgoing content scales to 0.98 + fades out, incoming scales from 1.02 + fades in, 250ms spring.

**Session builder mockup details:**
- Segmented control: "Two-a-day" / "Single session" with sliding amber indicator (framer-motion `layoutId`)
- Status bar: mode label + "✓ Valid Sequence" badge
- Group labels separate blocks: "THROWING BLOCK 1 — OVERWEIGHT 9KG", "STRENGTH BLOCK", etc.
- Left accent bars: amber for throwing blocks, indigo for strength blocks
- **Two-a-day view:**
  - T1: Standing Throw (12 throws, 9kg) + Half Turn (10 throws, 9kg)
  - S1: Power Clean (4×3 @ 85%)
  - T2: South African (10 throws, 7.26kg) + Full Throw (15 throws, 7.26kg)
  - S2: Back Squat (3×5 @ 80%)
  - Sequence: "Descending: 9kg → 7.26kg — correct order"
- **Single session view:**
  - T1: Standing Throw → Half Turn → South African → Full Throw (all 7.26kg)
  - S1: Power Clean + Back Squat
  - Sequence: "Single implement: 7.26kg · Stand → Half → SA → Full"
- Mode switch: full view crossfade with `AnimatePresence` + `layout` animations

**CRITICAL DOMAIN RULE:** Throwing blocks show `N throws` (not sets × reps). Strength blocks show `sets × reps @ percentage`. Implement weights always descend in two-a-day mode.

**Mobile adaptation:**
- No sticky pinning — converts to stacked sequence: feature text → mockup → feature text → mockup
- Each mockup animates in with `whileInView` (fade + slide up)
- Session toggle works full-width

### 5. Bento Grid — Feature Cards

**Layout:** 12-column CSS grid with varied spans:
- Row 1: Athlete Profiles (span 8) + PR Tracking (span 4)
- Row 2: Bondarchuk Codex (span 4) + Questionnaires (span 4) + Event Groups (span 4)
- Row 3: Practice Tools (span 5) + Performance Analytics (span 7)

**Card design:**
- Dark surface bg, 1px border, 14px radius
- Amber icon (36px, rounded square), title, description
- Featured card (Athlete Profiles) includes embedded mini-mockup showing Readiness (8.2), Sleep (7.5h), Soreness (3/10), Stress (Low)
- **Hover spotlight effect:** JavaScript tracks cursor position within each card, sets CSS custom properties `--mx`/`--my`, radial gradient follows cursor (Aceternity spotlight pattern)
- Cards stagger in with `whileInView` + 30ms delay between each
- Hover: translateY(-3px) + elevated shadow

**Mobile:** 1 column, all cards full-width. Spotlight effect disabled (no hover on touch).

### 6. Bondarchuk Proof Section

**Layout:** Two-column — giant stat left, context right

**Left:**
- "2–4m" — Outfit 900, `clamp(9rem, 18vw, 16rem)`, amber color
- Stroke outline echo: duplicate positioned 3px offset, `-webkit-text-stroke: 1px rgba(amber, 0.1)`, transparent fill
- **Number ticker animation:** Counter animates from 0 on scroll entry using spring physics (overshoots to ~2.5, settles)

**Right:**
- Label: "THE RESEARCH"
- Quote: "Every natural athlete lost **2–4 meters** when implements were sequenced ascending. One hundred percent of them." (italic, 19px)
- Citation: Bondarchuk, Vol. IV, pp. 114–117
- Event tags: Shot Put, Discus, Hammer, Javelin (bordered pills, hover → amber)

**Lamp effect:** Conic gradient positioned above the section (`conic-gradient(from 90deg at 50% -5%, transparent, amber-glow, transparent)`, `blur(80px)`). Expands on scroll via `useTransform(scrollYProgress)` — like Linear's lamp effect.

**Mobile:** Stacked — "2–4m" centered above, context below. Stat scales down.

### 7. Deficit Finder CTA

**Layout:** Full-width card with two columns, rounded 20px, dark surface bg

**Left:**
- Label: "FREE TOOL"
- Title: "Not ready to commit? Find the deficit first."
- Description: 60-second diagnostic
- CTA: "Run the Free Diagnostic →" (amber button)
- Note: "No signup required · Instant results"

**Right:**
- 3-step vertical flow with numbered circles and connector lines:
  1. Enter event & distances
  2. Answer 3 quick questions
  3. Get your diagnosis

**Background effect:** Diagonal beam (linear gradient, rotated -25deg, blurred)

**Mobile:** Stacked — text above, steps below. Full-width card with reduced padding.

### 8. Pricing Section

Three cards in a row, middle card (Pro) elevated and featured.

| | Free | Pro (featured) | Elite |
|---|---|---|---|
| Price | $0/mo | $20/mo | $50/mo |
| Athletes | 3 | 25 | Unlimited |
| Key features | Session builder, validation, tracking, Deficit Finder, practice tools | Everything in Free + video analysis, programming, advanced analytics, priority support | Everything in Pro + event group management, custom questionnaires, dedicated support |
| CTA | "Start Free" (outline) | "Start Pro Trial" (amber fill) | "Contact Us" (outline) |

**Pro card:**
- Elevated (-8px translateY), amber border
- **Animated border beam:** Conic gradient rotating around the card edge (4s cycle, `mask-composite: exclude` technique)
- "Most Popular" tag above card

**Mobile:** Stack vertically, Pro card first (featured), then Free, then Elite.

### 9. Final CTA

- Label: "READY?"
- Title: "Every session with the wrong sequence is another day leaving **distance on the table.**"
- Dual buttons: "Start Free Today" + "Run the Deficit Finder →"
- Trust meta repeated
- Bottom ambient glow (radial gradient, amber, 14% opacity)

### 10. Footer

- 5-column: Brand + Product + Events + Account + Legal
- Brand tagline: "The coaching platform built for throws. Rooted in Bondarchuk methodology."
- Bottom bar: copyright + methodology credit

---

## Technical Implementation

### Dependencies (no new packages)
- **framer-motion** (already installed) — all scroll animations, text reveals, layout transitions, springs
- **next/image** — hero images if we add photography later
- **Tailwind CSS** — all styling, using existing theme tokens + extensions

### Component Architecture

```
src/app/page.tsx                    — Server component, page shell + metadata
src/components/marketing/
  Nav.tsx                           — Restyle to floating pill (already exists)
  Footer.tsx                        — Restyle columns (already exists)
  HeroSection.tsx                   — NEW: hero with text reveal + device mockup
  HeroDeviceMockup.tsx              — NEW: browser-chrome dashboard mock
  TrustMarquee.tsx                  — NEW: infinite scroll strip
  StickyFeatures.tsx                — NEW: sticky scroll container
  SessionMockup.tsx                 — NEW: interactive session builder mock
  VideoMockup.tsx                   — NEW: video annotator mock
  ProgrammingMockup.tsx             — NEW: programming calendar mock
  BentoFeatures.tsx                 — NEW: bento grid with spotlight
  BondarchukProof.tsx               — NEW: 2–4m stat with lamp
  DeficitFinderCTA.tsx              — NEW: deficit finder card
  PricingPreview.tsx                — NEW: 3-tier pricing cards
  FinalCTA.tsx                      — NEW: closing CTA section
  TextReveal.tsx                    — NEW: reusable text mask reveal component
  ScrollReveal.tsx                  — NEW: reusable whileInView wrapper
```

### Animation Specifications

| Effect | Trigger | Library | Duration | Easing |
|--------|---------|---------|----------|--------|
| Text mask reveal | Page load (staggered) | framer-motion | 0.9s | cubic-bezier(0.22, 1, 0.36, 1) |
| Device entrance | Page load | framer-motion | 1.6s | cubic-bezier(0.16, 1, 0.3, 1) |
| Device scroll flatten | Scroll progress | framer-motion useTransform | Continuous | Linear map |
| Floating orbs | Continuous | CSS @keyframes | 22s | ease-in-out |
| Marquee scroll | Continuous | CSS @keyframes | 35s | linear |
| Sticky content crossfade | Scroll position | framer-motion AnimatePresence | 0.25s | spring(400, 30) |
| Segmented control slide | Click | framer-motion layoutId | 0.3s | spring(500, 30) |
| Session block morphing | Click | framer-motion AnimatePresence + layout | 0.3s | spring(400, 30) |
| Bento card stagger | Viewport entry | framer-motion whileInView | 0.6s each, 30ms stagger | ease-out |
| Bento spotlight | Mouse move | Vanilla JS (CSS vars) | Instant | — |
| Number ticker (2–4m) | Viewport entry | framer-motion useSpring | 1.2s | spring(100, 15) |
| Lamp expansion | Scroll progress | framer-motion useTransform | Continuous | Linear map |
| Event tag stagger | Viewport entry | framer-motion whileInView | 0.4s, 60ms stagger | ease-out |
| Border beam (pricing) | Continuous | CSS @keyframes | 4s | linear |
| Pricing card hover | Hover | CSS transition | 0.4s | cubic-bezier(0.16, 1, 0.3, 1) |
| Grain overlay | Static | CSS (SVG feTurbulence) | — | — |

### Color Tokens (extend existing theme)

All colors use existing Tailwind theme tokens (`primary-500`, `surface-*`, etc.) where possible. Landing-page-specific tokens are defined **once** in `globals.css` (under a `.landing` scope or `:root` extension) and referenced throughout via CSS custom properties — never as inline hex values in component code:

```css
/* Defined in globals.css — these ARE the theme tokens for landing pages */
--landing-bg: #050507;
--landing-surface: #0c0c10;
--landing-surface-2: #131318;
--landing-border: #1a1a22;
--landing-text-secondary: #a09a90;
--landing-text-dim: #3a3630;
--landing-amber-glow: rgba(245,158,11,0.07);
--landing-amber-glow-strong: rgba(245,158,11,0.14);
```

Components reference these as `var(--landing-bg)` etc. — consistent with the CLAUDE.md rule of no hardcoded hex in component code. Alternatively, extend the Tailwind config with `landing-*` color keys.

### Performance Considerations

- All animations respect `prefers-reduced-motion` — skip animations, show final state
- Device mockup: static HTML/CSS, no images — zero load time
- Floating orbs: CSS only, GPU-composited (transform + opacity)
- Spotlight effect: `requestAnimationFrame` throttled, only active on hover
- Grain texture: single SVG via data URL, `position: fixed` (painted once)
- Sticky scroll: `position: sticky` is CSS-native, no JS scroll listeners for positioning
- Scroll-linked animations use framer-motion's `useScroll` which uses passive listeners

### SEO & Metadata

```tsx
export const metadata: Metadata = {
  title: "Podium Throws — The Coaching Platform Built for Throws",
  description: "The only coaching platform that enforces Bondarchuk methodology. Session validation, video analysis, and performance tracking for shot put, discus, hammer, and javelin coaches.",
  // ... OG, Twitter cards
};
```

### Files Modified
- `src/app/page.tsx` — Complete rewrite
- `src/components/marketing/Nav.tsx` — Restyle to floating pill + mobile hamburger
- `src/components/marketing/Footer.tsx` — Minor restyle for consistency

### Files Created
- ~12 new components in `src/components/marketing/`

### Files Preserved
- `src/app/(squeeze)/deficit-finder/` — Untouched, still accessible at `/deficit-finder`
- `src/app/pricing/page.tsx` — Untouched, full pricing page still exists
- `src/components/marketing/HeroMaskReveal.tsx` — Preserved but no longer used on homepage (could be used on squeeze page later)

---

## What This Does NOT Include

- **Squeeze page redesign** — That's a separate project. Current `/deficit-finder` stays as-is.
- **Photography/video** — All product visuals are code-rendered mockups. Real screenshots or photos can be swapped in later.
- **Testimonials** — No testimonials section (no real quotes yet). Can be added later.
- **Blog/content** — No blog section. Out of scope.
- **A/B testing** — No variant testing infrastructure. Ship one version, iterate based on analytics.
