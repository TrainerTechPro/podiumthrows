# NumberInput primitive — design spec

**Date:** 2026-05-04
**Status:** Draft (awaiting user approval)
**Origin:** Form-input audit against ux-components.com catalog. Catalog has 18 form primitives; library has 4 (`Input`, `PasswordInput`, `Select`, `RPESlider`). Audit found ~220 raw `<input>`/`<textarea>` usages bypassing the library. Highest-leverage gap is **Number Input** — 53 raw `type="number"` usages and a documented bug class (CLAUDE.md §3, §4).

## Problem

Numeric form fields across the app re-implement the same value/string dance, and most fall into one or more of the following:

1. **Empty silently coerces to zero (or vice versa).**
   `value || null` rejects `0` (a valid bodyweight, RPE, unweighted implement). Documented in CLAUDE.md §3.

2. **Display loses zero.**
   `value={x ? x.toString() : ""}` renders `""` when `x === 0`, hiding the real value behind a placeholder. Live in `coach/plans/new/_step-blocks.tsx:217`.

3. **Mobile keyboard wrong.**
   Raw `type="number"` without `inputMode` gives the wrong keyboard on iOS for decimals (kg, meters). `<Input>` has the auto-`inputMode` logic; raw inputs don't.

4. **Server validation `.optional()` rejects null.**
   React form state uses `null` for unset, but Zod `.optional()` only accepts `undefined`. CLAUDE.md §4.

5. **No min/max enforcement at the input level.**
   Bad input reaches Prisma, returns opaque 400.

6. **No step buttons on touch targets that need them.**
   Sets, reps, rest seconds — small integer adjustments where +/- buttons beat keyboard entry on mobile.

53 call sites currently exhibit some subset of these.

## Solution

A single `<NumberInput>` primitive that owns the number↔string boundary, so every call site becomes:

```tsx
<NumberInput
  label="Bodyweight"
  unit="kg"
  value={bodyweightKg} // number | null — never strings
  onChange={setBodyweightKg} // (next: number | null) => void
  min={0}
  step={0.1}
/>
```

Caller never parses, never formats, never thinks about empty vs zero.

### API

```ts
export interface NumberInputProps {
  // Value
  value: number | null;
  onChange: (next: number | null) => void;

  // Constraints
  min?: number;
  max?: number;
  step?: number; // default 1; if non-integer, inputMode="decimal"
  precision?: number; // decimal places to render; defaults to step's precision

  // Layout (mirrors <Input>)
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  unit?: string; // right addon: "kg", "m", "%", "sec"
  leftIcon?: ReactNode;

  // Behavior
  showSteppers?: boolean; // default false; +/- buttons on either side
  allowNegative?: boolean; // default false (most fields are >= 0)
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  className?: string;
}
```

### Behavior contract

**Value handling:**

- `value === null` → input renders empty.
- `value === 0` → input renders `"0"` (or `"0.0"` if `precision >= 1`).
- User types non-numeric → onChange not fired; current value unchanged. (We do _not_ call onChange with `NaN`.)
- User clears the input → `onChange(null)`.
- User types a parseable number → `onChange(parsed)`.
- User types out-of-range value → onChange fired with the value (the input does not block typing). Range violation is the caller's responsibility to surface via the `error` prop on next render. (Blocking typing breaks paste, breaks delete-and-retype.)

**Min/max:**

- Internal validation only flags errors via the error state — does NOT block typing. (Blocking typing breaks paste, breaks deletion-and-retype, breaks expectations. The catalog's "min reached / max reached" states refer to the steppers, not the input.)
- Steppers (if shown) clamp at min/max and disable when reached.

**Step buttons (when `showSteppers`):**

- `−` and `+` buttons on either side, decrement/increment by `step` (default 1).
- Disable `−` at min, `+` at max.
- ArrowUp / ArrowDown on the input itself also step.
- Long-press accelerates (200ms initial, then 50ms intervals).

**Mobile keyboard:**

- `step` integer or omitted → `inputMode="numeric"`.
- `step` non-integer → `inputMode="decimal"`.
- `allowNegative=false` → also sets `pattern` to allow numeric+decimal only.

**Accessibility:**

- `aria-invalid` from error.
- `aria-describedby` wired to error/helper.
- Steppers `aria-label` (`"Decrease bodyweight"`, etc.).
- `role="spinbutton"` semantics with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`.

### Visual states (catalog-aligned)

| State           | Treatment                                                            |
| --------------- | -------------------------------------------------------------------- |
| Default         | `input` class, neutral border                                        |
| Focused         | Existing `focus-visible:ring`                                        |
| Disabled        | Reuse `<Input>` disabled styling                                     |
| Error           | Red border + red caption + `<AlertCircle>` icon                      |
| Min/max reached | Stepper button visually disabled (40% opacity, `cursor-not-allowed`) |
| With unit       | Right addon (matches `<Input>` `rightAddon` style)                   |
| With steppers   | `−` left, input center, `+` right; all in one bordered group         |

### Composition / what it reuses

Reuses the existing `input` CSS utility class for visual consistency. Reuses the `label` / error caption pattern from `<Input>`. **Does not** reuse `<Input>` itself — wrapping `<Input>` with number-specific behavior was considered, but `<Input>` operates on `value: string` and the entire point of `<NumberInput>` is to escape strings. Forking is correct here.

### Where it lives

`src/components/ui/NumberInput.tsx` — alongside the rest of the UI primitives.

### What this design does NOT include

- **Currency formatting.** Out of scope; throws SaaS doesn't surface money in the app.
- **Locale-aware decimal separators.** All current data is metric; English locale assumed. Defer until first non-English customer.
- **Full migration of all 53 raw call sites.** This spec ships the primitive + migrates 3 highest-leverage sites (see "Migration scope" below).
- **Replacement for `<RPESlider>`.** RPE is a slider, not a number input. Different primitive, different ergonomics.

## Migration scope (this PR)

Migrate these three call sites only — they're the highest-traffic and most painful:

1. `src/app/(fullscreen)/athlete/quick-log/_quick-log-client.tsx` — athlete logs throw distances; high-frequency, mobile-primary.
2. `src/app/(dashboard)/coach/plans/new/_step-blocks.tsx` — has the documented `restSeconds` zero bug.
3. `src/app/(dashboard)/coach/athletes/[id]/profile/edit/_form.tsx` — bodyweight/height fields where 0 is a real value.

Remaining 50 sites stay raw until opportunistically touched. Tracking ticket follows.

## Verification

- **Typecheck:** `tsc --noEmit` clean.
- **Lint:** `npm run lint` clean.
- **Component test (Vitest):** new `NumberInput.test.tsx` covering:
  - empty render when `value=null`
  - renders `"0"` when `value=0`
  - clear input → `onChange(null)`
  - typing `"3.14"` → `onChange(3.14)`
  - paste `"abc"` → no onChange call
  - stepper +/-, min/max clamp
  - `inputMode` selection by step
- **Manual smoke:** the three migrated screens, both themes, mobile + desktop.

## Risk / what could go wrong

- **Migration regressions:** the three migrated forms each have their own validation/save flows; behavior must be byte-identical from the user's perspective. Mitigate by testing the existing happy paths before declaring done.
- **API churn risk on remaining 50 sites:** if I add a prop later to support a use case in the unmigrated 50, callers won't break (the API is additive). But choices made now (e.g. `value: number | null` vs string) are hard to change later. The `number | null` choice is rooted in CLAUDE.md §3+§4 and is the recommended type for any new primitive — this risk is accepted.
- **Stepper UX:** long-press acceleration is easy to get wrong on touch (interferes with scroll). Default `showSteppers=false` keeps this path opt-in.

## Out of scope (future PRs)

- Migration of remaining 50 raw `type="number"` sites — opportunistic.
- New primitives for the other catalog gaps:
  - `<Checkbox>` (15 raw sites)
  - `<Radio>` / `<RadioGroup>` (3 raw sites)
  - `<Textarea>` (52 raw sites)
  - `<DatePicker>` (31 raw sites — but the catalog notes `<input type="date">` is fine for many cases; needs its own audit)
  - `<FileUpload>` (15 raw sites)
- Removal of redundant `<PasswordInput>` (since `<Input type="password">` handles this).
- Arrow-key option navigation in `<Select>`.
