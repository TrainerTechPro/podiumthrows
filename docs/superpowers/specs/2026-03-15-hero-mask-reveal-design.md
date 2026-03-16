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
| 0 | Base image (stadium at dusk) | Always visible, Next.js `<Image>` with `priority` |
| 1 | Reveal image (athlete mid-release) | Masked by `radial-gradient`, only visible under cursor |
| 2 | Dark overlay gradients | Left→right (85%→transparent) + bottom→top for text readability |
| 3 | Hero text + CTA | Headline, subhead, divider, CTA button. `pointer-events: auto` |

### New File: `src/components/marketing/HeroMaskReveal.tsx`

~150 lines. `"use client"` component.

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

- Import `HeroMaskReveal` from `@/components/marketing/HeroMaskReveal`
- Replace the existing `<section>` hero block (lines ~69–128) with `<HeroMaskReveal>`
- Pass existing headline/CTA markup as `children`
- All other sections remain untouched

### Asset Files

- `public/images/hero-stadium.jpg` — stadium/competition ring at dusk
- `public/images/hero-athlete.jpg` — thrower mid-release, matching composition

These need to be provided or sourced from Unsplash as placeholders initially.

## CSS Mask Technique

The reveal image layer uses a dynamic CSS `mask-image`:

```css
-webkit-mask-image: radial-gradient(
  circle {radius}px at {x}px {y}px,
  black 0%,
  rgba(0,0,0,0.6) 50%,    /* soft mid-zone */
  rgba(0,0,0,0.1) 80%,    /* feathered edge */
  transparent 100%          /* fully hidden */
);
```

- `x`, `y` are Framer Motion `useSpring` values tracking cursor position
- `radius` is a spring value derived from cursor velocity
- Applied via inline `style` prop for GPU compositing (no layout/paint thrash)
- Uses `-webkit-` prefix for Safari compatibility

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
Slower spring so the radius swells and shrinks organically. Fed by `useVelocity` on the cursor position springs. Maps velocity → radius:
- Still cursor: ~100px radius
- Medium speed: ~200px radius
- Fast movement: ~350px radius

### 3. Parallax Spring
```
{ stiffness: 50, damping: 30 }
```
Both images shift subtly based on cursor position relative to center:
- Base image: ~10px offset
- Reveal image: ~20px offset (opposite direction)
Creates a sense of depth between the layers.

## Layout

### Desktop (≥1024px)
- Full viewport height (`100svh`)
- Full-bleed images edge-to-edge
- Text anchored left (max-width ~640px) with `padding: 80px 60px`
- Double gradient overlay: left→right for text, bottom→top for section transition
- Header overlays the top of the hero

### Mobile (<1024px)
- Full viewport height (`100svh`)
- Text stacked at bottom with heavier overlay gradient
- Full-width CTA button
- Reduced subhead text for space

## Platform Behavior

### Desktop (mouse)
Mouse cursor drives mask position. Dynamic radius from `useVelocity`. Parallax on both layers.

### Mobile with Gyroscope
- `DeviceOrientationEvent` API drives mask position
- Beta (front-back tilt) → Y position
- Gamma (left-right tilt) → X position
- iOS requires explicit permission request via `DeviceOrientationEvent.requestPermission()` — triggered on first user tap, never auto-prompted
- Sensitivity scaled so ±15° of tilt covers the full hero area

### Mobile Fallback (no gyro)
- Auto-animated loop: mask position follows a slow figure-8 Lissajous curve
- `x = centerX + A * sin(t * 0.3)`
- `y = centerY + B * sin(t * 0.5)`
- Radius gently oscillates between minRadius and midpoint
- Creates a mesmerizing ambient effect without interaction

### Mouse Leave
When cursor exits the hero area, the mask opacity fades to 0 over ~400ms via a spring transition. Stadium image returns cleanly.

## Performance

- **No React re-renders on mouse move**: All animation values use `useMotionValue` and `useSpring`, which bypass React's render cycle
- **GPU compositing**: CSS `mask-image` is composited on the GPU — no layout or paint thrash
- **Next.js Image optimization**: Both images use `<Image>` with `priority`, `sizes`, and appropriate format optimization
- **`requestAnimationFrame` throttle**: Velocity calculation capped to rAF for consistent 60fps
- **`prefers-reduced-motion`**: Detected via `useReducedMotion()`. When active, skip all springs and show the athlete image statically with a subtle opacity blend — no motion at all

## Accessibility

- Base image: `aria-hidden="true"` (decorative)
- Reveal image: descriptive `alt` text
- `prefers-reduced-motion`: all animation disabled, static athlete image shown
- Text overlay maintains WCAG AA contrast ratio via gradient overlays
- CTA button fully focusable and keyboard-accessible
- Gyroscope permission only requested after explicit user tap
- No essential information conveyed solely through the hover interaction — text carries all meaning

## Testing Considerations

- Verify mask renders correctly on Chrome, Firefox, Safari (webkit prefix)
- Test `prefers-reduced-motion` fallback shows static image
- Test gyroscope on iOS (permission flow) and Android
- Test auto-animation fallback when gyro is unavailable
- Verify text readability with both images visible through the mask
- Verify hero height on various viewports (100svh behavior on mobile browsers)
- Performance: no jank on mouse movement (check via DevTools Performance panel)
