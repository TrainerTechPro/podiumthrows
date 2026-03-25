# Composition Patterns Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply React composition patterns across the Podium Throws component library to reduce god-component bloat, decouple state from UI, and eliminate boolean prop proliferation.

**Architecture:** Bottom-up approach — start with dead code removal and constant dedup, then refactor DataTable with hook extraction + compound components, decompose the 4,408-line tools-page into modules, and finally split VideoAnalysisWorkspace into a provider/consumer pattern. Each phase is independently shippable.

**Tech Stack:** React 18.3, TypeScript, Next.js 14.2 App Router, Tailwind CSS, custom component library

**Spec:** `docs/superpowers/specs/2026-03-25-composition-patterns-overhaul-design.md`

---

## Task 1: Delete Dead Code — exercise-library-page

**Files:**
- Delete: `src/components/exercise-library-page.tsx`

- [ ] **Step 1: Verify zero importers**

Run: `grep -r "exercise-library-page" src/ --include="*.tsx" --include="*.ts"`
Expected: 0 matches (file is dead code)

- [ ] **Step 2: Delete the file**

```bash
rm src/components/exercise-library-page.tsx
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "chore: remove dead exercise-library-page.tsx (zero importers)"
```

---

## Task 2: Deduplicate CLASSIFICATION_COLORS

**Files:**
- Modify: `src/lib/throws/constants.ts` — add canonical color exports
- Modify: `src/components/session/throw-block-card.tsx:26-33` — replace inline definition
- Modify: `src/components/session/strength-block-card.tsx:12-19` — replace inline definition
- Modify: `src/app/(dashboard)/coach/throws/program-builder/_program-builder-wizard.tsx:193` — replace inline definition
- Modify: `src/app/(dashboard)/coach/throws/builder/page.tsx:93` — replace inline definition

- [ ] **Step 1: Add canonical color constants to `src/lib/throws/constants.ts`**

Append after the existing `Classification` type export (line 16):

```ts
// ── Classification Display Colors ────────────────────────────────
// Canonical Tailwind class strings for Bondarchuk exercise classifications.
// CE = Competitive Exercise (emerald), SD/SDE = Specific Developmental (blue),
// SP/SPE = Specific Preparatory (amber), GP/GPE = General Preparatory (purple)

export const CLASSIFICATION_COLORS: Record<string, string> = {
  CE: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  SD: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  SDE: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  SP: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  SPE: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  GP: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
  GPE: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
};

export const CLASSIFICATION_COLOR_PARTS: Record<string, { bg: string; text: string }> = {
  CE: { bg: "bg-emerald-100 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400" },
  SD: { bg: "bg-blue-100 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400" },
  SDE: { bg: "bg-blue-100 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400" },
  SP: { bg: "bg-amber-100 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400" },
  SPE: { bg: "bg-amber-100 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400" },
  GP: { bg: "bg-purple-100 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-400" },
  GPE: { bg: "bg-purple-100 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-400" },
};
```

- [ ] **Step 2: Update `throw-block-card.tsx` — replace inline CLASSIFICATION_COLORS**

Replace lines 26-33 with:

```ts
import { CLASSIFICATION_COLORS } from "@/lib/throws/constants";
```

Remove the local `CLASSIFICATION_COLORS` constant.

- [ ] **Step 3: Update `strength-block-card.tsx` — replace inline CLASSIFICATION_COLORS**

Replace lines 12-19 with:

```ts
import { CLASSIFICATION_COLORS } from "@/lib/throws/constants";
```

Remove the local `CLASSIFICATION_COLORS` constant.

- [ ] **Step 4: Update `_program-builder-wizard.tsx` — use CLASSIFICATION_COLOR_PARTS**

Replace the inline `Record<string, { bg: string; text: string }>` definition at line 193 with:

```ts
import { CLASSIFICATION_COLOR_PARTS } from "@/lib/throws/constants";
```

Update usages to reference `CLASSIFICATION_COLOR_PARTS` instead of the local variable. Verify that the consumer code accesses `.bg` and `.text` fields — these match the new export.

**Deliberate visual change:** The wizard currently shows CE as amber (`bg-amber-100 dark:bg-amber-900/30`). The canonical constant normalizes CE to emerald (`bg-emerald-100 dark:bg-emerald-900/20`) to match the session cards and builder page. This is an intentional design normalization — CE (Competitive Exercise) should be emerald everywhere. The dark mode opacity also changes from `/30` to `/20` for consistency.

- [ ] **Step 5: Update `builder/page.tsx` — use CLASSIFICATION_COLORS**

Replace the inline `Record<Classification, string>` definition at line 93 with:

```ts
import { CLASSIFICATION_COLORS } from "@/lib/throws/constants";
```

Note: the old definition used `bg-green-100` for CE; the canonical constant uses `bg-emerald-100`. This is an intentional normalization — emerald is the correct CE color per the design system.

- [ ] **Step 6: Verify build + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/throws/constants.ts src/components/session/throw-block-card.tsx src/components/session/strength-block-card.tsx "src/app/(dashboard)/coach/throws/program-builder/_program-builder-wizard.tsx" "src/app/(dashboard)/coach/throws/builder/page.tsx"
git commit -m "refactor: deduplicate CLASSIFICATION_COLORS into shared constants"
```

---

## Task 3: DataTable — Extract useDataTable Hook

**Files:**
- Create: `src/components/ui/useDataTable.ts`
- Modify: `src/components/ui/DataTable.tsx`
- Modify: `src/components/index.ts`

- [ ] **Step 1: Create `src/components/ui/useDataTable.ts`**

Extract all state logic from `DataTable.tsx` lines 73-121 into a standalone hook:

```ts
import { useState, useMemo, useCallback } from "react";
import type { Column, SortDirection } from "./DataTable";

export interface UseDataTableOptions<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  loading?: boolean;
}

export interface UseDataTableReturn<T> {
  // State
  filtered: T[];
  paged: T[];
  sorted: T[];
  query: string;
  sortKey: string | null;
  sortDir: SortDirection;
  page: number;
  totalPages: number;

  // Actions
  setQuery: (q: string) => void;
  toggleSort: (key: string) => void;
  setPage: (p: number) => void;

  // Meta
  loading: boolean;
  columns: Column<T>[];
}

export function useDataTable<T extends Record<string, unknown>>({
  data,
  columns,
  pageSize = 10,
  loading = false,
}: UseDataTableOptions<T>): UseDataTableReturn<T> {
  const [query, setQueryRaw] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const raw = row[col.key as keyof T];
        return String(raw ?? "").toLowerCase().includes(q);
      })
    );
  }, [data, query, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey as keyof T];
      const bv = b[sortKey as keyof T];
      if (av === bv) return 0;
      const cmp = av! < bv! ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const paged = pageSize > 0
    ? sorted.slice((page - 1) * pageSize, page * pageSize)
    : sorted;

  const setQuery = useCallback((v: string) => { setQueryRaw(v); setPage(1); }, []);

  const toggleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("asc");
      return key;
    });
    setPage(1);
  }, []);

  return {
    filtered, paged, sorted, query, sortKey, sortDir, page, totalPages,
    setQuery, toggleSort, setPage,
    loading, columns,
  };
}
```

- [ ] **Step 2: Refactor `DataTable.tsx` to use the hook internally**

Replace the state management in lines 73-121 with a call to `useDataTable`:

```tsx
import { useDataTable } from "./useDataTable";

// Inside the DataTable component, replace lines 73-121 with:
const {
  paged: paginated,
  sorted,
  query,
  sortKey,
  sortDir,
  page,
  totalPages,
  setQuery: handleSearch,
  toggleSort,
  setPage,
  loading: isLoading,
} = useDataTable({ data, columns, pageSize, loading });
```

Update `handleSort` to use `toggleSort`:
```tsx
const handleSort = (col: Column<T>) => {
  if (!col.sortable) return;
  toggleSort(String(col.key));
};
```

Remove the old `filtered`, `sorted`, `paginated`, `totalPages`, `handleSearch`, and `handleSort` code. Keep all JSX rendering unchanged.

- [ ] **Step 3: Update `src/components/index.ts` — add hook export**

Add after the existing DataTable export (line 34):

```ts
export { useDataTable } from "./ui/useDataTable";
export type { UseDataTableOptions, UseDataTableReturn } from "./ui/useDataTable";
```

- [ ] **Step 4: Verify build + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/useDataTable.ts src/components/ui/DataTable.tsx src/components/index.ts
git commit -m "refactor: extract useDataTable hook from DataTable component"
```

---

## Task 3b: DataTable — Add Compound Component API

**Files:**
- Modify: `src/components/ui/DataTable.tsx` — add DataTableProvider, sub-components, and namespace exports
- Modify: `src/components/index.ts` — export DataTableProvider

- [ ] **Step 1: Add DataTableProvider and context to `DataTable.tsx`**

Add a context + provider that wraps the `useDataTable` hook return value:

```tsx
import { createContext, useContext, type ReactNode } from "react";
import { useDataTable, type UseDataTableReturn } from "./useDataTable";

const DataTableCtx = createContext<UseDataTableReturn<any> | null>(null);

function useDataTableContext<T>() {
  const ctx = useContext(DataTableCtx) as UseDataTableReturn<T> | null;
  if (!ctx) throw new Error("DataTable compound components must be used within <DataTableProvider>");
  return ctx;
}

export function DataTableProvider<T extends Record<string, unknown>>({
  value,
  children,
}: {
  value: UseDataTableReturn<T>;
  children: ReactNode;
}) {
  return <DataTableCtx.Provider value={value}>{children}</DataTableCtx.Provider>;
}
```

- [ ] **Step 2: Add compound sub-components**

Add these after the `DataTableProvider`:

```tsx
function DTSearch({ placeholder = "Search…" }: { placeholder?: string }) {
  const { query, setQuery } = useDataTableContext();
  return (
    <div className="relative flex-1 min-w-[180px] max-w-xs">
      <SearchLucide size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
    </div>
  );
}

// DTHeader, DTBody, DTPagination — extract the corresponding JSX sections
// from the existing DataTable component's render method into standalone
// components that read from useDataTableContext().
```

Note to implementer: Extract the table header (`<thead>` section), table body (`<tbody>` section), and pagination section into `DTHeader`, `DTBody`, and `DTPagination` components. Each reads columns, sorting state, etc. from context. Also create a `DTRoot` wrapper that provides the `<div className="card overflow-hidden"><div className="overflow-x-auto"><table>` scaffolding.

- [ ] **Step 3: Attach sub-components to DataTable namespace**

```tsx
DataTable.Search = DTSearch;
DataTable.Root = DTRoot;
DataTable.Header = DTHeader;
DataTable.Body = DTBody;
DataTable.Pagination = DTPagination;
```

To make this work with TypeScript, add the namespace declaration:

```tsx
export namespace DataTable {
  export type Search = typeof DTSearch;
  // ... etc
}
// Or use Object.assign pattern:
export const DataTableCompound = Object.assign(DataTable, {
  Search: DTSearch,
  Root: DTRoot,
  Header: DTHeader,
  Body: DTBody,
  Pagination: DTPagination,
});
```

Choose whichever pattern compiles cleanly with `tsc --noEmit`. The existing `DataTable` convenience function must remain the default export/named export.

- [ ] **Step 4: Update `src/components/index.ts`**

Add `DataTableProvider` to the exports:

```ts
export { DataTableProvider } from "./ui/DataTable";
```

- [ ] **Step 5: Verify build + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors. All existing `<DataTable>` usages still work unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/DataTable.tsx src/components/index.ts
git commit -m "refactor: add DataTable compound component API (Search, Root, Header, Body, Pagination)"
```

---

## Task 4: Tools Page — Extract Shared Helpers

**Files:**
- Create: `src/components/tools/ToolCard.tsx`

- [ ] **Step 1: Create `src/components/tools/ToolCard.tsx`**

Extract the shared helper functions from `tools-page.tsx`. The authoritative boundaries are the **function names**, not line numbers:

- `CalcCard` (starts ~line 46)
- `Row` (starts ~line 76)
- `NumInput` (starts ~line 85)
- `Select` (starts ~line 114)
- `ResultBox` (starts ~line 134)
- `UnitToggle` (starts ~line 146)
- `CalcButton` (starts ~line 166)
- `fmt` (starts ~line 182)

**Do NOT include** `ORM_PERCENTS` or `ORM_REPS` (~lines 190-192) — those are Strength-specific and belong in `StrengthCalculators.tsx`.

Create the directory first: `mkdir -p src/components/tools`

Copy each function **exactly** from `tools-page.tsx`, preserving all props, types, and styles. Add `export` to each function. Prefix the file with `"use client";`.

Note: These helpers use inline `<svg>` icons (not Lucide). This is existing code — migrating to Lucide is out of scope for this refactor.

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/ToolCard.tsx
git commit -m "refactor: extract shared tool calculator helpers into ToolCard"
```

---

## Task 5: Tools Page — Extract Calculator Modules

**Files:** (function names are authoritative; line numbers are approximate)
- Create: `src/components/tools/StrengthCalculators.tsx` — `OneRMCalc` through `StrengthTab` (~lines 194-942). Also include `ORM_PERCENTS`/`ORM_REPS` constants (~lines 190-192) which are Strength-specific.
- Create: `src/components/tools/BodyStatsCalculators.tsx` — `BMICalc` through `BodyStatsTab` (~lines 943-1760)
- Create: `src/components/tools/CardioCalculators.tsx` — `TargetHRCalc` through `CardioTab` (~lines 1761-2647)
- Create: `src/components/tools/NutritionCalculators.tsx` — `CalorieCalc` through `NutritionTab` (~lines 2649-3323)
- Create: `src/components/tools/RunningCalculators.tsx` — `secsToHMS` through `RunningTab` (~lines 3325-4155)
- Create: `src/components/tools/ConverterCalculators.tsx` — `WeightConverter` through `ConvertersTab` (~lines 4157-4349)

- [ ] **Step 1: Create each calculator module**

For each file:
1. Add `"use client";` at the top
2. Import shared helpers: `import { CalcCard, Row, NumInput, Select, ResultBox, UnitToggle, CalcButton, fmt } from "./ToolCard";`
3. Copy all calculator functions from the specified line ranges
4. Export only the `*Tab` function (e.g., `export function StrengthTab()`)
5. Keep all internal calculator functions as module-private (no `export`)

Each module should import `{ useState, useMemo, useCallback }` from React as needed.

- [ ] **Step 2: Verify each module compiles individually**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/
git commit -m "refactor: extract 6 calculator modules from tools-page"
```

---

## Task 6: Tools Page — Create Shell and Replace Original

**Files:**
- Create: `src/components/tools/ToolsPage.tsx`
- Modify: `src/components/tools-page.tsx` — replace with re-export

- [ ] **Step 1: Create `src/components/tools/ToolsPage.tsx`**

```tsx
"use client";

import { useState } from "react";
import { StrengthTab } from "./StrengthCalculators";
import { BodyStatsTab } from "./BodyStatsCalculators";
import { CardioTab } from "./CardioCalculators";
import { NutritionTab } from "./NutritionCalculators";
import { RunningTab } from "./RunningCalculators";
import { ConvertersTab } from "./ConverterCalculators";

interface TabDef {
  id: string;
  label: string;
  icon: string;
}

// Implementer: copy the TABS array verbatim from tools-page.tsx lines 15-42.
// It contains 6 entries (strength, bodystats, cardio, nutrition, running, converters)
// with id, label, and SVG icon path strings.
const TABS: TabDef[] = [
  { id: "strength", label: "Strength", icon: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" },
  { id: "bodystats", label: "Body Stats", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "cardio", label: "Cardio", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
  { id: "nutrition", label: "Nutrition", icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
  { id: "running", label: "Running", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { id: "converters", label: "Converters", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
];

interface ToolsPageProps {
  isCoach?: boolean;
}

export default function ToolsPage({ isCoach: _isCoach = false }: ToolsPageProps) {
  const [activeTab, setActiveTab] = useState("strength");

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <div className="mb-6">
          <h1 className="font-heading text-display text-gray-900 dark:text-gray-50">
            Fitness Calculators
          </h1>
          <p className="text-body text-gray-500 dark:text-gray-400 mt-1">
            Science-backed tools for strength, body composition, cardio and more
          </p>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 mb-5 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-caption font-medium whitespace-nowrap transition-all flex-shrink-0 min-h-[44px] ${
                activeTab === tab.id
                  ? "bg-primary-500 text-white shadow-sm"
                  : "bg-white dark:bg-surface-800 text-gray-600 dark:text-gray-400 border border-gray-200/80 dark:border-white/8 hover:border-primary-300 dark:hover:border-primary-600/40"
              }`}
            >
              <svg
                className="w-3.5 h-3.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "strength" && <StrengthTab />}
        {activeTab === "bodystats" && <BodyStatsTab />}
        {activeTab === "cardio" && <CardioTab />}
        {activeTab === "nutrition" && <NutritionTab />}
        {activeTab === "running" && <RunningTab />}
        {activeTab === "converters" && <ConvertersTab />}
      </div>
    </div>
  );
}
```

Note: The spec mentions using the project's `<Tabs>` compound component, but the existing tools page uses custom pill-style tab buttons with inline SVG icons — a visual style that differs from the `<Tabs>` component's underline/pills/boxed variants. Preserving the existing tab appearance exactly is more important than switching to `<Tabs>`. Migrating to `<Tabs>` can be done as a follow-up if desired.

- [ ] **Step 2: Replace `src/components/tools-page.tsx` with re-export**

Replace entire file contents with:

```tsx
export { default } from "./tools/ToolsPage";
```

This preserves both import paths:
- `src/app/(dashboard)/athlete/tools/page.tsx` imports `ToolsPage` from `@/components/tools-page`
- `src/app/(dashboard)/coach/tools/page.tsx` imports `ToolsPage` from `@/components/tools-page`

- [ ] **Step 3: Verify build + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors

- [ ] **Step 4: Verify page routes still render**

Both `/coach/tools` and `/athlete/tools` should render the calculator page identically.

- [ ] **Step 5: Commit**

```bash
git add src/components/tools/ src/components/tools-page.tsx
git commit -m "refactor: decompose 4408-line tools-page into modular calculator files"
```

---

## Task 7: VideoAnalysisWorkspace — Create Provider and Context Hook

**Files:**
- Create: `src/components/video/VideoWorkspaceProvider.tsx`
- Create: `src/components/video/useVideoWorkspace.ts`

- [ ] **Step 1: Create `src/components/video/useVideoWorkspace.ts`**

Define the context type and consumer hook:

```ts
"use client";

import { createContext, useContext } from "react";
import type { ZoomPanState } from "./useZoomPan";
import type { RefObject } from "react";

export interface VideoWorkspaceState {
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
  videoBRef: RefObject<HTMLVideoElement | null>;
  frameReady: boolean;
}

export const VideoWorkspaceContext = createContext<VideoWorkspaceState | null>(null);

export function useVideoWorkspace(): VideoWorkspaceState {
  const ctx = useContext(VideoWorkspaceContext);
  if (!ctx) {
    throw new Error("useVideoWorkspace must be used within a <VideoWorkspaceProvider>");
  }
  return ctx;
}
```

- [ ] **Step 2: Create `src/components/video/VideoWorkspaceProvider.tsx`**

Extract all playback state management from `VideoAnalysisWorkspace.tsx` into this provider. This includes:
- Video element refs (`videoARef`, `videoBRef`)
- Playback state (`currentTime`, `duration`, `isPlaying`, `playbackSpeed`)
- Frame extraction (`useFrameExtractor`)
- Zoom/pan state (`useZoomPan`)
- Sync logic (drift correction between videos A and B)
- All action callbacks (`seekTo`, `play`, `pause`, `togglePlay`, `setSpeed`, `stepForward`, `stepBackward`)

The provider accepts `videoA`, `videoB`, and `mode` as props (the data needed to initialize state), plus `children`.

```tsx
"use client";

import { useRef, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useZoomPan } from "./useZoomPan";
import { useFrameExtractor } from "./useFrameExtractor";
import { VideoWorkspaceContext, type VideoWorkspaceState } from "./useVideoWorkspace";
import {
  snapToFrame, frameIndexToTime, timeToFrameIndex,
  ANALYSIS_FPS, FRAME_STEP, PLAYBACK_SPEEDS,
} from "./types";

// Copy the VideoSource type from VideoAnalysisWorkspace.tsx lines 33-39

interface VideoWorkspaceProviderProps {
  videoA: VideoSource;
  videoB?: VideoSource;
  mode: "single" | "split" | "ghost";
  onTimeUpdate?: (time: number) => void;
  onDurationReady?: (duration: number) => void;
  children: ReactNode;
}

export function VideoWorkspaceProvider({ videoA, videoB, mode, onTimeUpdate, onDurationReady, children }: VideoWorkspaceProviderProps) {
  // Move ALL state logic from VideoAnalysisWorkspace.tsx into here.
  // The existing VideoAnalysisWorkspace.tsx lines 80-350 (approximately)
  // contain the state management — extract it all.

  // Build the context value:
  const value: VideoWorkspaceState = useMemo(() => ({
    currentTime, duration, isPlaying, playbackSpeed, mode,
    ghostOpacity, zoomPan,
    seekTo, play, pause, togglePlay, setSpeed,
    setGhostOpacity: handleGhostOpacityChange,
    stepForward, stepBackward,
    videoARef, videoBRef, frameReady,
  }), [/* deps */]);

  return (
    <VideoWorkspaceContext.Provider value={value}>
      {children}
    </VideoWorkspaceContext.Provider>
  );
}
```

Note to implementer: This is the most complex extraction. Read the full `VideoAnalysisWorkspace.tsx` carefully. Move ALL `useState`, `useRef`, `useCallback`, `useEffect`, and `useMemo` calls related to playback, sync, and frame extraction into this provider. Keep annotation-related props OUT of the provider — annotations remain prop-based.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: 0 errors (provider + hook compile independently)

- [ ] **Step 4: Commit**

```bash
git add src/components/video/VideoWorkspaceProvider.tsx src/components/video/useVideoWorkspace.ts
git commit -m "refactor: create VideoWorkspaceProvider and useVideoWorkspace hook"
```

---

## Task 8: VideoAnalysisWorkspace — Extract UI Consumers

**Files:**
- Create: `src/components/video/VideoCanvas.tsx`
- Create: `src/components/video/PlaybackControls.tsx`
- Create: `src/components/video/SplitViewLayout.tsx`

- [ ] **Step 1: Create `src/components/video/SplitViewLayout.tsx`**

Extract the single/split/ghost layout rendering logic. This component reads `mode` from `useVideoWorkspace()` and renders the appropriate video layout (one video, side-by-side, or overlaid with ghost opacity).

- [ ] **Step 2: Create `src/components/video/VideoCanvas.tsx`**

Extract the video element + annotation canvas overlay rendering. This component:
- Reads `videoARef`, `currentTime`, `zoomPan` from `useVideoWorkspace()`
- Accepts `annotations`, `isEditing`, `activeTool`, `activeColor`, `activeStrokeWidth`, `onAnnotationAdd` as props (annotation state is NOT in the provider)
- Renders the `<ZoomableVideoContainer>`, `<CanvasFrameRenderer>`, and `<AnnotationCanvas>`

- [ ] **Step 3: Create `src/components/video/PlaybackControls.tsx`**

Extract the jog wheel, speed selector, play/pause button, and timestamp display. This component reads all playback state from `useVideoWorkspace()` and calls its actions. No props needed — it's fully context-driven.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/video/VideoCanvas.tsx src/components/video/PlaybackControls.tsx src/components/video/SplitViewLayout.tsx
git commit -m "refactor: extract VideoCanvas, PlaybackControls, SplitViewLayout consumers"
```

---

## Task 9: VideoAnalysisWorkspace — Compose Shell and Migrate Consumer

**Files:**
- Rewrite: `src/components/video/VideoAnalysisWorkspace.tsx`
- Modify: `src/app/(dashboard)/coach/videos/[id]/_video-editor.tsx:22-25,51,235,415`

- [ ] **Step 1: Rewrite `VideoAnalysisWorkspace.tsx` as thin shell**

Replace the entire 1,203-line file with a composed shell:

```tsx
"use client";

import type { Annotation, AnnotationTool } from "./types";
import { VideoWorkspaceProvider } from "./VideoWorkspaceProvider";
import { SplitViewLayout } from "./SplitViewLayout";
import { VideoCanvas } from "./VideoCanvas";
import { PlaybackControls } from "./PlaybackControls";

type VideoSource = {
  src: string;
  poster?: string;
  title?: string;
  transcodedUrl?: string;
};

type Props = {
  videoA: VideoSource;
  videoB?: VideoSource;
  mode: "single" | "split" | "ghost";
  annotations: Annotation[];
  isEditing: boolean;
  activeTool: AnnotationTool;
  activeColor: string;
  activeStrokeWidth: number;
  onAnnotationAdd: (ann: Annotation) => void;
  onTimeUpdate?: (time: number) => void;
  onDurationReady?: (duration: number) => void;
  ghostOpacity?: number;
  onGhostOpacityChange?: (v: number) => void;
  className?: string;
};

/** @deprecated Use VideoWorkspaceProvider + useVideoWorkspace() instead */
export type VideoAnalysisWorkspaceHandle = {
  seekTo: (time: number) => void;
};

export function VideoAnalysisWorkspace({
  videoA, videoB, mode,
  annotations, isEditing, activeTool, activeColor, activeStrokeWidth,
  onAnnotationAdd, onTimeUpdate, onDurationReady,
  ghostOpacity, onGhostOpacityChange, className,
}: Props) {
  return (
    <VideoWorkspaceProvider
      videoA={videoA}
      videoB={videoB}
      mode={mode}
      onTimeUpdate={onTimeUpdate}
      onDurationReady={onDurationReady}
    >
      <div className={className}>
        <SplitViewLayout>
          <VideoCanvas
            annotations={annotations}
            isEditing={isEditing}
            activeTool={activeTool}
            activeColor={activeColor}
            activeStrokeWidth={activeStrokeWidth}
            onAnnotationAdd={onAnnotationAdd}
          />
        </SplitViewLayout>
        <PlaybackControls />
      </div>
    </VideoWorkspaceProvider>
  );
}
```

- [ ] **Step 2: Migrate `_video-editor.tsx` from ref to context**

In `src/app/(dashboard)/coach/videos/[id]/_video-editor.tsx`:

1. Remove the import of `VideoAnalysisWorkspaceHandle` (line 24)
2. Remove `const workspaceRef = useRef<VideoAnalysisWorkspaceHandle>(null);` (line 51)
3. Remove `ref={workspaceRef}` from the `<VideoAnalysisWorkspace>` JSX (line 415)
4. Wrap the component's content in `<VideoWorkspaceProvider>` and use `useVideoWorkspace()` to get `seekTo`
5. Replace `workspaceRef.current?.seekTo(time)` (line 235) with `seekTo(time)` from the hook

The `VideoEditor` component should import:
```tsx
import { VideoWorkspaceProvider } from "@/components/video/VideoWorkspaceProvider";
import { useVideoWorkspace } from "@/components/video/useVideoWorkspace";
```

Since hooks can't be called conditionally, extract the seek-dependent logic into a child component that lives inside the provider, or restructure so the provider wraps the editor content.

- [ ] **Step 3: Verify build + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors

- [ ] **Step 4: Verify video editor page renders**

Navigate to `/coach/videos/[any-id]` and verify:
- Video loads and plays
- Annotation tools work
- Timeline seeking works (the migrated `seekTo`)
- Split/ghost mode works

- [ ] **Step 5: Commit**

```bash
git add src/components/video/ "src/app/(dashboard)/coach/videos/[id]/_video-editor.tsx"
git commit -m "refactor: compose VideoAnalysisWorkspace shell, migrate video-editor to context"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Full lint**

Run: `npm run lint`
Expected: 0 errors (warnings OK)

- [ ] **Step 3: Verify all import paths work**

Run: `grep -r "from.*tools-page\|from.*DataTable\|from.*VideoAnalysisWorkspace\|from.*exercise-library-page" src/ --include="*.tsx" --include="*.ts" | head -20`

Verify:
- `tools-page` imports resolve via re-export
- `DataTable` imports work as before
- `VideoAnalysisWorkspace` imports work as before
- `exercise-library-page` has 0 imports (deleted)

- [ ] **Step 4: Verify line count improvement**

Run: `find src/components -name "*.tsx" -exec wc -l {} + | sort -rn | head -10`

Expected: No file over ~800 lines. The old `tools-page.tsx` (4,408 lines) should now be a 1-line re-export. `VideoAnalysisWorkspace.tsx` should be ~60 lines.
