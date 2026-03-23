# Regenerate Program + Settings Tab — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Author:** Claude + Anthony

---

## Overview

Add a "Settings" tab to the self-program detail page where athletes can edit program configuration and regenerate their Bondarchuk program without going through the full 10-step wizard again.

**Goals:**
- One-click regeneration with current settings
- Edit schedule, implements, competitions, goal, and program type inline
- Preserve completed session history when regenerating
- Read-only display for fields that require a new program (event, gender, experience)

**Non-goals:**
- Partial regeneration (e.g., regenerate only strength prescriptions)
- Version history / diff between program generations
- Undo regeneration

---

## Settings Tab

Added as a new tab in `_program-detail.tsx` alongside existing tabs (Schedule, Phases, etc.).

### Editable Fields

| Field | Input Type | Source |
|---|---|---|
| Days per week | Number stepper (2-5) | `SelfProgramConfig.daysPerWeek` |
| Sessions per day | Toggle (1 or 2) | `SelfProgramConfig.sessionsPerDay` |
| Preferred days | Multi-select checkboxes (Mon-Sun) | `SelfProgramConfig.preferredDays` JSON |
| Available implements | Multi-select list with weight + type | `SelfProgramConfig.availableImplements` JSON |
| Competition dates | Editable list: date + name + priority (A/B/C) | `SelfProgramConfig.competitionDates` JSON |
| Primary goal | Radio: Distance / Technique / Consistency | `SelfProgramConfig.primaryGoal` |
| Program type | Toggle: Throws Only / Throws + Lifting | `SelfProgramConfig.programType` |

### Read-Only Summary (top of Settings tab)

Displayed but not editable, with a muted note: "To change these, create a new program."

- Event (Shot Put, Discus, Hammer, Javelin)
- Gender
- Competition level
- Current PR

### Regenerate Button

- Full-width amber/gold button at the bottom of the Settings tab
- Label: "Regenerate Program"
- Confirmation via `ConfirmDialog`: "This will replace your current program. Sessions you've already completed will be preserved in your history. Regenerate?"
- On confirm: saves any pending settings changes, then calls the generate endpoint
- Shows loading state during regeneration
- On success: `router.refresh()` to reload with new program

---

## API Changes

### Modify existing: `PUT /api/athlete/self-program/[id]`

A `PUT` handler already exists in `src/app/api/athlete/self-program/[id]/route.ts`. Modify it to:
1. **Restrict editable fields** to only: `daysPerWeek`, `sessionsPerDay`, `preferredDays`, `availableImplements`, `competitionDates`, `primaryGoal`, `programType`
2. **Reject changes** to locked fields: `event`, `gender`, `competitionLevel`, `yearsExperience`, `currentPR` — return 400 if any of these are in the request body
3. Keep the existing authentication and ownership checks

**Request body** (all fields optional — only send what changed):
```json
{
  "daysPerWeek": 4,
  "sessionsPerDay": 1,
  "preferredDays": ["MONDAY", "WEDNESDAY", "FRIDAY", "SATURDAY"],
  "availableImplements": [{"weightKg": 7.26, "type": "COMPETITION"}],
  "competitionDates": [{"date": "2026-05-15", "name": "Conference", "priority": "A_MEET"}],
  "primaryGoal": "DISTANCE",
  "programType": "THROWS_AND_LIFTING"
}
```

**Validation:**
- Authenticated athlete must own the config
- `daysPerWeek` must be 2-5
- `sessionsPerDay` must be 1 or 2
- `preferredDays` must be valid day names, length must equal `daysPerWeek`
- `availableImplements` must include at least one implement
- `competitionDates` entries must have valid date, name, and priority
- Reject any locked fields with 400 error

**Response:** `200 OK` with updated config

### Modify existing: `POST /api/athlete/self-program/[id]/generate`

Needs two changes:
1. **Increment `generationCount`** instead of hardcoding to 1 — use `{ increment: 1 }` in the Prisma update
2. **Reset `currentPhaseIndex` to 0** on regeneration — new program starts at phase 0

---

## Regeneration Flow

1. Athlete edits settings on the Settings tab (local state only — no auto-save)
2. Athlete clicks "Regenerate Program"
3. Confirmation dialog shown (desktop: `ConfirmDialog`, mobile: `SlideToConfirm` with variant "confirm")
4. On confirm:
   a. PUT settings to save changes to `SelfProgramConfig`
   b. POST to generate endpoint to create new program
   c. Old `TrainingProgram` is NOT deleted — completed sessions remain in history
   d. New `TrainingProgram` created with updated config
   e. `SelfProgramConfig.trainingProgramId` updated to new program
   f. `generationCount` incremented (not hardcoded to 1)
   g. `currentPhaseIndex` reset to 0
6. Page refreshes with new program data

---

## Structural Change to Program Detail Page

The existing `_program-detail.tsx` does NOT have top-level page tabs — it uses `Tabs` only for the phase timeline (Accumulation/Transmutation/etc.). To add a Settings tab, wrap the entire page content in a new top-level `Tabs` component:

```
<Tabs defaultValue="program" variant="underline">
  <TabList>
    <TabTrigger value="program">Program</TabTrigger>
    <TabTrigger value="settings">Settings</TabTrigger>
  </TabList>
  <TabPanel value="program">
    {/* Existing program detail content (stats, phase tabs, session list) */}
  </TabPanel>
  <TabPanel value="settings">
    <ProgramSettings config={config} />
  </TabPanel>
</Tabs>
```

The existing content moves into the "Program" tab panel unchanged. Settings is the new tab.

## Data Query Changes

The server page (`[id]/page.tsx`) and the `SelfProgramConfig` TypeScript interface in `_program-detail.tsx` need to include the additional fields for the Settings tab. Add to the Prisma select and interface:
- `competitionLevel`, `primaryGoal`, `preferredDays`, `availableImplements`, `competitionDates`, `programType`, `daysPerWeek`, `sessionsPerDay`, `generationCount`

---

## File Structure

```
NEW FILES:
  src/app/(dashboard)/athlete/self-program/[id]/_program-settings.tsx  — Settings tab component

MODIFIED FILES:
  src/app/api/athlete/self-program/[id]/route.ts                      — Restrict PUT to editable fields only
  src/app/api/athlete/self-program/[id]/generate/route.ts             — Increment generationCount, reset currentPhaseIndex
  src/app/(dashboard)/athlete/self-program/[id]/_program-detail.tsx    — Add top-level tabs (Program | Settings), expand SelfProgramConfig interface
  src/app/(dashboard)/athlete/self-program/[id]/page.tsx              — Expand Prisma select to include settings fields
```

---

## UI Design

- Settings tab uses existing form patterns: card sections, input fields, toggles
- Implement selector reuses the pattern from `step-implements.tsx` (multi-select with weight badges)
- Competition dates: simple list with add/remove, each row has date picker + name input + A/B/C dropdown
- Section headers: `text-sm font-semibold text-muted uppercase tracking-wider`
- Read-only fields: `text-muted` with lock icon
- Regenerate button: `btn-primary w-full` with amber/gold styling, `SlideToConfirm` on mobile
- Loading state during regeneration: button shows spinner + "Regenerating..."
