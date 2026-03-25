# Composition Patterns Overhaul — Design Spec

**Date:** 2026-03-25
**Approach:** Bottom-Up (Foundation → Pages)
**React version:** 18.3 (forwardRef still required for ref forwarding)

---

## Problem Statement

The Podium Throws component library has grown organically. While core UI components (Card, Tabs, Modal) already use good composition patterns, several components have accumulated tight state/UI coupling, boolean prop proliferation, and god-component bloat. This overhaul applies React composition patterns systematically across the codebase to improve maintainability, testability, and developer velocity.

## Out of Scope

- Components that are already well-composed: Card, Tabs, Modal, EmptyState, Button, StatCard, MiniStat
- `podium-throws-panel.tsx` — large (945 lines) but cohesive single-purpose panel, not a composition problem
- React 19 migration (project is on React 18.3)
- New dependencies or design system changes
- Visual/behavioral changes to the UI

## Constraints

- All existing imports and usages must continue to work (backwards-compatible exports)
- No new dependencies — React patterns only
- Existing design system tokens, CSS classes, and animation patterns are preserved
- CLAUDE.md design system rules (card-interactive, AnimatedNumber, etc.) remain enforced
- All new files containing hooks or browser APIs must include the `"use client"` directive (Next.js App Router requirement)

---

## Phase 1: Core UI — DataTable Hook Extraction

### Current State
`src/components/ui/DataTable.tsx` (321 lines) owns search, sort, and pagination state AND renders the entire table. Consumers cannot:
- Place the search bar elsewhere in their layout
- Add external filters that compose with the built-in search
- Control pagination from a parent component
- Reuse the table state logic without the table UI

### Proposed Change

**New file:** `src/components/ui/useDataTable.ts`
- Extracts all state management: search filtering, sort logic, pagination math
- Accepts config options: `{ data, columns, pageSize, loading }` — `loading` is a pass-through (not derived state)
- Returns prop-spread objects for each sub-component
- Generic over `T` like the current DataTable

**Modified file:** `src/components/ui/DataTable.tsx`
- Refactored into compound components: `DataTable.Search`, `DataTable.Root`, `DataTable.Header`, `DataTable.Body`, `DataTable.Pagination`
- Each sub-component consumes state from context provided by a `DataTableProvider`
- The existing `<DataTable>` single-component API remains as a convenience wrapper that composes the compound parts internally — zero breaking changes

### API Design

```tsx
// Convenience API (existing — no changes for current consumers)
<DataTable data={athletes} columns={cols} searchable pageSize={10} />

// Compound API (new — for custom layouts)
const table = useDataTable({ data: athletes, columns: cols, pageSize: 10 });

<DataTableProvider value={table}>
  <div className="flex justify-between">
    <h2>Athletes</h2>
    <DataTable.Search placeholder="Search athletes..." />
  </div>
  <DataTable.Root>
    <DataTable.Header />
    <DataTable.Body />
  </DataTable.Root>
  <DataTable.Pagination />
</DataTableProvider>
```

### Context Interface (state-context-interface pattern)

```ts
interface DataTableContext<T> {
  // State
  filtered: T[];
  paged: T[];
  query: string;
  sortKey: string | null;
  sortDir: SortDirection;
  page: number;
  totalPages: number;
  columns: Column<T>[];

  // Actions
  setQuery: (q: string) => void;
  toggleSort: (key: string) => void;
  setPage: (p: number) => void;

  // Meta
  loading: boolean;
  rowKey: keyof T;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
}
```

### Files Changed
| File | Action |
|------|--------|
| `src/components/ui/useDataTable.ts` | Create — hook with all state logic |
| `src/components/ui/DataTable.tsx` | Modify — refactor into compound components, keep convenience wrapper |
| `src/components/index.ts` | Modify — add exports for DataTableProvider, useDataTable, and compound sub-components |

---

## Phase 2: Domain Components — VideoAnalysisWorkspace Provider Split

### Current State
`src/components/video/VideoAnalysisWorkspace.tsx` (1,203 lines) manages:
- Playback state (currentTime, duration, playbackSpeed, isPlaying)
- Frame extraction (useFrameExtractor hook)
- Zoom/pan state (useZoomPan hook)
- Video A/B sync logic (drift correction, snapping)
- Annotation rendering
- Full UI (video elements, jog wheel, speed controls, canvas)
- Imperative handle via forwardRef + useImperativeHandle for parent seekTo()

This makes it impossible to:
- Reuse playback controls in a different layout
- Access video state from sibling components without prop drilling
- Test playback logic independently from rendering

### Proposed Structure

```
src/components/video/
  VideoWorkspaceProvider.tsx   — Playback + sync state, context provider
  useVideoWorkspace.ts         — Hook to consume context (replaces forwardRef)
  VideoCanvas.tsx              — Video element + annotation overlay (consumer)
  PlaybackControls.tsx         — Jog wheel, speed selector, play/pause (consumer)
  SplitViewLayout.tsx          — Single/split/ghost layout orchestration
  VideoAnalysisWorkspace.tsx   — Thin composed shell (backwards-compatible)
```

### Provider Design (state-decouple-implementation pattern)

```ts
interface VideoWorkspaceState {
  // State
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackSpeed: number;
  mode: "single" | "split" | "ghost";
  ghostOpacity: number;
  zoomPan: ZoomPanState;

  // Actions
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  setGhostOpacity: (v: number) => void;
  stepForward: () => void;
  stepBackward: () => void;

  // Meta
  videoARef: RefObject<HTMLVideoElement>;
  videoBRef: RefObject<HTMLVideoElement>;
  frameReady: boolean;
}
```

### Key Decisions
- **forwardRef eliminated:** Parents that need `seekTo()` now wrap their tree in `<VideoWorkspaceProvider>` and call `useVideoWorkspace().seekTo()`. This is cleaner than imperative handles.
- **Sync logic stays in the provider:** The drift correction between videoA and videoB is an implementation detail of playback state — consumers don't need to know about it.
- **Annotation state stays prop-based:** Annotations are passed in from the page (they're persisted data, not transient UI state). The provider only owns transient playback state.

### Backwards Compatibility
The existing `<VideoAnalysisWorkspace>` export becomes a thin shell:

```tsx
export function VideoAnalysisWorkspace(props: Props) {
  return (
    <VideoWorkspaceProvider videoA={props.videoA} videoB={props.videoB} mode={props.mode}>
      <SplitViewLayout>
        <VideoCanvas annotations={props.annotations} /* ... */ />
      </SplitViewLayout>
      <PlaybackControls />
    </VideoWorkspaceProvider>
  );
}
```

**VideoAnalysisWorkspaceHandle migration:**
- The `VideoAnalysisWorkspaceHandle` type must continue to be exported from the workspace module (deprecated, with a comment pointing to `useVideoWorkspace`)
- The known consumer `src/app/(dashboard)/coach/videos/[id]/_video-editor.tsx` uses `useRef<VideoAnalysisWorkspaceHandle>(null)` to call `seekTo()`. This consumer must be migrated to wrap its tree in `<VideoWorkspaceProvider>` and use the `useVideoWorkspace()` hook instead of the ref pattern.

### Files Changed
| File | Action |
|------|--------|
| `src/components/video/VideoWorkspaceProvider.tsx` | Create — all playback + sync state |
| `src/components/video/useVideoWorkspace.ts` | Create — context consumer hook |
| `src/components/video/VideoCanvas.tsx` | Create — video element + annotation overlay |
| `src/components/video/PlaybackControls.tsx` | Create — jog wheel, speed, play/pause |
| `src/components/video/SplitViewLayout.tsx` | Create — single/split/ghost layout |
| `src/components/video/VideoAnalysisWorkspace.tsx` | Rewrite — thin composed shell, keep deprecated VideoAnalysisWorkspaceHandle export |
| `src/app/(dashboard)/coach/videos/[id]/_video-editor.tsx` | Modify — migrate from ref/imperative handle to VideoWorkspaceProvider + useVideoWorkspace |

---

## Phase 3a: Page Components — tools-page Decomposition

### Current State
`src/components/tools-page.tsx` (4,408 lines) is the largest file in the codebase. It contains:
- 6 calculator tool tabs (Strength, Body Stats, Cardio, Nutrition, Running, Converters)
- Shared UI helpers (CalcCard, Row)
- Inline SVG icon paths
- All state for every calculator in a single component tree

### Proposed Structure

```
src/components/tools/
  ToolsPage.tsx                — Tab shell only (~60 lines)
  ToolCard.tsx                 — Shared CalcCard + Row helpers
  StrengthCalculators.tsx      — 1RM, Wilks, plate calculator
  BodyStatsCalculators.tsx     — BMI, body composition
  CardioCalculators.tsx        — HR zones, VO2max estimation
  NutritionCalculators.tsx     — Macro calculator, hydration
  RunningCalculators.tsx       — Pace, splits
  ConverterCalculators.tsx     — Unit converters
```

### Key Decisions
- Each calculator module owns its own state — no shared state between tabs
- `ToolCard.tsx` extracts `CalcCard` and `Row` helpers currently defined inline
- The SVG icon paths move into the tab definitions in `ToolsPage.tsx` (they're just data)
- `ToolsPage` uses existing `<Tabs>` compound component for tab rendering
- The old `tools-page.tsx` file gets a re-export for backwards compatibility:
  ```tsx
  export { ToolsPage as default } from "./tools/ToolsPage";
  ```

### Files Changed
| File | Action |
|------|--------|
| `src/components/tools/ToolsPage.tsx` | Create — tab shell |
| `src/components/tools/ToolCard.tsx` | Create — shared CalcCard + Row |
| `src/components/tools/StrengthCalculators.tsx` | Create |
| `src/components/tools/BodyStatsCalculators.tsx` | Create |
| `src/components/tools/CardioCalculators.tsx` | Create |
| `src/components/tools/NutritionCalculators.tsx` | Create |
| `src/components/tools/RunningCalculators.tsx` | Create |
| `src/components/tools/ConverterCalculators.tsx` | Create |
| `src/components/tools-page.tsx` | Replace with re-export |

---

## Phase 3b: Dead Code Removal — exercise-library-page

### Current State
`src/components/exercise-library-page.tsx` (754 lines) has **zero importers** anywhere in the codebase. The coach exercises page (`/src/app/(dashboard)/coach/exercises/page.tsx`) uses `_exercises-table.tsx` instead. There is no athlete exercises page that uses this file.

This was originally planned as a variant extraction refactor, but spec review revealed the file is dead code.

### Action
Delete the file. No refactoring needed — this is pure cleanup.

### Files Changed
| File | Action |
|------|--------|
| `src/components/exercise-library-page.tsx` | Delete — unused, zero importers |

---

## Phase 4: Cleanup Pass

### 4a. Deduplicate CLASSIFICATION_COLORS

`CLASSIFICATION_COLORS` is defined in **4 files** with different type signatures:

| File | Type Signature | Key Differences |
|------|---------------|-----------------|
| `src/components/session/throw-block-card.tsx` (line 26) | `Record<string, string>` — single class string | Includes SDE/SPE/GPE variants, emerald/blue/amber/purple |
| `src/components/session/strength-block-card.tsx` (line 12) | `Record<string, string>` — identical to above | Exact duplicate of throw-block-card |
| `src/app/(dashboard)/coach/throws/program-builder/_program-builder-wizard.tsx` (line 193) | `Record<string, { bg: string; text: string }>` — object value | Different structure, uses amber/blue instead of emerald/blue |
| `src/app/(dashboard)/coach/throws/builder/page.tsx` (line 93) | `Record<Classification, string>` — typed key | Uses `Classification` type (already in constants.ts), green instead of emerald |

**Action:** Extend `src/lib/throws/constants.ts` (which already exports the `Classification` type) with a canonical `CLASSIFICATION_COLORS` mapping. Export two variants:
1. `CLASSIFICATION_COLORS` — `Record<Classification, string>` with the single Tailwind class string (for session cards and builder page)
2. `CLASSIFICATION_COLOR_PARTS` — `Record<Classification, { bg: string; text: string }>` (for program-builder wizard)

Normalize the actual color values to be consistent (e.g., always emerald for CE, not sometimes green). Update all 4 consumer files.

### 4b. Remove VideoAnalysisWorkspace forwardRef

Handled by Phase 2 — the `forwardRef` + `useImperativeHandle` pattern is replaced by context-based `useVideoWorkspace()`.

### Files Changed
| File | Action |
|------|--------|
| `src/lib/throws/constants.ts` | Extend — add CLASSIFICATION_COLORS and CLASSIFICATION_COLOR_PARTS |
| `src/components/session/throw-block-card.tsx` | Modify — import from shared constants |
| `src/components/session/strength-block-card.tsx` | Modify — import from shared constants |
| `src/app/(dashboard)/coach/throws/program-builder/_program-builder-wizard.tsx` | Modify — import CLASSIFICATION_COLOR_PARTS |
| `src/app/(dashboard)/coach/throws/builder/page.tsx` | Modify — import CLASSIFICATION_COLORS |

---

## Implementation Order

1. Phase 3b first (dead code deletion) — zero risk, immediate cleanup
2. Phase 4a (constants dedup) — small, builds confidence, normalizes colors across codebase
3. Phase 1 (DataTable) — core UI foundation
4. Phase 3a (tools-page) — biggest line-count reduction, independent of other phases
5. Phase 2 (VideoAnalysisWorkspace) — most complex refactor, saved for last
6. Phase 4b (forwardRef removal) — automatic outcome of Phase 2

Each phase is independently shippable and testable.

## Verification Criteria

- `tsc --noEmit` passes with 0 errors after each phase
- `npm run lint` passes after each phase
- All existing page routes render identically (visual regression: manual check)
- No new dependencies added
- Every existing import path continues to work via re-exports
