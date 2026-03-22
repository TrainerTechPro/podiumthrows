# Podium Throws — UI Effects Recommendations

These are the Framer University effects that would genuinely improve the Podium Throws experience, filtered specifically for a coaching SaaS used on **mobile by athletes** and **both mobile + desktop by coaches**. Effects that are purely decorative, marketing-page-only, or cursor-dependent (useless on mobile) have been excluded.

---

## 1. Animated Number Counter

**Where to use:** Athlete dashboard (PR distances, total throws, session counts), coach roster stats, StatCard components, any numeric KPI display.

**Why this matters:** Coaches and athletes open the dashboard dozens of times per week. Static numbers feel dead — they don't communicate change or progress. When an athlete hits a new PR or their session count ticks up, the number should *count up* to its value on page load. This is the single easiest way to make data feel alive. Every competitor (BridgeAthletic, TrainHeroic) has static numbers. Animated counters instantly signal "this app is a tier above."

**Prompt for Claude Code:**

```
Add an animated number counter utility to the Podium Throws codebase. Create a reusable React hook `useAnimatedCounter(targetValue, duration, options)` in `src/lib/hooks/useAnimatedCounter.ts` that:

- Counts from 0 (or a previous value) to the target value over a configurable duration (default 1200ms)
- Uses ease-out easing for natural deceleration
- Supports decimal places (for distances like 18.42m)
- Supports formatting with units (m, kg, %)
- Only triggers when the element enters the viewport (Intersection Observer)
- Returns the current animated value and a ref to attach to the container

Then apply this hook to:
1. All StatCard components in `src/components/ui/StatCard.tsx`
2. The athlete dashboard page stats (`src/app/(dashboard)/athlete/dashboard/page.tsx`)
3. The coach athlete detail page stats (`src/app/(dashboard)/coach/athletes/[id]/page.tsx`)
4. Any ScoreIndicator or ProgressBar that displays a numeric value

Use the existing Tailwind theme. No new dependencies — pure React + requestAnimationFrame. Respect `prefers-reduced-motion` by skipping animation when enabled.
```

---

## 2. Number Flow (Smooth Value Transitions)

**Where to use:** Any number that changes *while the user is on the page* — RPE slider output, rest timer countdown, live session throw counts, plate calculator weight totals.

**Why this matters:** This is different from the counter above. The counter animates on page load. Number Flow handles *live changes* — when a coach adjusts RPE from 7 to 8, the number should smoothly roll, not jump. The RPE Slider, Rest Timer, and Plate Calculator all involve numbers that change in real-time. Smooth transitions make interactions feel premium and tactile, especially on mobile where the athlete is swiping/tapping quickly between throws.

**Prompt for Claude Code:**

```
Create a `NumberFlow` React component in `src/components/ui/NumberFlow.tsx` that smoothly animates between number values. When the `value` prop changes, the displayed number should transition smoothly over 400ms using requestAnimationFrame with ease-out easing.

Requirements:
- Accept `value` (number), `decimals` (number), `suffix` (string like "kg" or "m"), `prefix` (string like "$"), and `duration` (ms)
- Use CSS `font-variant-numeric: tabular-nums` so digits don't shift layout during animation
- Support the existing Outfit/DM Sans fonts and Tailwind theme colors
- Respect `prefers-reduced-motion`
- No new dependencies

Apply this component to:
1. RPE Slider display value (`src/components/rpe-slider.tsx`)
2. Rest Timer countdown (`src/components/ui/RestTimer.tsx`)
3. Plate Calculator total weight display
4. Any live-updating stat in session logging (`src/app/(dashboard)/athlete/log-session/page.tsx`)
```

---

## 3. Slide to Confirm Button

**Where to use:** Session completion, deleting a session, confirming a PR, any destructive or high-stakes action on mobile.

**Why this matters:** Athletes log sessions on mobile, often mid-practice with sweaty hands. A regular "Complete Session" button is too easy to accidentally tap. A slide-to-confirm gives the action physical weight — it feels intentional. This is standard UX for high-stakes mobile actions (think iPhone "slide to power off"). It also looks and feels premium, which matters when coaches are paying $100+/month. None of your competitors have this.

**Prompt for Claude Code:**

```
Create a `SlideToConfirm` React component in `src/components/ui/SlideToConfirm.tsx` for mobile-first high-stakes confirmations.

Requirements:
- A pill-shaped track with a draggable thumb that the user slides from left to right
- Support touch events (touchstart, touchmove, touchend) AND mouse events for desktop
- As the user drags, the track fills with the primary amber/gold color progressively
- Text like "Slide to Complete Session" fades as the thumb moves right
- On completion (thumb reaches ~85% of track width), trigger the `onConfirm` callback with a subtle haptic-style bounce animation
- If released before completion, spring the thumb back to start with ease-out animation
- Accept props: `label` (string), `onConfirm` (callback), `disabled` (boolean), `variant` ('confirm' | 'destructive')
- Destructive variant uses red instead of amber
- Use existing Tailwind theme tokens, Outfit font, dark mode compatible
- No new dependencies

Apply this to:
1. "Complete Session" action in `src/app/(dashboard)/athlete/log-session/page.tsx`
2. "Delete Session" confirmation in session detail pages
3. Any other destructive action that currently uses a basic confirm dialog on mobile
```

---

## 4. Card Hover Interaction + Touch Press Feedback

**Where to use:** Athlete roster cards, session cards, exercise library cards, drill video cards — every clickable card in the app.

**Why this matters:** The CLAUDE.md already flags "non-clickable cards" as a known issue. Even for cards that *are* clickable, users need visual feedback that says "this is interactive." On desktop, a subtle scale + shadow on hover communicates clickability instantly. On mobile, a press-down effect (scale 0.97 on touch) gives tactile feedback. This is the difference between "app that feels like a spreadsheet" and "app that feels like it was designed by someone who cares." Every card in the app should respond to interaction.

**Prompt for Claude Code:**

```
Enhance the Card component in `src/components/ui/Card.tsx` to support interactive hover and touch states.

Add an optional `interactive` prop (boolean, default false). When `interactive={true}`:

Desktop (hover):
- Scale to 1.02 with `transition: transform 200ms ease-out, box-shadow 200ms ease-out`
- Deepen the box-shadow slightly
- Use `will-change: transform` for GPU acceleration

Mobile (touch):
- On touchstart: scale to 0.97 with 100ms transition (press-down effect)
- On touchend: spring back to 1.0 with 200ms ease-out
- Use `cubic-bezier(0.34, 1.56, 0.64, 1)` for the spring-back for a subtle bounce

Both:
- Add `cursor: pointer` when interactive
- Respect `prefers-reduced-motion` (skip scale, keep shadow changes)
- Dark mode compatible using existing theme

Then audit every page in the app and add `interactive` to every Card that navigates somewhere or opens a detail view:
- Athlete roster cards on coach pages
- Session history cards on both athlete and coach pages
- Exercise library cards
- Drill video cards
- Goal cards
- Questionnaire cards

No new dependencies. Pure CSS transitions + minimal JS for touch events.
```

---

## 5. Staggered List Entrance Animation

**Where to use:** Every list/grid in the app — athlete roster, session history, exercise library, drill videos, goals, questionnaire responses.

**Why this matters:** When you navigate to a page with a list of items, having everything appear at once feels flat and instantaneous — like a static document, not an app. Staggering items so they fade in one after another (50ms apart) creates the perception that the app is *presenting* data to you, not just dumping it. It also masks any micro-delays in rendering. This is a standard pattern in every premium mobile app (iOS Health, Nike Run Club, Strava). It's subtle, but coaches will notice its absence when comparing to competitors.

**Prompt for Claude Code:**

```
Create a `StaggeredList` wrapper component in `src/components/ui/StaggeredList.tsx` that animates its children into view with staggered delays.

Requirements:
- Each child fades in (opacity 0→1) and slides up slightly (translateY 12px→0) with 250ms duration
- Stagger delay between children: 50ms (configurable via `staggerDelay` prop)
- Only animate on first render (not on re-renders/data updates)
- Use Intersection Observer to only trigger when the list enters the viewport
- Accept props: `staggerDelay` (ms), `duration` (ms), `className`
- Use CSS transitions, not JS animation libraries
- Respect `prefers-reduced-motion` (render immediately, no animation)
- No new dependencies

Apply to every list/grid in:
1. Coach athlete roster (`src/app/(dashboard)/coach/athletes/page.tsx`)
2. Coach throws roster (`src/app/(dashboard)/coach/throws/roster/page.tsx`)
3. Session history pages (both athlete and coach)
4. Exercise library (`src/app/(dashboard)/coach/throws/library/page.tsx`)
5. Drill videos page
6. Goals pages
7. Questionnaire list pages
8. Achievement pages
```

---

## 6. Enhanced Toast Notifications with PR Celebrations

**Where to use:** All toast notifications app-wide, with special celebration treatment for PRs and achievements.

**Why this matters:** The app already has a Toast component, but toasts are one of the highest-frequency UI elements in a session logging tool — every save, every error, every PR triggers one. A toast that slides in smoothly with a progress bar showing auto-dismiss time feels responsive and trustworthy. For PRs specifically, this is your chance to create a *moment*. When an athlete logs a throw that beats their PR, the notification should feel like a celebration, not a system message. This is the kind of detail that makes athletes actually *want* to log their throws. You already have a `PRCelebration` component — this extends that energy to the notification layer.

**Prompt for Claude Code:**

```
Enhance the existing Toast component in `src/components/ui/Toast.tsx` with smooth animations and a PR celebration variant.

Standard toast enhancements:
- Slide in from the bottom on mobile (translateY 100%→0), from the top-right on desktop
- Use 250ms ease-out entrance, 200ms ease-in exit
- Add a thin progress bar at the bottom showing time until auto-dismiss
- Stack multiple toasts with 8px gap, newest on top
- Smooth exit animation when dismissed (slide + fade)

New "celebration" variant:
- Triggered when type is "celebration" or "pr"
- Uses amber/gold gradient background instead of standard dark
- Subtle pulse animation on the icon (scale 1.0→1.1→1.0 looping)
- Optional confetti burst using CSS-only particles (small colored squares that animate outward and fade — no libraries)
- Larger text for the PR distance/achievement

Integration:
- Update the toast utility function to accept a `variant: 'default' | 'success' | 'error' | 'celebration'`
- Connect to the existing PRCelebration component flow
- Ensure both dark and light mode compatibility
- Mobile-first: toasts should be full-width on screens < 640px
- No new dependencies
```

---

## 7. Smooth Page/Section Transitions

**Where to use:** Dashboard widget sections, tab content switches (the existing Tabs component), any content that swaps on user action.

**Why this matters:** The app has Tabs throughout (athlete profile, coach views, analysis pages). When you click a tab, the content currently just *appears*. A 200ms crossfade with a subtle 8px slide makes the switch feel intentional and oriented — the user's brain understands "new content came from the right" or "this faded in." This reduces cognitive load when switching between training data views, which coaches do constantly. It's also the single most noticeable difference between "web app" and "native app" feel.

**Prompt for Claude Code:**

```
Enhance the existing Tabs component in `src/components/ui/Tabs.tsx` with smooth content transitions.

Requirements:
- When the active tab changes, outgoing content fades out (opacity 1→0, 150ms) while incoming content fades in (opacity 0→1, translateY 8px→0, 200ms)
- Use CSS transitions only — no animation libraries
- The active tab indicator (underline or background) should slide to the new tab position with a smooth 250ms transition using translateX, not just appearing
- Keep the component's existing API — this should be a non-breaking enhancement
- Add `will-change: opacity, transform` during transitions only (remove after)
- Respect `prefers-reduced-motion`
- Test with existing tab usage across the app (athlete throws profile, coach views, analysis pages)
- No new dependencies

Also apply a similar fade+slide transition to DashboardWidget content in `src/components/ui/DashboardWidget.tsx` when data loads (from skeleton to real content).
```

---

## 8. Scroll Progress Bar for Long Flows

**Where to use:** Session logging flow, questionnaire creation/filling, athlete onboarding, any multi-section scrollable page.

**Why this matters:** Athletes logging sessions on mobile are scrolling through potentially dozens of throws, RPE ratings, and notes. A thin progress bar at the top showing "you're 60% through" reduces the anxiety of "how much more is there?" It's a tiny detail that dramatically improves the feel of long forms. Coaches building questionnaires or reviewing long session histories benefit the same way. This is standard in every good mobile reading/form experience.

**Prompt for Claude Code:**

```
Create a `ScrollProgressBar` React component in `src/components/ui/ScrollProgressBar.tsx`.

Requirements:
- A thin (3px) fixed bar at the very top of the viewport
- Fills from left to right based on scroll position: (scrollY / (docHeight - windowHeight)) * 100
- Uses the primary amber/gold color with a subtle glow
- Smooth width transitions (100ms ease-out)
- Only renders when the page is scrollable (content taller than viewport)
- `pointer-events: none` so it doesn't interfere with anything
- Uses requestAnimationFrame for smooth 60fps updates
- z-index above everything else
- Dark mode compatible
- No new dependencies

Add this component to:
1. Athlete session logging page (`src/app/(dashboard)/athlete/log-session/page.tsx`)
2. Athlete onboarding (`src/app/(dashboard)/athlete/onboarding/page.tsx`)
3. Coach questionnaire creation (`src/app/(dashboard)/coach/questionnaires/new/page.tsx`)
4. Coach questionnaire response review pages
5. Any other page with significant scroll depth
```

---

## 9. Animated Progress Bars

**Where to use:** ProgressBar component, training volume indicators, goal completion meters, any percentage-based visualization.

**Why this matters:** The app has a ProgressBar component already. When it renders, the bar should animate from 0% to its target width — not just appear at 72%. This is a small thing that makes every progress indicator in the app feel dynamic. When a coach opens an athlete's profile and sees the training volume bar fill up to 85%, it *communicates* something that a static bar doesn't: "this athlete has been putting in work." The animation adds meaning to the data. Apply this alongside the animated number counter for maximum impact.

**Prompt for Claude Code:**

```
Enhance the existing ProgressBar component in `src/components/ui/ProgressBar.tsx` with entrance animation.

Requirements:
- On first render, animate the bar width from 0% to the target value over 800ms with ease-out easing
- Use CSS transition on width property (not JS animation)
- Trigger animation only when the element enters the viewport (Intersection Observer)
- Support a `animated` prop (boolean, default true) to opt out
- The fill color should also have a subtle gradient shimmer that runs once during the animation
- If the value changes after initial render, animate smoothly to the new value (300ms)
- Respect `prefers-reduced-motion`
- No new dependencies

Apply to all existing ProgressBar usages across the app, including:
- Training volume indicators
- Goal completion meters
- Any assessment progress displays
- Questionnaire completion indicators
```

---

## 10. Bouncy Interaction for Primary CTAs

**Where to use:** "Log Throw" button, "Start Session" button, "Save" buttons, achievement unlock moments — the most important actions in the app.

**Why this matters:** The primary call-to-action buttons are the most-tapped elements in the entire app. Athletes hit "Log Throw" potentially 50+ times per practice. A subtle spring bounce on tap (scale down to 0.95, then overshoot to 1.03, then settle at 1.0) makes each tap feel *satisfying*. This is the same psychology that makes physical buttons feel good — there's feedback. It's the difference between tapping a screen and pressing a button. For a tool used daily by competitive athletes, this tactile feel matters more than you'd think.

**Prompt for Claude Code:**

```
Add a spring bounce animation to the existing Button component in `src/components/ui/Button.tsx` for primary and CTA variants.

Requirements:
- On click/tap, the button should: scale to 0.95 (50ms) → spring to 1.03 (150ms) → settle to 1.0 (100ms)
- Use CSS @keyframes animation triggered by adding/removing a class on click
- The spring easing should use `cubic-bezier(0.34, 1.56, 0.64, 1)` for the overshoot
- Only apply to `variant="primary"` and `variant="cta"` (or equivalent) — not to ghost/secondary buttons
- Secondary buttons get a subtler effect: scale 0.97→1.0 with no overshoot
- Remove the animation class after completion so it can re-trigger
- Works on both touch and click
- Respect `prefers-reduced-motion` (skip animation, keep normal click)
- No new dependencies

This should enhance the existing Button component without changing its API. Test with:
- "Log Throw" button in session logging
- "Start Session" / "Complete Session" buttons
- "Save" buttons across all forms
- "Invite Athlete" button
```

---

## Effects I Deliberately Excluded (and Why)

These effects from the Framer library would **hurt** the Podium Throws experience:

| Effect | Why It's Wrong for This App |
|---|---|
| Cursor trails, magic cursors, custom cursors (#27-32) | Completely useless on mobile (no cursor). Distracting on desktop for a data-heavy tool. |
| Galaxy/cosmic buttons (#7, #87) | Too flashy for a professional coaching tool. Coaches would lose trust instantly. |
| Parallax scroll effects (#69-78) | Marketing page material, not dashboard material. Adds jank on mobile. |
| 3D card flips (#18-20) | No use case for hiding data on the back of cards. Adds confusion. |
| Gooey dropdown (#1) | Fun but impractical — slows down navigation in a tool used under time pressure. |
| Holographic cards (#83-84) | Cool tech demo, wrong context. Makes a coaching tool look like a gaming app. |
| Text scramble (#37) | Unreadable during the scramble. Coaches need to read data instantly. |
| Flashlight effect (#89) | Gimmick with no functional benefit in a coaching dashboard. |
| God rays / light beams (#92-94) | Decorative. Zero utility in a data-driven app. |
| Magnetic buttons (#8) | Frustrating when trying to click quickly. Athletes logging throws don't want buttons that move. |

---

## CLAUDE.md Addition for Future Design Reference

Add this section to your CLAUDE.md file to ensure all future development follows these interaction patterns:

```markdown
## Interaction & Motion Design System

### Motion Principles
All motion in Podium Throws serves one of three purposes:
1. **Feedback** — confirming that a user action was registered (button bounces, card presses)
2. **Orientation** — showing where content came from or went (tab slides, list staggers)
3. **Celebration** — marking meaningful achievements (PR notifications, goal completions)

Motion that doesn't serve one of these purposes should not be added.

### Motion Tokens
| Token | Value | Use Case |
|---|---|---|
| `duration-fast` | 100-150ms | Button press, touch feedback |
| `duration-normal` | 200-300ms | Tab transitions, card hovers, toasts |
| `duration-slow` | 400-800ms | Number counters, progress bar fills |
| `ease-out` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Most transitions |
| `ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bouncy buttons, card spring-back |

### Interaction Rules
- **Every clickable card** must have `interactive` prop enabled (scale + shadow on hover, press-down on touch)
- **Every list/grid** must use `StaggeredList` for entrance animation (50ms stagger, 250ms duration)
- **Every numeric display** must use `useAnimatedCounter` on page load or `NumberFlow` for live updates
- **Every progress bar** must animate from 0 to target on viewport entry
- **Every tab switch** must crossfade content (150ms out, 200ms in with 8px translateY)
- **Primary CTA buttons** must have spring bounce on tap
- **High-stakes mobile actions** (complete session, delete) must use `SlideToConfirm`
- **All motion** must respect `prefers-reduced-motion` media query

### What NOT to Add
- No cursor-dependent effects (half the users are on mobile)
- No parallax scrolling (kills mobile performance, wrong context for data tool)
- No decorative animations that don't serve feedback/orientation/celebration
- No animation libraries — all motion is CSS transitions + requestAnimationFrame
- No animation longer than 1200ms (feels sluggish in a coaching context)
```
