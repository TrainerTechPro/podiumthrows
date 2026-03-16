# Hero Mask Reveal — Design Spec

## Overview

Replace the static hero section on the landing page (`src/app/page.tsx`) with a cursor-reactive hover mask reveal effect. Two full-bleed images are layered — a stadium at dusk (base) and an athlete mid-release (reveal). A circular mask follows the cursor with spring physics, revealing the athlete image underneath. The mask radius dynamically scales with cursor velocity: faster movement = wider reveal.

## Goals

- Create a bold, tactile first impression that differentiates Podium Throws from competitors
- Showcase the sport visually without sacrificing the squeeze page's single CTA focus
- Zero new dependencies — use Framer Motion (already installed) + CSS masking

## Non-Goals

- No changes to any section below the hero (what you'll learn, methodology, final CTA, footer)
- No new UI library dependencies
- No WebGL or Canvas — pure CSS masking

## Component Architecture

### Layer Stack (bottom to top)

| Layer | Content | Behavior |
|-------|---------|----------|
| 0 | Base image (stadium at dusk) | Always visible, Next.js `<Image fill>` with `priority`, `object-cover` |
| 1 | Reveal image (athlete mid-release) | Masked by `radial-gradient`, only visible under cursor. `<Image fill>` with `object-cover` |
| 2 | Dark overlay gradients | Left→right (85%→transparent) + bottom→top for text readability |
| 3 | Hero text + CTA | Headline, subhead, divider, CTA button. `pointer-events: auto` |

### New File: `src/components/marketing/HeroMaskReveal.tsx`

~200-250 lines. `"use client"` component. Contains all mask, spring, parallax, gyroscope, and fallback logic.

```typescript
interface HeroMaskRevealProps {
  baseImage: string;       // Stadium / default state
  revealImage: string;     // Athlete / revealed state
  baseAlt: string;
  revealAlt: string;
  minRadius?: number;      // default 100
  maxRadius?: number;      // default 350
  children: React.ReactNode; // headline + CTA overlay
}
```

### Modified File: `src/app/page.tsx`

`page.tsx` **remains a Server Component** (no `"use client"` added). `HeroMaskReveal` is a Client Component imported and rendered within the Server Component — this is standard Next.js composition.

Changes:
- Import `HeroMaskReveal` from `@/components/marketing/HeroMaskReveal`
- **Remove** the existing hero `<section className="flex-1 flex items-center relative">` block (lines ~69–128), including the decorative "2–4" oversized background texture element (lines ~73–83) — the new full-bleed images replace this visual element
- The hero currently uses `flex-1` to fill remaining viewport height. Replace with `<HeroMaskReveal>` which handles its own `100svh` height internally. The parent flex container (`min-h-screen flex flex-col`) remains unchanged — the hero's explicit `100svh` overrides `flex-1` behavior
- **Make header overlay the hero**: Change the existing `<header>` from `relative` to `absolute` positioning (`absolute top-0 left-0 right-0 z-20`) so it overlays the full-bleed hero. Adjust text colors for contrast against the hero images
- Pass existing headline/CTA markup as `children`
- All sections below the hero remain untouched

### Asset Files

- `public/images/hero-stadium.jpg` — stadium/competition ring at dusk
- `public/images/hero-athlete.jpg` — thrower mid-release, matching composition

**Image requirements:**
- Minimum 2560px wide for high-DPI full-bleed display
- 16:9 or similar landscape aspect ratio
- Both images use Next.js `<Image fill>` with `object-cover` and `sizes="100vw"` — no explicit width/height props needed
- Source from Unsplash as placeholders initially if custom photography isn't available

## CSS Mask Technique

The reveal image layer uses a dynamic CSS `mask-image` applied via inline style (JS template literal):

```typescript
style={{
  WebkitMaskImage: `radial-gradient(
    circle ${radius}px at ${x}px ${y}px,
    black 0%,
    rgba(0,0,0,0.6) 50%,
    rgba(0,0,0,0.1) 80%,
    transparent 100%
  )`,
  maskImage: `radial-gradient(
    circle ${radius}px at ${x}px ${y}px,
    black 0%,
    rgba(0,0,0,0.6) 50%,
    rgba(0,0,0,0.1) 80%,
    transparent 100%
  )`,
}}
```

- `x`, `y` are Framer Motion `useSpring` values tracking cursor position
- `radius` is a spring value derived from cursor velocity
- Both `-webkit-` prefixed and unprefixed properties set for cross-browser support
- GPU-composited — no layout or paint thrash
- Add `will-change: mask-image` on the reveal layer for reliable GPU compositing

## Spring Physics

Three independent spring systems:

### 1. Cursor Position Spring
```
{ stiffness: 150, damping: 15, mass: 0.5 }
```
Smooth lag behind cursor with slight overshoot. Creates the "liquid" organic motion — the mask drifts and settles rather than snapping.

### 2. Dynamic Radius Spring
```
{ stiffness: 100, damping: 20, mass: 0.8 }
```
Slower spring so the radius swells and shrinks organically. Fed by `useVelocity` on the cursor position springs.

**Velocity → radius mapping function:**
```typescript
// Linear interpolation clamped to [minRadius, maxRadius]
// velocity is magnitude in px/s from combined x/y velocity
const speed = Math.sqrt(vx * vx + vy * vy);
const t = Math.min(speed / 1500, 1); // 1500 px/s = full radius
const targetRadius = minRadius + t * (maxRadius - minRadius);
```

- Still cursor (0 px/s): 100px radius
- Medium speed (~750 px/s): ~225px radius
- Fast movement (≥1500 px/s): 350px radius (clamped)

### 3. Parallax Spring
```
{ stiffness: 50, damping: 30 }
```
Both images shift subtly based on cursor position relative to container center:
- Base image: ~10px max offset
- Reveal image: ~20px max offset (opposite direction)
Creates a sense of depth between the layers.

## Layout

### Desktop (≥1024px)
- Full viewport height (`100svh`)
- Full-bleed images edge-to-edge, `position: absolute; inset: 0`
- Text anchored left (max-width ~640px) with `padding: 80px 60px`
- Double gradient overlay: left→right for text, bottom→top for section transition
- Header overlays the top of the hero (positioned absolute)

### Mobile (<1024px)
- Full viewport height (`100svh`)
- Text stacked at bottom with heavier overlay gradient
- Full-width CTA button
- Reduced subhead text for space

## Platform Behavior

### Desktop (mouse)
Mouse cursor drives mask position via `onMouseMove`. Dynamic radius from `useVelocity`. Parallax on both layers.

### Mobile — Touch
Touch events (`onTouchMove`) drive the mask position, same as mouse. When the user touches and drags on the hero, the mask follows touch position. This takes priority over gyroscope input when active.

### Mobile — Gyroscope
- `DeviceOrientationEvent` API drives mask position when no touch is active
- Beta (front-back tilt) → Y position
- Gamma (left-right tilt) → X position
- iOS requires explicit permission request via `DeviceOrientationEvent.requestPermission()` — triggered on first user tap, never auto-prompted
- **Permission denied fallback**: If the user denies gyroscope permission, fall through to the auto-animation fallback (same as "no gyro" path below)
- Sensitivity scaled so ±15° of tilt covers the full hero area

### Mobile Fallback (no gyro / permission denied)
- Auto-animated loop: mask position follows a slow figure-8 Lissajous curve
- `x = centerX + A * sin(t * 0.3)`
- `y = centerY + B * sin(t * 0.5)`
- Radius gently oscillates between minRadius and midpoint
- Creates a mesmerizing ambient effect without interaction
- Touch interaction still works and overrides the auto-animation while touching

### Mouse Leave / Touch End
When cursor exits the hero area (or touch ends), the mask opacity fades to 0 over ~400ms via a spring transition. Stadium image returns cleanly. On mobile with gyro or auto-animation, the mask remains visible (only desktop mouse-leave triggers fade-out).

## Performance

- **No React re-renders on mouse move**: All animation values use `useMotionValue` and `useSpring`, which bypass React's render cycle
- **GPU compositing**: CSS `mask-image` is composited on the GPU. `will-change: mask-image` set on reveal layer
- **Next.js Image optimization**: Both images use `<Image fill>` with `priority`, `sizes="100vw"`, and automatic format optimization
- **`requestAnimationFrame` throttle**: Velocity calculation capped to rAF for consistent 60fps
- **`prefers-reduced-motion`**: Detected via `useReducedMotion()`. When active, skip all springs and show the athlete image statically with a subtle opacity blend — no motion at all

## Accessibility

- Base image: `aria-hidden="true"` (decorative)
- Reveal image: descriptive `alt` text
- `prefers-reduced-motion`: all animation disabled, static athlete image shown
- Text overlay maintains WCAG AA contrast ratio via gradient overlays
- CTA button fully focusable and keyboard-accessible
- Gyroscope permission only requested after explicit user tap; denial gracefully falls back to auto-animation
- No essential information conveyed solely through the hover interaction — text carries all meaning

## Testing Considerations

- Verify mask renders correctly on Chrome, Firefox, Safari (both webkit-prefixed and unprefixed)
- Test `prefers-reduced-motion` fallback shows static image
- Test gyroscope on iOS (permission grant + denial flows) and Android
- Test auto-animation fallback when gyro is unavailable or denied
- Test touch interaction on mobile overlays and overrides gyro/auto-animation
- Verify text readability with both images visible through the mask
- Verify hero height on various viewports (100svh behavior on mobile browsers)
- Verify header overlay positioning and contrast against hero images
- Performance: no jank on mouse movement (check via DevTools Performance panel)
