# Marketing Bento Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 7-card templated bento in `src/components/marketing/BentoFeatures.tsx` with 3 hand-tuned mockup tiles (Validated Session, Unified PR card, Pose Analysis) plus a single text "more in the product" strip.

**Architecture:** Each tile is its own React component file with inline styles (per existing marketing pattern) using `--landing-*` CSS tokens. `BentoFeatures.tsx` shrinks to a thin orchestrator that composes 3 tiles + 1 strip behind `ScrollReveal` entrance animations. No new dependencies. No backend changes.

**Tech Stack:** Next.js 14.2 App Router, React 18.3, TypeScript, Vitest + React Testing Library for smoke tests, `framer-motion` for entrance animations (existing).

**Spec:** `docs/superpowers/specs/2026-05-11-marketing-bento-rebuild-design.md`

---

## File Structure

| File                                                           | Action  | Responsibility                                                                                                     |
| -------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/components/marketing/tiles/ValidatedSessionTile.tsx`      | Create  | Tile A — descending-session mockup with Vol IV citations                                                           |
| `src/components/marketing/tiles/ValidatedSessionTile.test.tsx` | Create  | Smoke test                                                                                                         |
| `src/components/marketing/tiles/UnifiedPRTile.tsx`             | Create  | Tile B — athlete-keyed PR card                                                                                     |
| `src/components/marketing/tiles/UnifiedPRTile.test.tsx`        | Create  | Smoke test                                                                                                         |
| `src/components/marketing/tiles/PoseAnalysisTile.tsx`          | Create  | Tile C — pose-overlay frame + measurements panel                                                                   |
| `src/components/marketing/tiles/PoseAnalysisTile.test.tsx`     | Create  | Smoke test                                                                                                         |
| `src/components/marketing/MoreInProductStrip.tsx`              | Create  | Dense text strip listing remaining features                                                                        |
| `src/components/marketing/MoreInProductStrip.test.tsx`         | Create  | Smoke test                                                                                                         |
| `src/components/marketing/BentoFeatures.tsx`                   | Rewrite | Section header + 3-tile row + strip. Drops `BentoCard`, `CARDS`, `ReadinessMockup`, spotlight effect, 12-col grid. |

All files use the existing pattern of inline styles + `--landing-*` CSS tokens. No Tailwind utility classes in the tiles themselves (matches the surrounding marketing surface).

---

## Task 1: ValidatedSessionTile + smoke test

**Files:**

- Create: `src/components/marketing/tiles/ValidatedSessionTile.tsx`
- Create: `src/components/marketing/tiles/ValidatedSessionTile.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

Create `src/components/marketing/tiles/ValidatedSessionTile.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValidatedSessionTile } from "./ValidatedSessionTile";

describe("ValidatedSessionTile", () => {
  it("renders without crashing", () => {
    render(<ValidatedSessionTile />);
  });

  it("shows the valid-session status", () => {
    render(<ValidatedSessionTile />);
    expect(screen.getByText(/VALID/)).toBeInTheDocument();
  });

  it("cites Vol IV in the footer", () => {
    render(<ValidatedSessionTile />);
    expect(screen.getByText(/Vol IV/)).toBeInTheDocument();
  });

  it("shows the descending implement sequence (9kg → 7.26kg → 6kg)", () => {
    render(<ValidatedSessionTile />);
    expect(screen.getByText(/9kg shot/)).toBeInTheDocument();
    expect(screen.getByText(/7.26kg shot/)).toBeInTheDocument();
    expect(screen.getByText(/6kg shot/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/marketing/tiles/ValidatedSessionTile.test.tsx`
Expected: FAIL with "Cannot find module './ValidatedSessionTile'"

- [ ] **Step 3: Implement the tile**

Create `src/components/marketing/tiles/ValidatedSessionTile.tsx`:

```tsx
"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   ValidatedSessionTile
   ────────────────────
   Marketing landing tile showing a Bondarchuk-validated descending session.
   Three throwing blocks (9kg → 7.26kg → 6kg shot) with "strength block
   between" markers, plus a footer citing Vol IV.

   See docs/superpowers/specs/2026-05-11-marketing-bento-rebuild-design.md
   for the full spec.
   ═══════════════════════════════════════════════════════════════════════════ */

interface BlockProps {
  classification: string;
  implement: string;
  marker: string;
  emphasized?: boolean;
}

function Block({ classification, implement, marker, emphasized }: BlockProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        border: "1px solid var(--landing-border-light)",
        borderRadius: 8,
        background: "var(--landing-bg)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "var(--landing-text-secondary)",
          fontWeight: 600,
          letterSpacing: "0.1em",
          width: 28,
        }}
      >
        {classification}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: emphasized ? "#FFC800" : "var(--landing-text)",
        }}
      >
        {implement}
      </span>
      <span
        style={{
          marginLeft: "auto",
          fontSize: 10,
          color: "var(--landing-text-secondary)",
        }}
      >
        {marker}
      </span>
    </div>
  );
}

export function ValidatedSessionTile() {
  return (
    <div
      style={{
        background: "var(--landing-surface)",
        border: "1px solid var(--landing-border)",
        borderRadius: 14,
        padding: 18,
        boxShadow: "var(--landing-neo-raised)",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        color: "var(--landing-text)",
      }}
    >
      {/* Top row — overline + valid status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.18em",
            color: "var(--landing-text-secondary)",
            textTransform: "uppercase",
          }}
        >
          Session · Tue 09:00
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#00ff88",
            letterSpacing: "0.12em",
          }}
        >
          ✓ VALID
        </div>
      </div>

      {/* Block stack */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Block classification="CE" implement="9kg shot" marker="heaviest →" emphasized />
        <Block classification="CE" implement="7.26kg shot" marker="→ comp" />
        <div
          style={{
            textAlign: "center",
            fontSize: 9,
            color: "var(--landing-text-secondary)",
            letterSpacing: "0.05em",
            margin: "2px 0",
            fontStyle: "italic",
          }}
        >
          strength block between
        </div>
        <Block classification="CE" implement="6kg shot" marker="→ lightest" />
      </div>

      {/* Footer citation */}
      <div
        style={{
          marginTop: 12,
          padding: "8px 10px",
          borderRadius: 6,
          background: "rgba(0,255,136,0.04)",
          borderLeft: "2px solid #00ff88",
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: "var(--landing-text-secondary)",
            fontStyle: "italic",
            lineHeight: 1.45,
          }}
        >
          Descending sequence per{" "}
          <strong style={{ color: "var(--landing-text)", fontStyle: "normal" }}>Vol IV</strong>.
          Strength between throwing blocks enables passive activation transfer.
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/marketing/tiles/ValidatedSessionTile.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors related to the new files

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/tiles/ValidatedSessionTile.tsx \
        src/components/marketing/tiles/ValidatedSessionTile.test.tsx
git commit -m "feat(marketing): ValidatedSessionTile — Bondarchuk-validated session mockup"
```

---

## Task 2: UnifiedPRTile + smoke test

**Files:**

- Create: `src/components/marketing/tiles/UnifiedPRTile.tsx`
- Create: `src/components/marketing/tiles/UnifiedPRTile.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

Create `src/components/marketing/tiles/UnifiedPRTile.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnifiedPRTile } from "./UnifiedPRTile";

describe("UnifiedPRTile", () => {
  it("renders without crashing", () => {
    render(<UnifiedPRTile />);
  });

  it("shows the athlete name and sub-line", () => {
    render(<UnifiedPRTile />);
    expect(screen.getByText("Marcus Johnson")).toBeInTheDocument();
    expect(screen.getByText(/SHOT PUT/)).toBeInTheDocument();
  });

  it("shows three implement weights with their distances", () => {
    render(<UnifiedPRTile />);
    expect(screen.getByText("6 KG")).toBeInTheDocument();
    expect(screen.getByText("7.26 KG")).toBeInTheDocument();
    expect(screen.getByText("8 KG")).toBeInTheDocument();
    expect(screen.getByText("19.42m")).toBeInTheDocument();
    expect(screen.getByText("18.05m")).toBeInTheDocument();
    expect(screen.getByText("17.20m")).toBeInTheDocument();
  });

  it("includes the catalog-keyed footer", () => {
    render(<UnifiedPRTile />);
    expect(screen.getByText(/Catalog-keyed/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/marketing/tiles/UnifiedPRTile.test.tsx`
Expected: FAIL with "Cannot find module './UnifiedPRTile'"

- [ ] **Step 3: Implement the tile**

Create `src/components/marketing/tiles/UnifiedPRTile.tsx`:

```tsx
"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   UnifiedPRTile
   ─────────────
   Marketing landing tile showing per-implement PRs for a single athlete.
   Catalog-keyed records — one row per implement weight, no duplicates.
   ═══════════════════════════════════════════════════════════════════════════ */

interface PRRowProps {
  weight: string;
  distance: string;
  marker: string;
  isComp?: boolean;
}

function PRRow({ weight, distance, marker, isComp }: PRRowProps) {
  const border = isComp ? "rgba(255,200,0,0.35)" : "var(--landing-border-light)";
  const bg = isComp ? "rgba(255,200,0,0.05)" : "var(--landing-bg)";
  const labelColor = isComp ? "#FFC800" : "var(--landing-text-secondary)";
  const valueColor = isComp ? "#FFC800" : "var(--landing-text)";
  const markerColor = isComp ? "#FFC800" : "var(--landing-text-secondary)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        border: `1px solid ${border}`,
        borderRadius: 8,
        background: bg,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: labelColor,
          fontWeight: 600,
          letterSpacing: "0.08em",
          width: 60,
        }}
      >
        {weight}
      </span>
      <span
        style={{
          fontFamily: "var(--font-ibm-plex-mono), ui-monospace, monospace",
          fontSize: 15,
          fontWeight: 600,
          color: valueColor,
        }}
      >
        {distance}
      </span>
      <span
        style={{
          marginLeft: "auto",
          fontSize: 10,
          color: markerColor,
          fontWeight: isComp ? 600 : 400,
        }}
      >
        {marker}
      </span>
    </div>
  );
}

export function UnifiedPRTile() {
  return (
    <div
      style={{
        background: "var(--landing-surface)",
        border: "1px solid var(--landing-border)",
        borderRadius: 14,
        padding: 18,
        boxShadow: "var(--landing-neo-raised)",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        color: "var(--landing-text)",
      }}
    >
      {/* Header — avatar + name */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #FFC800, #e6b400)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            color: "#0a0a0c",
            fontSize: 13,
          }}
        >
          MJ
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--landing-text)" }}>
            Marcus Johnson
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--landing-text-secondary)",
              letterSpacing: "0.06em",
            }}
          >
            SHOT PUT · M · NCAA D1
          </div>
        </div>
      </div>

      {/* Overline */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.18em",
          color: "var(--landing-text-secondary)",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Personal bests
      </div>

      {/* PR rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <PRRow weight="6 KG" distance="19.42m" marker="2 weeks ago" />
        <PRRow weight="7.26 KG" distance="18.05m" marker="↑ comp · last Fri" isComp />
        <PRRow weight="8 KG" distance="17.20m" marker="3 weeks ago" />
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 12,
          fontSize: 10,
          color: "var(--landing-text-secondary)",
          fontStyle: "italic",
          lineHeight: 1.45,
        }}
      >
        One record per implement. Catalog-keyed — no duplicates from &quot;6kg shot&quot; vs
        &quot;6kg shot put&quot;.
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/marketing/tiles/UnifiedPRTile.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors related to the new files

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/tiles/UnifiedPRTile.tsx \
        src/components/marketing/tiles/UnifiedPRTile.test.tsx
git commit -m "feat(marketing): UnifiedPRTile — per-implement PR records mockup"
```

---

## Task 3: PoseAnalysisTile + smoke test

**Files:**

- Create: `src/components/marketing/tiles/PoseAnalysisTile.tsx`
- Create: `src/components/marketing/tiles/PoseAnalysisTile.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

Create `src/components/marketing/tiles/PoseAnalysisTile.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PoseAnalysisTile } from "./PoseAnalysisTile";

describe("PoseAnalysisTile", () => {
  it("renders without crashing", () => {
    render(<PoseAnalysisTile />);
  });

  it("shows the release-frame overline and timestamp", () => {
    render(<PoseAnalysisTile />);
    expect(screen.getByText(/Release frame/i)).toBeInTheDocument();
    expect(screen.getByText(/00:02\.47/)).toBeInTheDocument();
  });

  it("shows three throws-specific measurements", () => {
    render(<PoseAnalysisTile />);
    expect(screen.getByText(/Trunk lean/i)).toBeInTheDocument();
    expect(screen.getByText(/Release angle/i)).toBeInTheDocument();
    expect(screen.getByText(/Knee drive/i)).toBeInTheDocument();
  });

  it("shows target-range subtitles", () => {
    render(<PoseAnalysisTile />);
    expect(screen.getByText(/target 30–35/)).toBeInTheDocument();
    expect(screen.getByText(/target 38–42/)).toBeInTheDocument();
    expect(screen.getByText(/target 130–140/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/marketing/tiles/PoseAnalysisTile.test.tsx`
Expected: FAIL with "Cannot find module './PoseAnalysisTile'"

- [ ] **Step 3: Implement the tile**

Create `src/components/marketing/tiles/PoseAnalysisTile.tsx`:

```tsx
"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   PoseAnalysisTile
   ────────────────
   Marketing landing tile showing a video pose-overlay frame with a
   throws-specific measurements panel. Two-column layout: SVG pose on
   left, angle readouts vs ideal ranges on right.

   Color rule (per spec):
     - success-green if value is inside target range (subtitle gets ✓)
     - brand amber if value is outside target range but close
     - dim/neutral text for readings without a target comparison
   ═══════════════════════════════════════════════════════════════════════════ */

interface MeasurementProps {
  label: string;
  value: string;
  /** 0..1 — fraction of how the value sits within the target range */
  fill: number;
  /** Italic subtitle like "target 38–42° ✓" */
  subtitle: string;
  /** Color of the value text + fill bar */
  tone: "in-range" | "close" | "neutral";
}

function Measurement({ label, value, fill, subtitle, tone }: MeasurementProps) {
  const color =
    tone === "in-range" ? "#00ff88" : tone === "close" ? "#FFC800" : "var(--landing-text)";
  const barColor =
    tone === "in-range" ? "#00ff88" : tone === "close" ? "#FFC800" : "var(--landing-text-muted)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 10, color: "var(--landing-text-secondary)" }}>{label}</span>
        <span
          style={{
            fontFamily: "var(--font-ibm-plex-mono), ui-monospace, monospace",
            fontSize: 13,
            color,
            fontWeight: 600,
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          height: 3,
          background: "var(--landing-border-light)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{ width: `${Math.round(fill * 100)}%`, height: "100%", background: barColor }}
        />
      </div>
      <div
        style={{
          fontSize: 9,
          color: "var(--landing-text-secondary)",
          fontStyle: "italic",
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

function PoseOverlaySvg() {
  // Side-view stylization of a shot-putter at release.
  // Body lines green, throwing arm + shot brand-amber.
  return (
    <svg
      viewBox="0 0 200 200"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      {/* Ground */}
      <line
        x1="0"
        y1="180"
        x2="200"
        y2="180"
        stroke="var(--landing-border-light)"
        strokeWidth="1"
      />

      {/* Body lines */}
      <line x1="80" y1="180" x2="100" y2="120" stroke="#00ff88" strokeWidth="2.5" opacity="0.9" />
      <line x1="115" y1="180" x2="100" y2="120" stroke="#00ff88" strokeWidth="2.5" opacity="0.9" />
      <line x1="100" y1="120" x2="112" y2="80" stroke="#00ff88" strokeWidth="2.5" opacity="0.9" />
      <line x1="112" y1="80" x2="135" y2="62" stroke="#00ff88" strokeWidth="2.5" opacity="0.9" />
      <line x1="112" y1="80" x2="95" y2="85" stroke="#00ff88" strokeWidth="2.5" opacity="0.9" />
      <line x1="135" y1="62" x2="165" y2="52" stroke="#FFC800" strokeWidth="3" />

      {/* Head */}
      <circle cx="115" cy="68" r="7" fill="none" stroke="#00ff88" strokeWidth="2" opacity="0.9" />

      {/* Joint dots */}
      <circle cx="80" cy="180" r="3" fill="#FFC800" />
      <circle cx="115" cy="180" r="3" fill="#FFC800" />
      <circle cx="100" cy="120" r="3" fill="#FFC800" />
      <circle cx="112" cy="80" r="3" fill="#FFC800" />
      <circle cx="135" cy="62" r="3" fill="#FFC800" />
      <circle cx="165" cy="52" r="3" fill="#FFC800" />

      {/* Shot */}
      <circle cx="172" cy="49" r="4.5" fill="#FFC800" />
    </svg>
  );
}

export function PoseAnalysisTile() {
  return (
    <div
      style={{
        background: "var(--landing-surface)",
        border: "1px solid var(--landing-border)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "var(--landing-neo-raised)",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        color: "var(--landing-text)",
        display: "grid",
        gridTemplateColumns: "1.6fr 1fr",
        minHeight: 220,
      }}
    >
      {/* Left — video frame */}
      <div
        style={{
          position: "relative",
          background: "linear-gradient(160deg, var(--landing-bg), #000)",
          overflow: "hidden",
        }}
      >
        <PoseOverlaySvg />
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 10,
            fontFamily: "var(--font-ibm-plex-mono), ui-monospace, monospace",
            fontSize: 10,
            color: "var(--landing-text-secondary)",
            letterSpacing: "0.06em",
          }}
        >
          00:02.47
        </div>
      </div>

      {/* Right — measurements panel */}
      <div
        style={{
          background: "var(--landing-bg)",
          borderLeft: "1px solid var(--landing-border-light)",
          padding: 14,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.18em",
            color: "var(--landing-text-secondary)",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Release frame
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Measurement
            label="Trunk lean"
            value="28°"
            fill={0.72}
            subtitle="target 30–35°"
            tone="close"
          />
          <Measurement
            label="Release angle"
            value="42°"
            fill={0.95}
            subtitle="target 38–42° ✓"
            tone="in-range"
          />
          <Measurement
            label="Knee drive"
            value="138°"
            fill={0.8}
            subtitle="target 130–140° ✓"
            tone="neutral"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/marketing/tiles/PoseAnalysisTile.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/tiles/PoseAnalysisTile.tsx \
        src/components/marketing/tiles/PoseAnalysisTile.test.tsx
git commit -m "feat(marketing): PoseAnalysisTile — pose overlay + throws-angle measurements"
```

---

## Task 4: MoreInProductStrip + smoke test

**Files:**

- Create: `src/components/marketing/MoreInProductStrip.tsx`
- Create: `src/components/marketing/MoreInProductStrip.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

Create `src/components/marketing/MoreInProductStrip.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MoreInProductStrip } from "./MoreInProductStrip";

describe("MoreInProductStrip", () => {
  it("renders without crashing", () => {
    render(<MoreInProductStrip />);
  });

  it("shows the overline", () => {
    render(<MoreInProductStrip />);
    expect(screen.getByText(/More in the product/i)).toBeInTheDocument();
  });

  it("lists the five remaining features", () => {
    render(<MoreInProductStrip />);
    expect(screen.getByText(/Athlete profiles/i)).toBeInTheDocument();
    expect(screen.getByText(/Questionnaire builder/i)).toBeInTheDocument();
    expect(screen.getByText(/Event groups/i)).toBeInTheDocument();
    expect(screen.getByText(/Practice tools/i)).toBeInTheDocument();
    expect(screen.getByText(/Performance analytics/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/marketing/MoreInProductStrip.test.tsx`
Expected: FAIL with "Cannot find module './MoreInProductStrip'"

- [ ] **Step 3: Implement the strip**

Create `src/components/marketing/MoreInProductStrip.tsx`:

```tsx
"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MoreInProductStrip
   ──────────────────
   Single text strip below the 3 feature tiles. Lists the remaining product
   surface in dense plain-text form — no icons, no card grid, no chrome.
   ═══════════════════════════════════════════════════════════════════════════ */

const FEATURES = [
  "Athlete profiles & readiness",
  "Questionnaire builder",
  "Event groups (shot / discus / hammer / javelin)",
  "Practice tools (plate calc, rest timer, RPE logger)",
  "Performance analytics",
];

export function MoreInProductStrip() {
  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 24,
        borderTop: "1px solid var(--landing-border-light)",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-ibm-plex-mono), ui-monospace, monospace",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.18em",
          color: "var(--landing-text-secondary)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        More in the product
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 12px",
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--landing-text-secondary)",
        }}
      >
        {FEATURES.map((f, i) => (
          <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <span>{f}</span>
            {i < FEATURES.length - 1 && (
              <span aria-hidden="true" style={{ color: "var(--landing-text-muted)" }}>
                ·
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/marketing/MoreInProductStrip.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/MoreInProductStrip.tsx \
        src/components/marketing/MoreInProductStrip.test.tsx
git commit -m "feat(marketing): MoreInProductStrip — dense feature list below tiles"
```

---

## Task 5: Rewrite `BentoFeatures.tsx`

**Files:**

- Modify: `src/components/marketing/BentoFeatures.tsx` (complete rewrite)

This task removes the spotlight effect, `BentoCard`, `CARDS` array, `ReadinessMockup`, and 12-col grid. It composes the 3 tiles + strip with the existing `ScrollReveal` entrance animation.

- [ ] **Step 1: Replace `BentoFeatures.tsx` contents**

Overwrite `src/components/marketing/BentoFeatures.tsx` with:

```tsx
"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   BentoFeatures (rebuild — 2026-05-11)
   ────────────────────────────────────
   Section header + three hand-tuned mockup tiles + dense "more in the product"
   strip. Replaces the previous 7-card icon+title+desc template per
   Frontend Audit Prompt 8. See:
     docs/superpowers/specs/2026-05-11-marketing-bento-rebuild-design.md
   ═══════════════════════════════════════════════════════════════════════════ */

import ScrollReveal from "./ScrollReveal";
import MonoLabel from "./MonoLabel";
import { ValidatedSessionTile } from "./tiles/ValidatedSessionTile";
import { UnifiedPRTile } from "./tiles/UnifiedPRTile";
import { PoseAnalysisTile } from "./tiles/PoseAnalysisTile";
import { MoreInProductStrip } from "./MoreInProductStrip";

export default function BentoFeatures() {
  return (
    <section
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "64px 16px",
      }}
    >
      {/* Section header */}
      <ScrollReveal>
        <div style={{ marginBottom: 40 }}>
          <MonoLabel>The Three Things</MonoLabel>
          <h2
            className="font-heading"
            style={{
              fontWeight: 800,
              fontSize: 36,
              lineHeight: 1.1,
              letterSpacing: "-0.035em",
              color: "var(--landing-text)",
              margin: 0,
              marginTop: 8,
            }}
          >
            Built specifically for throws coaches.
          </h2>
        </div>
      </ScrollReveal>

      {/* Three tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        <ScrollReveal delay={0}>
          <ValidatedSessionTile />
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <UnifiedPRTile />
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <PoseAnalysisTile />
        </ScrollReveal>
      </div>

      {/* More-in-product strip */}
      <ScrollReveal delay={0.3}>
        <MoreInProductStrip />
      </ScrollReveal>
    </section>
  );
}
```

Note the `grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))` — this gives:

- Desktop (wide): 3 columns
- Tablet (medium): 2 columns + 1 wrapped
- Mobile (narrow): 1 column (each tile full width)

No media queries needed.

- [ ] **Step 2: Run all marketing tests**

Run: `npx vitest run src/components/marketing/`
Expected: PASS (all smoke tests across all 4 new components)

- [ ] **Step 3: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors. Old `BentoCard`/`CARDS`/`ReadinessMockup`/spotlight references should be fully gone (the file is replaced wholesale).

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/BentoFeatures.tsx
git commit -m "refactor(marketing): BentoFeatures = 3 tiles + strip, drop 7-card template"
```

---

## Task 6: Visual verification + PR

This task is manual. No code changes unless something looks wrong.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

Wait until you see `Local: http://localhost:3000` (or whatever port).

- [ ] **Step 2: Open the landing page**

Navigate to `http://localhost:3000` in a browser.

- [ ] **Step 3: Verify visual checks**

Scroll to the bento section (between the demo video and the Bondarchuk proof). Confirm:

- [ ] Section header reads "The Three Things · Built specifically for throws coaches."
- [ ] Three tiles render side-by-side on desktop, each ~380px wide
- [ ] **Tile 1 (Validated Session):** Header shows `SESSION · TUE 09:00` and a green `✓ VALID` badge. Three blocks visible (9kg → 7.26kg → 6kg). Footer reads about Vol IV with a green left-border.
- [ ] **Tile 2 (Unified PR):** "MJ" avatar circle, name "Marcus Johnson", three implement rows. The 7.26 KG row is tinted amber and shows `↑ comp · last Fri`. Footer mentions catalog-keyed dedupe.
- [ ] **Tile 3 (Pose Analysis):** Pose silhouette on left (green skeleton, amber throwing arm), three measurements on right (Trunk lean 28° amber / Release angle 42° green / Knee drive 138° neutral) with progress bars and target-range subtitles.
- [ ] "More in the product" strip below shows 5 features separated by `·` with a mono uppercase overline above.

- [ ] **Step 4: Resize to mobile**

Resize browser to ~360px wide (or use Chrome DevTools mobile preview).

- [ ] Tiles stack vertically, full width
- [ ] Each tile readable; nothing overflows
- [ ] "More in product" strip wraps gracefully across multiple lines

- [ ] **Step 5: Check dark theme**

Already dark (marketing is always-dark). Verify nothing renders white-on-white or has bad contrast.

- [ ] **Step 6: Test reduced motion**

In DevTools, set `prefers-reduced-motion: reduce` and reload. Verify tiles still appear (no entrance animation = OK).

- [ ] **Step 7: Stop dev server**

Press `Ctrl+C` in the terminal running `npm run dev`.

- [ ] **Step 8: Open the PR**

```bash
git push -u origin <feature-branch-name>
gh pr create --title "feat(marketing): rebuild bento — 3 tiles + strip" --body "$(cat <<'EOF'
## Summary

Implements Frontend Audit Prompt 8 per the spec at
\`docs/superpowers/specs/2026-05-11-marketing-bento-rebuild-design.md\`.

Replaces the 7-card icon+title+desc bento with 3 hand-tuned mockup tiles
(Validated Session, Unified PR, Pose Analysis) plus a single text strip
listing remaining features.

## Tiles

| Tile | What it shows |
|------|---------------|
| ValidatedSessionTile | Descending 9kg→7.26kg→6kg session with Vol IV citation |
| UnifiedPRTile | Per-implement PRs for Marcus Johnson, comp weight amber-highlighted |
| PoseAnalysisTile | Pose silhouette + throws-specific angles vs ideal ranges |

## What goes away

- BentoCard component
- 7 templated card entries
- ReadinessMockup helper
- Cursor-tracked spotlight effect
- 12-col asymmetric grid

## Test plan

- [x] Smoke tests pass for each tile + strip
- [x] Visual eyeball on desktop, tablet, mobile widths
- [x] Reduced motion preference respected
- [x] Dark theme readable across all tiles

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"

gh pr merge --auto --squash --delete-branch
```

- [ ] **Step 9: Wait for auto-merge**

CI runs (lint + tsc + vitest + deploy-preview), branch auto-rebases if needed, squash-merges when green.

- [ ] **Step 10: Sync local main**

```bash
git checkout main
git pull origin main
```

---

## Self-review (run after writing this plan, fix inline)

**Spec coverage check:**

| Spec section                                             | Implementation task                                 |
| -------------------------------------------------------- | --------------------------------------------------- |
| Tile A (Validated session)                               | Task 1                                              |
| Tile B (Unified PR card)                                 | Task 2                                              |
| Tile C (Frame + measurements)                            | Task 3                                              |
| Section header copy                                      | Task 5                                              |
| "More in the product" strip                              | Task 4                                              |
| 3-tile responsive layout                                 | Task 5 (auto-fit minmax grid)                       |
| ScrollReveal entrance staggered                          | Task 5 (delay 0/0.1/0.2/0.3)                        |
| Removed: BentoCard / CARDS / ReadinessMockup / spotlight | Task 5 (wholesale replacement)                      |
| File structure (tiles/ subdir)                           | Tasks 1–3                                           |
| Test scope (smoke tests)                                 | Each tile task includes one                         |
| Out-of-scope (other marketing)                           | Untouched — no task modifies StickyFeatures etc.    |
| Color rule for Tile C                                    | Task 3 — `tone` prop encodes in-range/close/neutral |

All spec sections covered.

**Placeholder scan:** None. All code blocks contain complete content.

**Type consistency check:**

- `<ValidatedSessionTile />`, `<UnifiedPRTile />`, `<PoseAnalysisTile />`, `<MoreInProductStrip />` — all components take no props. Consistent in Tasks 1–4 (definitions) and Task 5 (consumption).
- `Block` (inside ValidatedSessionTile) props: `classification`, `implement`, `marker`, `emphasized?`. Used internally only.
- `PRRow` (inside UnifiedPRTile) props: `weight`, `distance`, `marker`, `isComp?`. Used internally only.
- `Measurement` (inside PoseAnalysisTile) props: `label`, `value`, `fill: number`, `subtitle`, `tone: "in-range" | "close" | "neutral"`. Used internally only.

No type drift between tasks.

**Scope:** Single bounded feature — marketing bento rebuild. No backend, no schema, no API changes. All in `src/components/marketing/`. Plan is the right size for one PR.
