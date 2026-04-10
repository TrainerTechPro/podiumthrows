# Regenerate Program + Settings Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings tab to the self-program detail page where athletes can edit program config and regenerate without the full wizard.

**Architecture:** Modify existing PUT endpoint to restrict editable fields, fix generate endpoint to increment `generationCount`, create a Settings tab client component, wrap existing program detail in top-level tabs.

**Tech Stack:** Next.js 14.2, React 18.3, TypeScript, Prisma, Tailwind CSS, existing component library (Tabs, Button, NumberFlow, SlideToConfirm, ConfirmDialog).

**Spec:** `docs/superpowers/specs/2026-03-23-regenerate-program-settings-design.md`

---

## File Structure

```
MODIFIED FILES:
  src/app/api/athlete/self-program/[id]/route.ts              — restrict PUT to editable fields only
  src/app/api/athlete/self-program/[id]/generate/route.ts     — increment generationCount, reset currentPhaseIndex
  src/app/(dashboard)/athlete/self-program/[id]/page.tsx       — expand Prisma select for settings fields
  src/app/(dashboard)/athlete/self-program/[id]/_program-detail.tsx — add top-level tabs, expand config interface

NEW FILES:
  src/app/(dashboard)/athlete/self-program/[id]/_program-settings.tsx — Settings tab component
```

---

### Task 1: Restrict PUT Endpoint to Editable Fields

**Files:**
- Modify: `src/app/api/athlete/self-program/[id]/route.ts`

- [ ] **Step 1: Read the existing PUT handler**

Read the full file to understand the current `ALLOWED_FIELDS` list and update logic.

- [ ] **Step 2: Add locked fields rejection**

Before the existing update logic, add a check that rejects locked fields:

```typescript
const LOCKED_FIELDS = ["event", "gender", "competitionLevel", "yearsExperience", "currentPR"];
const lockedAttempt = LOCKED_FIELDS.filter((f) => f in body);
if (lockedAttempt.length > 0) {
  return NextResponse.json(
    { error: `Cannot modify locked fields: ${lockedAttempt.join(", ")}. Create a new program instead.` },
    { status: 400 },
  );
}
```

Ensure `ALLOWED_FIELDS` includes: `daysPerWeek`, `sessionsPerDay`, `preferredDays`, `availableImplements`, `competitionDates`, `primaryGoal`, `programType`. Remove any locked fields from `ALLOWED_FIELDS` if present.

- [ ] **Step 3: Verify with tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/athlete/self-program/\[id\]/route.ts
git commit -m "feat: restrict PUT endpoint to editable fields, reject locked fields"
```

---

### Task 2: Fix Generate Endpoint — Increment generationCount

**Files:**
- Modify: `src/app/api/athlete/self-program/[id]/generate/route.ts`

- [ ] **Step 1: Read the generate route**

Find the line where `generationCount: 1` is hardcoded (around line 346 in the `selfProgramConfig.update` call).

- [ ] **Step 2: Change generationCount from hardcoded 1 to increment**

Replace:
```typescript
generationCount: 1,
```

With:
```typescript
generationCount: { increment: 1 },
currentPhaseIndex: 0,
```

This increments the count on each regeneration and resets the phase index to start at the beginning of the new program.

- [ ] **Step 3: Verify with tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/athlete/self-program/\[id\]/generate/route.ts
git commit -m "fix: increment generationCount on regeneration, reset currentPhaseIndex"
```

---

### Task 3: Expand Server Page Query + Config Interface

**Files:**
- Modify: `src/app/(dashboard)/athlete/self-program/[id]/page.tsx`
- Modify: `src/app/(dashboard)/athlete/self-program/[id]/_program-detail.tsx`

- [ ] **Step 1: Expand the Prisma select in page.tsx**

Read the current page.tsx. The `selfProgramConfig.findUnique` call currently does `include: { trainingProgram: ... }` without selecting config-level fields. The `JSON.parse(JSON.stringify(config))` passes everything, but the TypeScript interface in `_program-detail.tsx` doesn't include all fields.

Add explicit select for settings-relevant fields. Since the current query uses `include` (which returns all scalar fields by default), the data is actually ALREADY returned — the issue is only the TypeScript interface.

- [ ] **Step 2: Expand SelfProgramConfig interface in _program-detail.tsx**

Read the current interface (around lines 83-98). Add the missing fields:

```typescript
interface SelfProgramConfig {
  id: string;
  event: string;
  gender: string;
  programType: string;
  daysPerWeek: number;
  sessionsPerDay: number;
  currentPR: number;
  goalDistance: number;
  generationMode: string;
  generationCount: number;
  currentPhaseIndex: number;
  isActive: boolean;
  startDate: string;
  createdAt: string;
  // Settings fields (new)
  competitionLevel: string;
  yearsExperience: number;
  primaryGoal: string;
  preferredDays: string[];
  availableImplements: Array<{ weightKg: number; type?: string }>;
  competitionDates: Array<{ date: string; name: string; priority: string }> | null;
}
```

- [ ] **Step 3: Verify with tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/athlete/self-program/\[id\]/page.tsx src/app/\(dashboard\)/athlete/self-program/\[id\]/_program-detail.tsx
git commit -m "feat: expand SelfProgramConfig interface for settings tab"
```

---

### Task 4: Create ProgramSettings Component

**Files:**
- Create: `src/app/(dashboard)/athlete/self-program/[id]/_program-settings.tsx`

- [ ] **Step 1: Create the Settings tab component**

Client component (`"use client"`) that receives the `SelfProgramConfig` and renders editable fields + regenerate button.

**Key requirements:**

Props:
```typescript
interface ProgramSettingsProps {
  config: SelfProgramConfig; // from the expanded interface
}
```

State: local form state initialized from `config`. Changes are local until "Regenerate" is pressed.

**Sections (top to bottom):**

1. **Read-only summary** — event, gender, competition level, current PR. Card with `text-muted`, Lock icon from lucide-react. Note: "To change these, create a new program."

2. **Schedule** — `daysPerWeek` (number input 2-5), `sessionsPerDay` (toggle 1/2), `preferredDays` (day checkboxes Mon-Sun). Follow pattern from `step-schedule.tsx`.

3. **Implements** — multi-select list of implements. Each shows weight + owned badge. Toggle on/off. Follow pattern from `step-implements.tsx` but simplified (no equipment inventory lookup — just render current `availableImplements` as toggleable).

4. **Competition dates** — list with add/remove. Each row: date input, name input, A/B/C priority select. "Add competition" button.

5. **Primary goal** — 3 radio buttons: Distance, Technique, Consistency.

6. **Program type** — toggle: Throws Only / Throws + Lifting.

7. **Regenerate button** — full-width `btn-primary`. On mobile: `<SlideToConfirm>` (from `src/components/ui/SlideToConfirm.tsx`). On desktop: button with `ConfirmDialog`.
   - Confirm text: "This will replace your current program. Completed sessions are preserved."
   - On confirm: `PUT /api/athlete/self-program/${config.id}` with form state, then `POST /api/athlete/self-program/${config.id}/generate`, then `router.refresh()`
   - Loading state: button shows "Regenerating..." with spinner
   - Error state: show error message below button
   - Success: toast "Program regenerated!" via `useToast()`

**Design system rules:**
- Section headers: `text-sm font-semibold text-muted uppercase tracking-wider`
- Card: `card` class for each section
- Icons: Lucide React, strokeWidth={1.75}, aria-hidden="true"
- Use `cn()` from `@/lib/utils`
- Use `NumberFlow` for the days/sessions number displays

- [ ] **Step 2: Verify with tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/athlete/self-program/\[id\]/_program-settings.tsx
git commit -m "feat: add ProgramSettings component with editable config and regenerate"
```

---

### Task 5: Add Top-Level Tabs to Program Detail

**Files:**
- Modify: `src/app/(dashboard)/athlete/self-program/[id]/_program-detail.tsx`

- [ ] **Step 1: Read the current component structure**

Read the full `_program-detail.tsx`. Find where the main content starts (after the back button and stat cards). The existing phase-level `<Tabs>` is nested inside the content.

- [ ] **Step 2: Wrap content in top-level tabs**

Import `ProgramSettings` from `./_program-settings`.

Add a new top-level `<Tabs>` wrapping the main content area (BELOW the back button and stat cards — those stay outside tabs):

```tsx
import { ProgramSettings } from "./_program-settings";

// Inside the component, after stat cards:
<Tabs defaultValue="program" variant="underline">
  <TabList>
    <TabTrigger value="program" variant="underline">Program</TabTrigger>
    <TabTrigger value="settings" variant="underline">Settings</TabTrigger>
  </TabList>
  <TabPanel value="program">
    {/* Move ALL existing phase tabs + session content here */}
  </TabPanel>
  <TabPanel value="settings">
    <ProgramSettings config={config} />
  </TabPanel>
</Tabs>
```

The existing phase-level tabs (Accumulation/Transmutation/etc.) become nested inside the "Program" tab panel.

- [ ] **Step 3: Verify with tsc**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Visual check**

```bash
npm run dev
```

Navigate to `/athlete/self-program/[id]`. Verify:
- "Program" tab shows existing content unchanged
- "Settings" tab shows editable fields pre-filled from config
- Read-only fields are visible but not editable
- Regenerate button works (save + generate + refresh)
- Completed sessions preserved after regeneration

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/athlete/self-program/\[id\]/_program-detail.tsx
git commit -m "feat: add top-level Program/Settings tabs with regenerate support"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete regenerate program + settings tab"
```
