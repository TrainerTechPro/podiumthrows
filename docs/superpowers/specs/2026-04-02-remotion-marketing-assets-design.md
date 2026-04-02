# Remotion Marketing Assets — Design Spec

> **Date**: 2026-04-02
> **Status**: Draft
> **Scope**: Modular Remotion project producing 7 marketing assets (video + stills) for Podium Throws, driven entirely by the design system.

---

## Overview

A standalone Remotion project in `marketing/` that produces a full marketing asset kit — hero reel, feature loops, social ads, and thumbnails. All compositions share a common design-system layer extracted from `design-system.md`. No real footage — everything is UI-driven motion graphics.

**Output formats:**

| # | Composition ID | Dimensions | Duration | Loop | Audience |
|---|---------------|-----------|----------|------|----------|
| 1 | `HeroReel` | 1920×1080 | 30s | No | Landing page visitors |
| 2 | `FeatureLoop-Programming` | 1080×1080 | 8s | Yes | Coaches (social) |
| 3 | `FeatureLoop-PoseAnalysis` | 1080×1080 | 8s | Yes | Coaches (social) |
| 4 | `FeatureLoop-PRTracking` | 1080×1080 | 8s | Yes | Athletes (social) |
| 5 | `InstagramReel` | 1080×1920 | 15s | No | General (vertical) |
| 6 | `SocialAd-CoachPitch` | 1920×1080 | 15s | No | Coaches / ADs |
| 7 | `Thumbnail` (Still) | 1280×720 | — | — | YouTube / OG image |

**FPS**: 30 for all compositions (standard web video).

---

## Design Language

All visual decisions come from `design-system.md`. Key tokens:

### Colors

```
Background:     #0a0a0c (surface-900)
Surface:        #101016 (surface-800)
Card BG:        rgba(255,255,255,0.04)
Card Border:    rgba(255,200,0,0.12)
Gold:           #FFC800 (primary-500)
Gold Dim:       rgba(255,200,0,0.08)
Muted Text:     #838390

Success:        #00FF88
Warning:        #FF8800
Danger:         #FF2222
Info:           #4488FF

Shot Put:       #D4915A
Discus:         #6A9FD8
Hammer:         #5BB88A
Javelin:        #D46A6A
```

### Typography

- **Headings**: Chakra Petch (700 bold, 600 semibold) — via `@remotion/google-fonts/ChakraPetch`
- **Body**: DM Sans (400 regular, 500 medium) — via `@remotion/google-fonts/DMSans`
- **Data**: IBM Plex Mono (500 medium) — via `@remotion/google-fonts/IBMPlexMono`

### Signature Visual Elements

- **Cut-corner clip-paths**: Cards and panels use polygon cuts (12px default)
- **Gold glow**: `0 0 20px rgba(255,200,0,0.2)` on key elements
- **Noise grain**: Subtle fractal noise overlay at 2-3% opacity on backgrounds
- **Status indicators**: Colored dots (green/amber/red) with symbol (✓/~/!)
- **Staggered data reveals**: Elements enter with 5-frame (166ms) stagger delays

### Animation Conventions

All animations driven by `useCurrentFrame()` + `spring()` / `interpolate()`. No CSS animations.

| Motion Type | Spring Config | Usage |
|------------|--------------|-------|
| Smooth reveal | `{ damping: 200 }` | UI panels, cards sliding in |
| Snappy data | `{ damping: 20, stiffness: 200 }` | Numbers counting, bars growing |
| Bouncy entrance | `{ damping: 8 }` | PR celebration, logo stinger |
| Heavy settle | `{ damping: 15, stiffness: 80, mass: 2 }` | Large elements landing |

---

## Shared Components

These are reusable across all compositions. Located in `marketing/src/components/`.

### `<Background>`

Dark base with animated grain effect and optional gold vignette glow.

**Props:**
- `grain?: boolean` (default: true) — subtle noise texture
- `vignette?: boolean` (default: true) — radial gold glow from center
- `vignetteIntensity?: number` (default: 0.07)

**Implementation:**
- Base: `#0a0a0c` fill
- Grain: SVG `<feTurbulence>` filter with low opacity, static (no animation needed)
- Vignette: Radial gradient from `rgba(255,200,0, intensity)` at center to transparent

### `<CutCornerCard>`

Animated card with clip-path polygon corners and gold border glow.

**Props:**
- `width: number`, `height: number`
- `enterDelay?: number` (frames) — staggered entrance
- `glowOnReveal?: boolean` — pulse gold glow on entrance
- `cutSize?: number` (default: 12)
- `children: ReactNode`

**Animation:**
- Entrance: spring translateY 40px → 0, opacity 0 → 1, with `damping: 200`
- Glow: If enabled, gold boxShadow fades from `0 0 30px rgba(255,200,0,0.3)` to `0 0 20px rgba(255,200,0,0.1)` over 20 frames after entrance

### `<GoldText>`

Chakra Petch heading with gold color and optional glow shadow.

**Props:**
- `text: string`
- `fontSize?: number` (default: 64)
- `glow?: boolean` (default: true)
- `enterDelay?: number` (frames)

**Animation:**
- Entrance: spring scale 0.9 → 1, opacity 0 → 1 with `damping: 200`
- Glow: `textShadow: 0 0 40px rgba(255,200,0,0.3)`

### `<DataReveal>`

IBM Plex Mono number that counts up from 0 to target value.

**Props:**
- `value: number`
- `suffix?: string` (e.g., "°", "m", "kg")
- `prefix?: string` (e.g., "$")
- `decimals?: number` (default: 0)
- `color?: string` (default: `#FFC800`)
- `fontSize?: number` (default: 48)
- `enterDelay?: number` (frames)
- `countDuration?: number` (frames, default: 30)

**Animation:**
- Count: `interpolate(frame, [delay, delay + countDuration], [0, value])` with `Easing.out(Easing.quad)` and clamp
- Entrance: opacity 0 → 1 over first 10 frames

### `<EventBar>`

Horizontal bar that grows from left with event-specific color.

**Props:**
- `event: "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN"`
- `percentage: number` (0-100)
- `label?: string`
- `count?: number`
- `enterDelay?: number` (frames)

**Animation:**
- Width: spring scaleX 0 → 1 with `transformOrigin: "left"`, `damping: 200`, stagger delay
- Label and count fade in 5 frames after bar completes

### `<AngleReadout>`

Simulated biomechanical angle measurement with status indicator.

**Props:**
- `label: string` (e.g., "Shoulder Separation")
- `degrees: number`
- `status: "optimal" | "marginal" | "concerning"`
- `enterDelay?: number` (frames)

**Rendering:**
- Status dot (colored circle) + status symbol (✓/~/!) + label + degree value
- Colors: optimal = `#00FF88`, marginal = `#FF8800`, concerning = `#FF2222`

**Animation:**
- Slide in from right (translateX 20px → 0), degree number counts up with `DataReveal`

### `<LogoStinger>`

"PODIUM THROWS" wordmark entrance.

**Props:**
- `variant?: "full" | "compact"` (default: "full")

**Animation (full variant):**
1. Frames 0-10: Gold horizontal line draws from center outward (scaleX 0 → 1)
2. Frames 8-20: "PODIUM" letters spring in from above (staggered 2-frame delay per letter)
3. Frames 12-24: "THROWS" letters spring in from below (staggered 2-frame delay per letter)
4. Frames 20-30: Gold glow pulse on full wordmark (opacity 0.5 → 0.2 → 0.1)
5. Cut-corner underline draws in from left

### `<TaglineSlide>`

Animated tagline with per-word fade-in.

**Props:**
- `text: string`
- `enterDelay?: number` (frames)
- `wordDelay?: number` (frames between words, default: 4)

**Animation:**
- Split text by spaces, each word fades in + translateY 10px → 0 with stagger
- Font: DM Sans 500, color `#838390` (muted), fontSize 24

### `<ConfettiBurst>`

Particle confetti explosion using the design system confetti colors.

**Props:**
- `triggerFrame: number` — frame to start burst
- `particleCount?: number` (default: 40)
- `colors?: string[]` (default: design system confetti palette)

**Animation:**
- Each particle: random angle, velocity, gravity (deceleration), rotation
- Colors from: `#FFC800, #FFD700, #FF8800, #FF2222, #00FF88, #4488FF, #AA44FF, #FF44AA, #ffffff`
- Duration: ~45 frames (1.5s) with particles fading out in last 15 frames

---

## Composition Breakdowns

### 1. HeroReel (1920×1080, 30s, 900 frames)

The flagship asset. Fast-paced feature montage showing the platform's power.

**Scene Timeline:**

| Scene | Frames | Duration | Content |
|-------|--------|----------|---------|
| **Logo Stinger** | 0–75 | 2.5s | LogoStinger (full) → black |
| **Tagline** | 60–135 | 2.5s | "Built for Elite Throws Coaching" fade in, hold, fade out |
| **Programming UI** | 120–270 | 5s | Weekly calendar grid with session cards sliding in, event-colored bars |
| **Pose Analysis** | 255–405 | 5s | Simulated skeleton wireframe over dark bg, angle readouts counting |
| **Dashboard Stats** | 390–540 | 5s | Stat cards with animated numbers, volume bar chart growing |
| **PR Celebration** | 525–645 | 4s | "18.42m" counting up → confetti burst → "NEW PERSONAL BEST" |
| **Event Montage** | 630–765 | 4.5s | 4 event bars with distances + athlete count, staggered entrance |
| **CTA** | 750–900 | 5s | "podiumthrows.com" with gold glow pulse, tagline below |

**Transitions**: 15-frame fades between scenes via `TransitionSeries`.

**Scene Details:**

**Programming UI scene:**
- Dark background with cut-corner card containing a 7-day grid
- Mon–Fri columns, each with 1-2 session cards that slide in from bottom with stagger
- Session cards show: event color stripe left, "AM Session" label, "Shot Put — 24 throws" text
- Week header: "March 10 – 16" in DM Sans

**Pose Analysis scene:**
- Left side: simplified skeleton wireframe (SVG lines + joint dots) on dark background
- Dashed arc at right elbow suggesting angle measurement
- Right side: 3 AngleReadouts staggering in:
  - "Shoulder Sep" → 42° (optimal, green)
  - "Hip-Shoulder" → 38° (optimal, green)
  - "Block Knee" → 156° (marginal, amber)

**Dashboard Stats scene:**
- 3 CutCornerCards in a row:
  - "Total Analyses" → DataReveal counting to 47
  - "Season PR Rate" → DataReveal counting to 73 + "%" suffix
  - "Avg Readiness" → DataReveal counting to 8.2 (1 decimal)
- Below: 4 EventBars showing event distribution (SP: 42%, DT: 28%, HT: 18%, JT: 12%)

**PR Celebration scene:**
- Large DataReveal "18.42m" in center (gold, 96px IBM Plex Mono)
- Below: "SHOT PUT" event badge
- Frame 15: ConfettiBurst triggers
- Frame 20: "NEW PERSONAL BEST" in Chakra Petch 48px, spring entrance from below
- Gold glow radiates from the number

**CTA scene:**
- "podiumthrows.com" in Chakra Petch 64px, gold color
- Below: "The coaching platform built for throws" in DM Sans 24px, muted color
- Gold glow on the URL pulses gently (opacity oscillation 0.15 → 0.25 over 60 frames)

---

### 2. FeatureLoop-Programming (1080×1080, 8s, 240 frames)

Instagram/social square loop showcasing the Bondarchuk programming engine.

| Frames | Content |
|--------|---------|
| 0–30 | "PROGRAMMING" heading springs in (Chakra Petch, gold) |
| 15–90 | Weekly calendar card slides up with 3 session rows staggering in |
| 75–150 | Session detail card expands: "AM Throwing Block" → event bars + throw counts |
| 135–210 | "Powered by Bondarchuk Methodology" tagline fades in (DM Sans, muted) |
| 195–240 | Everything fades out → seamless loop point |

**Loop technique**: Last 15 frames fade to black matching the first 15 frames fade from black.

---

### 3. FeatureLoop-PoseAnalysis (1080×1080, 8s, 240 frames)

Square loop showcasing pose detection and angle measurement.

| Frames | Content |
|--------|---------|
| 0–30 | "POSE ANALYSIS" heading springs in |
| 15–90 | Skeleton wireframe draws in (SVG path animation via `@remotion/paths`) |
| 60–150 | 3 angle readouts stagger in from right with degree counters |
| 120–180 | Dashed angle arc animates at the elbow joint |
| 150–210 | Status summary: "2 Optimal, 1 Marginal" with colored dots |
| 195–240 | Fade to black → loop |

---

### 4. FeatureLoop-PRTracking (1080×1080, 8s, 240 frames)

Square loop showing the PR celebration experience (athlete-facing).

| Frames | Content |
|--------|---------|
| 0–30 | "PERSONAL RECORDS" heading springs in |
| 15–75 | Distance trend line draws in (SVG path, 5 data points going up-right) |
| 60–90 | Last point pulses gold — "NEW PR" badge springs in above it |
| 75–150 | Center: "18.42m" counts up large (96px) + confetti burst |
| 135–210 | Below: "Season Best: Shot Put" + "↑ 0.34m improvement" |
| 195–240 | Fade to black → loop |

---

### 5. InstagramReel (1080×1920, 15s, 450 frames)

Vertical sizzle reel — fast energy, meant to stop the scroll.

| Frames | Content |
|--------|---------|
| 0–45 | Logo stinger (compact variant) |
| 30–120 | "BUILT FOR" → "ELITE" (large gold) → "THROWS COACHING" — staggered word entrance |
| 105–195 | 4 event cards (SP/DT/HT/JT) slide in from bottom, staggered 10 frames, each with event color + icon + name |
| 180–270 | Quick-cut stats: "47 Analyses" → "24 Athletes" → "12 PRs This Month" — each holds 30 frames |
| 255–360 | Angle readouts fan out from center (3 angles, staggered) |
| 345–450 | CTA: "podiumthrows.com" gold glow + "Start coaching smarter" tagline |

---

### 6. SocialAd-CoachPitch (1920×1080, 15s, 450 frames)

Horizontal ad targeting coaches and athletic directors.

| Frames | Content |
|--------|---------|
| 0–60 | Left: Logo stinger. Right: "The throws coaching platform that understands periodization" |
| 45–180 | Split screen — Left: programming calendar UI. Right: 3 bullet features fade in staggered: "Bondarchuk Methodology", "Real-time Pose Analysis", "Automated PR Detection" |
| 165–330 | Full-width dashboard mockup with animated stat cards + event bars |
| 315–450 | CTA: "podiumthrows.com" centered, "Free for up to 3 athletes" below, gold glow |

---

### 7. Thumbnail (Still, 1280×720)

Static OG image / video thumbnail.

**Composition:**
- Background: `#0a0a0c` with subtle gold vignette
- Left third: "PODIUM THROWS" wordmark (Chakra Petch 48px, gold) with cut-corner underline
- Center: 3 small stat cards fanned slightly (15° rotation each) — "47 Analyses", "8.2 Readiness", "12 PRs"
- Right third: Simplified skeleton wireframe with 2 angle readouts
- Bottom: "podiumthrows.com" in DM Sans 18px, muted

---

## Project Structure

```
marketing/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── src/
│   ├── Root.tsx                      # All composition registrations
│   ├── components/
│   │   ├── Background.tsx
│   │   ├── CutCornerCard.tsx
│   │   ├── GoldText.tsx
│   │   ├── DataReveal.tsx
│   │   ├── EventBar.tsx
│   │   ├── AngleReadout.tsx
│   │   ├── LogoStinger.tsx
│   │   ├── TaglineSlide.tsx
│   │   ├── ConfettiBurst.tsx
│   │   ├── SkeletonWireframe.tsx     # Reusable skeleton SVG
│   │   └── StatusDot.tsx             # Colored status indicator
│   ├── compositions/
│   │   ├── HeroReel.tsx
│   │   ├── FeatureLoopProgramming.tsx
│   │   ├── FeatureLoopPoseAnalysis.tsx
│   │   ├── FeatureLoopPRTracking.tsx
│   │   ├── InstagramReel.tsx
│   │   ├── SocialAdCoachPitch.tsx
│   │   └── Thumbnail.tsx
│   ├── scenes/                       # HeroReel sub-scenes
│   │   ├── LogoScene.tsx
│   │   ├── TaglineScene.tsx
│   │   ├── ProgrammingScene.tsx
│   │   ├── PoseAnalysisScene.tsx
│   │   ├── DashboardScene.tsx
│   │   ├── PRCelebrationScene.tsx
│   │   ├── EventMontageScene.tsx
│   │   └── CTAScene.tsx
│   └── lib/
│       ├── tokens.ts                 # Design system color/font constants
│       ├── fonts.ts                  # Google font loaders
│       └── spring-presets.ts         # Reusable spring configs
```

## Dependencies

```json
{
  "remotion": "latest",
  "@remotion/cli": "latest",
  "@remotion/google-fonts": "latest",
  "@remotion/transitions": "latest",
  "@remotion/paths": "latest",
  "tailwindcss": "^3.4",
  "zod": "^3.22"
}
```

## Rendering

Each composition can be rendered independently:

```bash
# Render hero reel as MP4
npx remotion render HeroReel out/hero-reel.mp4

# Render all feature loops
npx remotion render FeatureLoop-Programming out/feature-programming.mp4
npx remotion render FeatureLoop-PoseAnalysis out/feature-pose.mp4
npx remotion render FeatureLoop-PRTracking out/feature-pr.mp4

# Render social assets
npx remotion render InstagramReel out/instagram-reel.mp4
npx remotion render SocialAd-CoachPitch out/social-coach.mp4

# Render thumbnail as PNG
npx remotion still Thumbnail out/thumbnail.png
```

## Parametrization

All compositions accept props via Zod schemas for easy customization:

```typescript
// Example: HeroReel props
const HeroReelSchema = z.object({
  tagline: z.string().default("Built for Elite Throws Coaching"),
  ctaUrl: z.string().default("podiumthrows.com"),
  ctaSubtext: z.string().default("The coaching platform built for throws"),
  stats: z.object({
    totalAnalyses: z.number().default(47),
    prRate: z.number().default(73),
    avgReadiness: z.number().default(8.2),
  }),
  events: z.array(z.object({
    name: z.string(),
    percentage: z.number(),
  })).default([
    { name: "SHOT_PUT", percentage: 42 },
    { name: "DISCUS", percentage: 28 },
    { name: "HAMMER", percentage: 18 },
    { name: "JAVELIN", percentage: 12 },
  ]),
  prDistance: z.number().default(18.42),
  prEvent: z.string().default("SHOT_PUT"),
});
```

This allows rendering personalized versions (e.g., different stats per coach, different PR distances for athlete testimonials) without code changes.

---

## Design Constraints

- **No CSS animations or Tailwind animate-* classes** — all motion via `useCurrentFrame()` + `spring()` / `interpolate()`
- **No real footage** — pure motion graphics from UI components and data visualizations
- **No audio** — designed for rhythm but silent output (music added externally)
- **All text must be readable at target platform size** — minimum 24px for body text at 1080p
- **Loop compositions must match first/last frames** — 15-frame fade bookends
- **Accessible contrast** — gold on dark backgrounds exceeds 4.5:1 ratio
