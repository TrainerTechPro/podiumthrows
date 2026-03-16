# Hero Mask Reveal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static landing page hero with a cursor-reactive hover mask reveal that dynamically swaps between a stadium image and an athlete mid-release, using spring physics for organic motion.

**Architecture:** Single `"use client"` component (`HeroMaskReveal`) using Framer Motion springs for cursor tracking, velocity-based dynamic radius, and CSS `mask-image` for GPU-composited reveal. The component handles desktop mouse, mobile touch, gyroscope, and auto-animation fallback. `page.tsx` remains a Server Component.

**Tech Stack:** Next.js 14.2 (App Router), React 18, TypeScript, Framer Motion 12, Tailwind CSS 3.4, CSS `mask-image`

**Spec:** `docs/superpowers/specs/2026-03-15-hero-mask-reveal-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| CREATE | `src/components/marketing/HeroMaskReveal.tsx` | All mask reveal logic: springs, parallax, gyro, touch, auto-animation, reduced motion |
| CREATE | `public/images/hero-stadium.jpg` | Base image — downloaded from Unsplash |
| CREATE | `public/images/hero-athlete.jpg` | Reveal image — downloaded from Unsplash |
| MODIFY | `src/app/page.tsx` | Replace static hero with `<HeroMaskReveal>`, make header absolute |

---

## Chunk 1: Assets & Core Component

### Task 1: Download placeholder hero images

**Files:**
- Create: `public/images/hero-stadium.jpg`
- Create: `public/images/hero-athlete.jpg`

- [ ] **Step 1: Create the images directory**

```bash
mkdir -p public/images
```

- [ ] **Step 2: Download stadium placeholder from Unsplash**

Download a dark stadium/track & field image. Use a landscape image at least 2560px wide.

```bash
curl -L "https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=2560&q=80" -o public/images/hero-stadium.jpg
```

If that specific image is unavailable, search Unsplash for "track and field stadium dusk" and download any suitable dark stadium image.

- [ ] **Step 3: Download athlete placeholder from Unsplash**

Download a throws athlete action shot.

```bash
curl -L "https://images.unsplash.com/photo-1569517282132-25d22f4573e6?w=2560&q=80" -o public/images/hero-athlete.jpg
```

If unavailable, search for "shot put athlete" or "discus throw" and download any suitable action image.

- [ ] **Step 4: Verify images exist and have reasonable size**

```bash
ls -lh public/images/hero-stadium.jpg public/images/hero-athlete.jpg
```

Expected: Both files exist, each 200KB–2MB.

- [ ] **Step 5: Commit**

```bash
git add public/images/hero-stadium.jpg public/images/hero-athlete.jpg
git commit -m "assets: add placeholder hero images for mask reveal"
```

---

### Task 2: Create HeroMaskReveal component — static layer stack

Build the component shell with all four layers (base image, reveal image, gradient overlays, children) but no interactivity yet. This validates the visual layout.

**Files:**
- Create: `src/components/marketing/HeroMaskReveal.tsx`

- [ ] **Step 1: Create the component with static layers**

```tsx
"use client";

import { useRef } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";

interface HeroMaskRevealProps {
  baseImage: string;
  revealImage: string;
  baseAlt: string;
  revealAlt: string;
  minRadius?: number;
  maxRadius?: number;
  children: React.ReactNode;
}

export default function HeroMaskReveal({
  baseImage,
  revealImage,
  baseAlt,
  revealAlt,
  minRadius = 100,
  maxRadius = 350,
  children,
}: HeroMaskRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: "100svh" }}
      aria-label="Hero"
    >
      {/* Layer 0: Base image */}
      <div className="absolute inset-0" aria-hidden="true">
        <Image
          src={baseImage}
          alt={baseAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>

      {/* Layer 1: Reveal image (masked) */}
      <div
        className="absolute inset-0"
        style={{
          opacity: shouldReduceMotion ? 1 : 0,
          WebkitMaskImage: shouldReduceMotion
            ? undefined
            : "radial-gradient(circle 0px at -100px -100px, black 0%, transparent 100%)",
          maskImage: shouldReduceMotion
            ? undefined
            : "radial-gradient(circle 0px at -100px -100px, black 0%, transparent 100%)",
        }}
      >
        <Image
          src={revealImage}
          alt={revealAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>

      {/* Layer 2: Dark overlay gradients */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            linear-gradient(to right, rgba(8,8,10,0.85) 0%, rgba(8,8,10,0.6) 40%, rgba(8,8,10,0.1) 70%, transparent 100%),
            linear-gradient(to top, rgba(8,8,10,0.9) 0%, transparent 40%)
          `,
        }}
      />
      {/* Extra mobile gradient: heavier bottom overlay for text readability */}
      <div
        className="absolute inset-0 pointer-events-none lg:hidden"
        aria-hidden="true"
        style={{
          background: "linear-gradient(to top, rgba(8,8,10,0.95) 0%, rgba(8,8,10,0.7) 50%, rgba(8,8,10,0.4) 100%)",
        }}
      />

      {/* Layer 3: Content overlay — centered on desktop, bottom-aligned on mobile */}
      <div className="relative z-10 h-full flex items-end lg:items-center">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 w-full pb-12 lg:pb-0">
          {children}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors (or only pre-existing errors unrelated to this file).

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/HeroMaskReveal.tsx
git commit -m "feat: add HeroMaskReveal component shell with static layer stack"
```

---

### Task 3: Wire HeroMaskReveal into page.tsx

Replace the static hero section and make the header overlay the hero.

**Files:**
- Modify: `src/app/page.tsx:1-128`

- [ ] **Step 1: Update page.tsx — add import, replace hero, make header absolute**

At the top of `page.tsx`, add the import:

```tsx
import HeroMaskReveal from "@/components/marketing/HeroMaskReveal";
```

Replace the `<header>` block (lines 45–66) — change `relative` to `absolute top-0 left-0 right-0 z-20`:

```tsx
      <header className="w-full absolute top-0 left-0 right-0 z-20">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group" aria-label="Podium Throws home">
            <Image
              src="/logo.png"
              alt="Podium Throws"
              width={28}
              height={28}
              className="w-7 h-7 opacity-90 group-hover:opacity-100 transition-opacity"
            />
            <span className="font-heading font-semibold text-[15px] text-[#e8e4dc]/80 tracking-tight group-hover:text-[#e8e4dc] transition-colors">
              Podium Throws
            </span>
          </Link>
          <Link
            href="/login"
            className="text-[13px] font-medium text-[#e8e4dc]/50 hover:text-[#e8e4dc] transition-colors duration-300"
          >
            Sign In
          </Link>
        </div>
      </header>
```

Replace the entire hero `<section>` (lines 69–128, including the "2–4" background texture) with:

```tsx
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <HeroMaskReveal
        baseImage="/images/hero-stadium.jpg"
        revealImage="/images/hero-athlete.jpg"
        baseAlt="Track and field stadium at dusk"
        revealAlt="Throws athlete mid-release"
      >
        <div className="relative max-w-3xl pt-20">
          {/* Label */}
          <p className="font-heading text-[11px] uppercase tracking-[0.3em] text-primary-500 mb-10 sm:mb-14">
            Free diagnostic
          </p>

          {/* Headline */}
          <h1
            className="font-heading font-black leading-[0.88] tracking-[-0.035em] mb-8"
            style={{ fontSize: "clamp(2.8rem, 8vw, 5.5rem)" }}
          >
            Your thrower is leaving
            <br />
            <span className="text-primary-500">2–4&nbsp;meters</span>
            <br />
            on the table.
          </h1>

          {/* Divider */}
          <div className="w-16 h-[2px] bg-primary-500/40 mb-8" aria-hidden="true" />

          {/* Subhead — hidden on smallest screens for space */}
          <p className="hidden sm:block text-[17px] sm:text-lg leading-[1.7] text-[#7a746b] max-w-md mb-14">
            Strength deficit, technique gap, or wrong implement sequence?
            Find out in 60 seconds — with a corrective recommendation.
          </p>
          <p className="sm:hidden text-[15px] leading-[1.7] text-[#7a746b] mb-10">
            Find out in 60 seconds — with a corrective recommendation.
          </p>

          {/* CTA — full-width on mobile */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-5">
            <Link
              href="/deficit-finder"
              className="group relative font-heading font-bold text-[15px] px-10 py-4 bg-primary-500 text-[#08080a] transition-all duration-300 hover:bg-primary-400 active:scale-[0.97] text-center sm:text-left"
            >
              <span className="relative z-10">Find the Deficit</span>
            </Link>
            <span className="text-[12px] text-[#444039] leading-relaxed self-center text-center sm:text-left">
              No account needed<br className="sm:hidden" />
              <span className="hidden sm:inline">&ensp;/&ensp;</span>
              Based on Bondarchuk research
            </span>
          </div>
        </div>
      </HeroMaskReveal>
```

Keep the `Image` import from `next/image` — the header logo still uses `<Image>`. Keep the `Link` import.

Note: The Sign In link color changes from `text-[#555048]` to `text-[#e8e4dc]/50` because the header now overlays hero images instead of a solid dark background — the darker color would be invisible.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Verify page loads in browser**

```bash
npm run dev
```

Open `http://localhost:3000`. Verify:
- Hero takes full viewport height
- Base image visible (stadium)
- Header overlays the top of the hero with readable text
- Headline, subhead, CTA all visible and readable over the gradient overlay
- Sections below hero (What you'll learn, Methodology, Final CTA, Footer) are unchanged

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire HeroMaskReveal into landing page, make header absolute"
```

---

## Chunk 2: Desktop Mouse Interaction

### Task 4: Add cursor tracking with spring physics

Add mouse event handling, spring-animated cursor position, and dynamic mask.

**Files:**
- Modify: `src/components/marketing/HeroMaskReveal.tsx`

- [ ] **Step 1: Add spring-based cursor tracking and mask rendering**

Replace the entire `HeroMaskReveal.tsx` with the version that adds mouse interaction. The key additions:

1. Import `useMotionValue`, `useSpring`, `useTransform`, `useVelocity`, `motion` from `framer-motion`
2. Track mouse position with `useMotionValue` (no re-renders)
3. Apply spring physics to cursor position for liquid lag
4. Calculate velocity magnitude from x/y velocity
5. Map velocity to dynamic radius via spring
6. Track mask visibility for mouse enter/leave fade
7. Render the reveal layer with `useTransform` to build the mask string
8. Add parallax offsets to both image layers

```tsx
"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
  useReducedMotion,
} from "framer-motion";

interface HeroMaskRevealProps {
  baseImage: string;
  revealImage: string;
  baseAlt: string;
  revealAlt: string;
  minRadius?: number;
  maxRadius?: number;
  children: React.ReactNode;
}

const CURSOR_SPRING = { stiffness: 150, damping: 15, mass: 0.5 };
const RADIUS_SPRING = { stiffness: 100, damping: 20, mass: 0.8 };
const PARALLAX_SPRING = { stiffness: 50, damping: 30 };
const MAX_VELOCITY = 1500;

export default function HeroMaskReveal({
  baseImage,
  revealImage,
  baseAlt,
  revealAlt,
  minRadius = 100,
  maxRadius = 350,
  children,
}: HeroMaskRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Raw cursor position (no spring)
  const rawX = useMotionValue(-200);
  const rawY = useMotionValue(-200);

  // Spring-animated cursor position (liquid lag)
  const springX = useSpring(rawX, CURSOR_SPRING);
  const springY = useSpring(rawY, CURSOR_SPRING);

  // Velocity tracking for dynamic radius
  const velocityX = useVelocity(springX);
  const velocityY = useVelocity(springY);

  // Dynamic radius driven by velocity magnitude
  const targetRadius = useMotionValue(minRadius);
  const springRadius = useSpring(targetRadius, RADIUS_SPRING);

  // Mask visibility (fade in/out on enter/leave)
  const maskOpacity = useMotionValue(0);
  const springMaskOpacity = useSpring(maskOpacity, { stiffness: 200, damping: 30 });

  // Parallax offsets
  const parallaxBaseX = useSpring(useMotionValue(0), PARALLAX_SPRING);
  const parallaxBaseY = useSpring(useMotionValue(0), PARALLAX_SPRING);
  const parallaxRevealX = useSpring(useMotionValue(0), PARALLAX_SPRING);
  const parallaxRevealY = useSpring(useMotionValue(0), PARALLAX_SPRING);

  // Update radius based on velocity (rAF-throttled)
  useEffect(() => {
    if (shouldReduceMotion) return;

    let rafId: number;
    const update = () => {
      const vx = velocityX.get();
      const vy = velocityY.get();
      const speed = Math.sqrt(vx * vx + vy * vy);
      const t = Math.min(speed / MAX_VELOCITY, 1);
      targetRadius.set(minRadius + t * (maxRadius - minRadius));
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [shouldReduceMotion, velocityX, velocityY, targetRadius, minRadius, maxRadius]);

  // Build the CSS mask string from spring values
  const maskImage = useTransform(
    [springX, springY, springRadius, springMaskOpacity],
    ([x, y, r, opacity]: number[]) => {
      if (opacity < 0.01) return "none";
      return `radial-gradient(circle ${r}px at ${x}px ${y}px, rgba(0,0,0,${opacity}) 0%, rgba(0,0,0,${opacity * 0.6}) 50%, rgba(0,0,0,${opacity * 0.1}) 80%, transparent 100%)`;
    }
  );

  // Build parallax transform strings
  const baseTransform = useTransform(
    [parallaxBaseX, parallaxBaseY],
    ([px, py]: number[]) => `translate(${px}px, ${py}px)`
  );
  const revealTransform = useTransform(
    [parallaxRevealX, parallaxRevealY],
    ([px, py]: number[]) => `translate(${px}px, ${py}px)`
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (shouldReduceMotion) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      rawX.set(x);
      rawY.set(y);

      // Parallax: offset based on cursor distance from center
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const px = ((x - cx) / cx) * 10; // ±10px for base
      const py = ((y - cy) / cy) * 10;
      parallaxBaseX.set(px);
      parallaxBaseY.set(py);
      parallaxRevealX.set(-px * 2); // ±20px for reveal (opposite)
      parallaxRevealY.set(-py * 2);
    },
    [shouldReduceMotion, rawX, rawY, parallaxBaseX, parallaxBaseY, parallaxRevealX, parallaxRevealY]
  );

  const handleMouseEnter = useCallback(() => {
    if (shouldReduceMotion) return;
    maskOpacity.set(1);
  }, [shouldReduceMotion, maskOpacity]);

  const handleMouseLeave = useCallback(() => {
    if (shouldReduceMotion) return;
    maskOpacity.set(0);
    parallaxBaseX.set(0);
    parallaxBaseY.set(0);
    parallaxRevealX.set(0);
    parallaxRevealY.set(0);
  }, [shouldReduceMotion, maskOpacity, parallaxBaseX, parallaxBaseY, parallaxRevealX, parallaxRevealY]);

  // ── Reduced motion: static athlete image ──
  if (shouldReduceMotion) {
    return (
      <section
        className="relative w-full overflow-hidden"
        style={{ height: "100svh" }}
        aria-label="Hero"
      >
        <div className="absolute inset-0">
          <Image src={revealImage} alt={revealAlt} fill priority sizes="100vw" className="object-cover" />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: `
              linear-gradient(to right, rgba(8,8,10,0.85) 0%, rgba(8,8,10,0.6) 40%, rgba(8,8,10,0.1) 70%, transparent 100%),
              linear-gradient(to top, rgba(8,8,10,0.9) 0%, transparent 40%)
            `,
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none lg:hidden"
          aria-hidden="true"
          style={{
            background: "linear-gradient(to top, rgba(8,8,10,0.95) 0%, rgba(8,8,10,0.7) 50%, rgba(8,8,10,0.4) 100%)",
          }}
        />
        <div className="relative z-10 h-full flex items-end lg:items-center">
          <div className="max-w-[1200px] mx-auto px-6 sm:px-10 w-full pb-12 lg:pb-0">{children}</div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={containerRef}
      className="relative w-full overflow-hidden cursor-none"
      style={{ height: "100svh" }}
      aria-label="Hero"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Layer 0: Base image with parallax */}
      <motion.div
        className="absolute inset-[-20px]"
        style={{ transform: baseTransform }}
        aria-hidden="true"
      >
        <Image src={baseImage} alt={baseAlt} fill priority sizes="100vw" className="object-cover" />
      </motion.div>

      {/* Layer 1: Reveal image (masked) with parallax */}
      <motion.div
        className="absolute inset-[-20px]"
        style={{
          transform: revealTransform,
          WebkitMaskImage: maskImage,
          maskImage: maskImage,
          willChange: "mask-image",
        }}
      >
        <Image src={revealImage} alt={revealAlt} fill priority sizes="100vw" className="object-cover" />
      </motion.div>

      {/* Layer 2: Dark overlay gradients */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            linear-gradient(to right, rgba(8,8,10,0.85) 0%, rgba(8,8,10,0.6) 40%, rgba(8,8,10,0.1) 70%, transparent 100%),
            linear-gradient(to top, rgba(8,8,10,0.9) 0%, transparent 40%)
          `,
        }}
      />
      {/* Extra mobile gradient: heavier bottom overlay */}
      <div
        className="absolute inset-0 pointer-events-none lg:hidden"
        aria-hidden="true"
        style={{
          background: "linear-gradient(to top, rgba(8,8,10,0.95) 0%, rgba(8,8,10,0.7) 50%, rgba(8,8,10,0.4) 100%)",
        }}
      />

      {/* Layer 3: Content overlay — bottom-aligned on mobile, centered on desktop */}
      <div className="relative z-10 h-full flex items-end lg:items-center">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 w-full pb-12 lg:pb-0">{children}</div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Test in browser**

```bash
npm run dev
```

Open `http://localhost:3000`. Verify:
- Moving mouse over hero reveals athlete image through the circular mask
- Mask follows cursor with a smooth, springy lag (not instant snap)
- Faster mouse movement creates a larger reveal radius
- Stopping the mouse shrinks the radius back down
- Both images shift subtly in opposite directions as cursor moves (parallax)
- Mouse leaving the hero fades the mask out cleanly
- Text and CTA remain readable over the gradient overlay
- Cursor is hidden (`cursor-none`) within the hero area

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/HeroMaskReveal.tsx
git commit -m "feat: add cursor tracking, spring physics, dynamic radius, and parallax to hero mask reveal"
```

---

## Chunk 3: Mobile — Touch, Gyroscope & Auto-Animation

### Task 5: Add touch, gyroscope, and auto-animation fallback

Add mobile interaction modes: touch-drag drives mask, gyroscope tilts drive mask, and Lissajous auto-animation as final fallback.

**Files:**
- Modify: `src/components/marketing/HeroMaskReveal.tsx`

- [ ] **Step 1: Add mobile interaction logic**

Add these blocks to `HeroMaskReveal.tsx`:

**A) Add state for input mode detection** (after the existing spring declarations):

```tsx
  // Mobile input mode: "mouse" | "touch" | "gyro" | "auto"
  const [inputMode, setInputMode] = useState<"mouse" | "touch" | "gyro" | "auto">("mouse");
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const touchActiveRef = useRef(false);
```

**B) Add touch handlers** (after `handleMouseLeave`):

```tsx
  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (shouldReduceMotion) return;
      const touch = e.touches[0];
      if (!touch) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      touchActiveRef.current = true;
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      rawX.set(x);
      rawY.set(y);
      maskOpacity.set(1);

      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const px = ((x - cx) / cx) * 10;
      const py = ((y - cy) / cy) * 10;
      parallaxBaseX.set(px);
      parallaxBaseY.set(py);
      parallaxRevealX.set(-px * 2);
      parallaxRevealY.set(-py * 2);
    },
    [shouldReduceMotion, rawX, rawY, maskOpacity, parallaxBaseX, parallaxBaseY, parallaxRevealX, parallaxRevealY]
  );

  const handleTouchEnd = useCallback(() => {
    touchActiveRef.current = false;
    // Don't fade mask on mobile — gyro/auto keeps it visible
  }, []);
```

**C) Add gyroscope setup** (as a new `useEffect`):

```tsx
  // Gyroscope input
  useEffect(() => {
    if (shouldReduceMotion) return;
    if (typeof window === "undefined") return;

    // Only activate on mobile/tablet
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (!isMobile) return;

    setInputMode("auto"); // Start with auto-animation on mobile

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (touchActiveRef.current) return; // Touch takes priority
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const beta = e.beta ?? 0;   // front-back tilt: -180 to 180
      const gamma = e.gamma ?? 0; // left-right tilt: -90 to 90

      // Map ±15° to full hero area
      const clampedBeta = Math.max(-15, Math.min(15, beta - 45)); // center around ~45° (natural phone hold)
      const clampedGamma = Math.max(-15, Math.min(15, gamma));

      const x = ((clampedGamma + 15) / 30) * rect.width;
      const y = ((clampedBeta + 15) / 30) * rect.height;

      rawX.set(x);
      rawY.set(y);
      maskOpacity.set(1);

      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const px = ((x - cx) / cx) * 10;
      const py = ((y - cy) / cy) * 10;
      parallaxBaseX.set(px);
      parallaxBaseY.set(py);
      parallaxRevealX.set(-px * 2);
      parallaxRevealY.set(-py * 2);
    };

    const requestGyro = async () => {
      try {
        // iOS requires explicit permission
        if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
          const permission = await (DeviceOrientationEvent as any).requestPermission();
          if (permission !== "granted") {
            setGyroAvailable(false);
            return;
          }
        }
        setGyroAvailable(true);
        setInputMode("gyro");
        window.addEventListener("deviceorientation", handleOrientation);
      } catch {
        setGyroAvailable(false);
      }
    };

    // On iOS, we need a user gesture to request permission
    // Try without permission first (Android), then set up tap-to-enable for iOS
    if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
      // iOS — wait for user tap
      const tapHandler = () => {
        requestGyro();
        document.removeEventListener("touchstart", tapHandler);
      };
      document.addEventListener("touchstart", tapHandler, { once: true });
      return () => {
        document.removeEventListener("touchstart", tapHandler);
        window.removeEventListener("deviceorientation", handleOrientation);
      };
    } else {
      // Android / desktop — try directly
      requestGyro();
      return () => {
        window.removeEventListener("deviceorientation", handleOrientation);
      };
    }
  }, [shouldReduceMotion, rawX, rawY, maskOpacity, parallaxBaseX, parallaxBaseY, parallaxRevealX, parallaxRevealY]);
```

**D) Add auto-animation fallback** (as a new `useEffect`):

```tsx
  // Auto-animation fallback (Lissajous figure-8)
  useEffect(() => {
    if (shouldReduceMotion) return;
    if (typeof window === "undefined") return;

    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (!isMobile) return;

    let rafId: number;
    const startTime = performance.now();

    const animate = () => {
      // Don't auto-animate if touch is active or gyro is driving
      if (touchActiveRef.current || (gyroAvailable && inputMode === "gyro")) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      const t = (performance.now() - startTime) / 1000;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const ax = rect.width * 0.25;
      const ay = rect.height * 0.2;

      const x = cx + ax * Math.sin(t * 0.3);
      const y = cy + ay * Math.sin(t * 0.5);

      rawX.set(x);
      rawY.set(y);
      maskOpacity.set(0.7);

      // Gentle radius oscillation
      const midRadius = (minRadius + maxRadius) / 2;
      targetRadius.set(minRadius + (midRadius - minRadius) * (0.5 + 0.5 * Math.sin(t * 0.4)));

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [shouldReduceMotion, gyroAvailable, inputMode, rawX, rawY, maskOpacity, targetRadius, minRadius, maxRadius]);
```

**E) Add touch event handlers to the `<section>` element:**

Add `onTouchMove={handleTouchMove}` and `onTouchEnd={handleTouchEnd}` to the main `<section>` element alongside the existing mouse handlers.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Test desktop behavior unchanged**

```bash
npm run dev
```

Open `http://localhost:3000` on desktop. Verify all existing mouse behavior still works identically.

- [ ] **Step 4: Test mobile behavior**

Open `http://localhost:3000` on a mobile device (or Chrome DevTools mobile emulation with device orientation simulation):

- **Auto-animation**: On load (without gyro), the mask should drift in a slow figure-8 pattern
- **Touch**: Touching and dragging should override auto-animation and drive the mask
- **Touch end**: Releasing touch should resume auto-animation
- **Gyroscope** (real device only): Tilting the device should move the mask position

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/HeroMaskReveal.tsx
git commit -m "feat: add touch, gyroscope, and auto-animation fallback for mobile hero mask reveal"
```

---

### Task 6: Final verification and typecheck

**Files:**
- All files from Tasks 1-5

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Expected: 0 errors (warnings acceptable).

- [ ] **Step 3: Full browser verification checklist**

Open `http://localhost:3000` and verify:

1. Hero takes full viewport height (`100svh`)
2. Stadium image visible as base layer
3. Mouse hover reveals athlete image with springy circular mask
4. Faster mouse = larger reveal radius
5. Mask fades out when mouse leaves hero
6. Parallax depth effect on both image layers
7. Header overlays hero top, text is readable
8. Headline, subhead, CTA all readable over gradient
9. CTA button clickable and navigates to `/deficit-finder`
10. Sections below hero completely unchanged
11. `prefers-reduced-motion`: only athlete image shown, no animation (test via browser settings or `window.matchMedia` override)

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add src/components/marketing/HeroMaskReveal.tsx src/app/page.tsx
git commit -m "fix: address any issues found during final verification"
```

(Skip this step if no fixes were needed.)
