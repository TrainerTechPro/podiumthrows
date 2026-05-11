# Marketing Bento Rebuild — Design Spec

**Date:** 2026-05-11
**Audit prompt:** Frontend Audit (May 2026), Prompt 8
**Status:** Approved — ready for implementation plan

## Problem

`src/components/marketing/BentoFeatures.tsx` is 7 cards of `{ icon, title, description }`. Asymmetric col-span doesn't fix it — this is the textbook 2024–2025 AI landing-page bento. The audit flagged it as the one section a competitor would screenshot to say "AI-generated."

## Goal

Replace 7 templated icon+title+desc cards with **3 hand-tuned mockup tiles** that show genuinely differentiated capabilities, plus a single text strip listing the rest. Make the marketing surface stop looking AI-generated to anyone who's seen five SaaS landing pages this year.

## Three differentiated features

| Slot | Feature                          | Why it differentiates                                                                                                                                     |
| ---- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A    | Bondarchuk session enforcement   | No competitor (BridgeAthletic, TrainHeroic, TeamBuildr, CoachMePlus) enforces descending implement sequencing. The most visible "built for throws" proof. |
| B    | Unified PR per implement weight  | Catalog-keyed PRs (shipped 2026-05-01) fix the duplicate-row class permanently. One record per implement, ever.                                           |
| C    | Video analysis with pose overlay | Most visually striking; the screenshot most likely to be shared. Real shipped capability via `PoseDetectionOverlay`.                                      |

## Tile designs

Each tile is a hand-built React component using the marketing `--landing-*` token vocabulary on a dark editorial register. No icon + heading + paragraph template.

### Tile A — Validated session (`<ValidatedSessionTile>`)

A mini block-builder showing a descending session, all blocks valid.

**Visual elements:**

- Top row: section overline ("SESSION · TUE 09:00") + green "✓ VALID" status pill, right-aligned
- Three throwing blocks stacked vertically:
  - Block 1: `CE` classification chip · `9kg shot` (brand amber) · "heaviest →" right-aligned
  - Block 2: `CE` chip · `7.26kg shot` (default text) · "→ comp" right-aligned
  - Inter-row marker: centered tiny dim text "strength block between"
  - Block 3: `CE` chip · `6kg shot` (default text) · "→ lightest" right-aligned
- Footer block: 2px-left-border in success-green, with subtitle text _"Descending sequence per Vol IV. Strength between throwing blocks enables passive activation transfer."_

**Register:** confident, research-software. Citations folded in (Vol IV).

### Tile B — Athlete-keyed PR card (`<UnifiedPRTile>`)

Per-implement PR records for a single athlete. Comp weight highlighted.

**Visual elements:**

- Header row: 34px circular avatar (brand-amber gradient with initials "MJ") + name "Marcus Johnson" + sub-line "SHOT PUT · M · NCAA D1"
- Overline: "PERSONAL BESTS"
- Three implement rows, each:
  - 60px left column: implement weight in brand-amber bold ("6 KG" / "7.26 KG" / "8 KG"); comp-weight row tinted brand amber
  - Mono distance value ("19.42m" — IBM Plex Mono, semibold)
  - Right-aligned date or note ("2 weeks ago" / "↑ comp · last Fri" / "3 weeks ago")
  - Comp row: full row tinted with `rgba(255,200,0,0.05)` bg + amber border
- Footer subtitle (italic): _"One record per implement. Catalog-keyed — no duplicates from '6kg shot' vs '6kg shot put'."_

**Register:** tabular, scannable, looks like a real product surface.

### Tile C — Frame + measurements (`<PoseAnalysisTile>`)

Two-column tile: stylized pose overlay frame + measurements panel.

**Visual elements:**

- 1.6 / 1 grid columns; full dark "video frame" background on left, panel-style background on right
- Left: stylized SVG of a shot-putter side-view in release position:
  - Body lines in success-green; throwing arm + shot in brand-amber (thicker stroke, slight glow)
  - Joint dots in brand-amber (4 leg/spine/shoulder/arm/release)
  - Trunk-lean angle annotation: dashed vertical reference + "28°" label
  - Bottom-left timestamp "00:02.47" in mono dim text
- Right: measurement panel
  - Overline: "RELEASE FRAME"
  - Three measurement rows, each:
    - Label (e.g. "Trunk lean") + mono value ("28°") right-aligned
    - 3px progress bar showing value position within target range
    - Italic dim subtitle "target 30–35°" (or "target 38–42° ✓" if within range)
  - Color: amber for within-target, success-green for ideal, dim for neutral

**Register:** complete analysis tool, not a tech demo. Throws-specific angles are what differentiate from generic pose-detection tooling.

### Layout

- **Desktop (≥768px):** three tiles in a single equal-width row, max-width ~1200px, gap ~16px between tiles.
- **Tablet (640–768px):** same row layout, slightly tighter.
- **Mobile (<640px):** vertical stack, each tile full-width, gap ~24px between tiles so each gets a separate scroll moment.

Each tile gets the existing `ScrollReveal` entrance animation, staggered (first tile 0ms delay, second 100ms, third 200ms).

### Section header

Replaces nothing currently — the bento just begins with no overline today. Add:

```
THE THREE THINGS · Built specifically for throws coaches.
```

Rendered as: small `--landing-text-dim` uppercase overline + a single bold heading line. No paragraph below.

### "More in the product" strip

Single horizontal text strip below the 3 tiles. No icons, no cards.

```
MORE IN THE PRODUCT  ·  Athlete profiles & readiness  ·  Questionnaire builder  ·  Event groups (shot / discus / hammer / javelin)  ·  Practice tools (plate calc, rest timer, RPE logger)  ·  Performance analytics
```

Format: mono uppercase overline `MORE IN THE PRODUCT` + body-text feature list separated by `·`. Wraps gracefully on smaller screens. Each item is plain text, not a link.

## What goes away

- `BentoCard` component (replaced with 3 named tiles)
- 7 templated card entries in `CARDS` array
- `ReadinessMockup` helper (was a sub-piece of the featured icon-card, no longer relevant)
- Cursor-tracked spotlight effect (`--mx` / `--my` radial gradient on hover) — was a generic AI-tell flourish
- The icon block (36px rounded square with lucide icon in brand-amber) on every card
- Asymmetric 12-col grid plumbing (`md:col-span-*` etc.)

## What stays

- Marketing always-dark register
- `--landing-*` token vocabulary
- `ScrollReveal` entrance animations (applied to new tiles)
- `MonoLabel` / `CornerMark` components (corner marks usable on Tile A as the most "featured" — optional)
- Surrounding marketing structure (`HeroSection`, `DataStrip`, dividers, `BondarchukProof`, `StickyFeatures`, etc.) — out of scope for this PR

## File structure (proposed)

```
src/components/marketing/
├── BentoFeatures.tsx              (rewrite — now orchestrates 3 tiles + strip)
├── tiles/
│   ├── ValidatedSessionTile.tsx   (Tile A)
│   ├── UnifiedPRTile.tsx          (Tile B)
│   └── PoseAnalysisTile.tsx       (Tile C)
└── MoreInProductStrip.tsx         (the dense feature list strip)
```

This keeps each tile in its own file (one-purpose, ~150 lines each max), with `BentoFeatures.tsx` reduced to a thin composition.

## Out of scope (do not touch in this PR)

- Other marketing components (`StickyFeatures`, `BondarchukProof`, etc.)
- App-side amber tokens (Prompt 4's tail cleanup — separate work)
- Pose detection actual implementation (already shipped as `PoseDetectionOverlay`)
- Catalog-keyed PR system (already shipped 2026-05-01)
- Bondarchuk engine (already shipped 2026-04-12)

This is a presentation-layer rebuild only. All three tiles describe **shipped capabilities**.

## Open questions

None — all decisions captured. Ready for implementation plan.

## References

- Existing source: `src/components/marketing/BentoFeatures.tsx`
- Reference for level of detail expected: `src/app/(dashboard)/athlete/dashboard/_athlete-home-client.tsx` (`TodayHeroCard`)
- Token vocabulary: `src/app/globals.css` `--landing-*` block
- Mockup HTML for each tile (preserved for reference): `.superpowers/brainstorm/8107-1778521720/content/tile-{a,b,c}-*.html`
