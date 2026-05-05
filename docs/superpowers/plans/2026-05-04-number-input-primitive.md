# NumberInput primitive — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `<NumberInput>` primitive that owns the number↔string boundary and eliminates the documented zero-vs-empty bug class app-wide. Migrate three highest-leverage call sites.

**Architecture:** New client-side React component at `src/components/ui/NumberInput.tsx`. `value: number | null` API (matches CLAUDE.md §3, §4). Reuses existing `input` CSS utility class and `parseNumericInput`/`parseIntegerInput` helpers from `src/lib/forms/parse-numeric.ts`. No new deps. Migrations are mechanical state-shape changes from `string` → `number | null`.

**Tech Stack:** Next.js 14.2 App Router, React 18.3, TypeScript, Tailwind 3.4, lucide-react icons, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-04-number-input-primitive-design.md`

**Branch:** `feat/number-input-primitive` (per `feedback_use_feat_branch_workflow.md` — never push to main directly).

**Push policy:** Do NOT push after each commit. Accumulate. Push only when user says "push" or "deploy" (per `feedback_batch_pushes.md`).

---

## File structure

| Path                                                             | Action | Responsibility                                     |
| ---------------------------------------------------------------- | ------ | -------------------------------------------------- |
| `src/components/ui/NumberInput.tsx`                              | Create | The primitive                                      |
| `src/components/ui/__tests__/NumberInput.test.tsx`               | Create | Component tests                                    |
| `src/app/(fullscreen)/athlete/quick-log/_quick-log-client.tsx`   | Modify | Migrate distance input                             |
| `src/app/(dashboard)/coach/plans/new/_step-blocks.tsx`           | Modify | Migrate restSeconds (fixes zero bug)               |
| `src/app/(dashboard)/coach/athletes/[id]/profile/edit/_form.tsx` | Modify | Migrate height/weight/gradYear/PRs/strength fields |

---

## Task 0: Create branch

- [ ] **Step 1: Cut a feature branch from main**

```bash
cd "/Users/anthonysommers/claude-code-projects/Podium Throws"
git fetch origin
git status                              # confirm clean working tree (note: 2 unrelated modified files at session start; either stash or commit separately first)
git checkout -b feat/number-input-primitive origin/main
```

Note: at session start the working tree had `M .claude/settings.local.json`, `M src/app/(dashboard)/athlete/dashboard/_athlete-home-client.tsx`, `M src/app/(dashboard)/athlete/dashboard/_volume-widget.tsx`. Confirm with the user whether to stash, commit separately, or include — they are NOT part of this work.

---

## Task 1: Write NumberInput tests (TDD — failing first)

**Files:**

- Create: `src/components/ui/__tests__/NumberInput.test.tsx`

- [ ] **Step 1: Write the failing test file**

```tsx
// src/components/ui/__tests__/NumberInput.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NumberInput } from "../NumberInput";

describe("NumberInput", () => {
  it("renders empty when value is null", () => {
    render(<NumberInput value={null} onChange={() => {}} label="Weight" />);
    expect(screen.getByLabelText("Weight")).toHaveValue(null);
  });

  it("renders 0 when value is 0 (the bug this exists to fix)", () => {
    render(<NumberInput value={0} onChange={() => {}} label="Weight" />);
    expect(screen.getByLabelText("Weight")).toHaveValue(0);
  });

  it("renders the number when value is non-zero", () => {
    render(<NumberInput value={3.14} onChange={() => {}} label="Weight" />);
    expect(screen.getByLabelText("Weight")).toHaveValue(3.14);
  });

  it("fires onChange(null) when user clears the input", () => {
    const onChange = vi.fn();
    render(<NumberInput value={5} onChange={onChange} label="Weight" />);
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("fires onChange(0) when user types 0 (must distinguish from empty)", () => {
    const onChange = vi.fn();
    render(<NumberInput value={null} onChange={onChange} label="Weight" />);
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "0" } });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("fires onChange(3.14) on parseable decimal", () => {
    const onChange = vi.fn();
    render(<NumberInput value={null} onChange={onChange} label="Weight" step={0.01} />);
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "3.14" } });
    expect(onChange).toHaveBeenCalledWith(3.14);
  });

  it("does not fire onChange on unparseable input (e.g. 'abc')", () => {
    // <input type="number"> in jsdom rejects non-numeric strings — confirm by setting then reading
    const onChange = vi.fn();
    render(<NumberInput value={5} onChange={onChange} label="Weight" />);
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "abc" } });
    // Either onChange isn't called, OR it's called with null (jsdom may emit "")
    if (onChange.mock.calls.length > 0) {
      expect(onChange).toHaveBeenCalledWith(null);
    }
  });

  it("uses inputMode='decimal' when step has decimals", () => {
    render(<NumberInput value={null} onChange={() => {}} label="Weight" step={0.1} />);
    expect(screen.getByLabelText("Weight")).toHaveAttribute("inputMode", "decimal");
  });

  it("uses inputMode='numeric' when step is integer", () => {
    render(<NumberInput value={null} onChange={() => {}} label="Reps" step={1} />);
    expect(screen.getByLabelText("Reps")).toHaveAttribute("inputMode", "numeric");
  });

  it("renders unit suffix when unit prop given", () => {
    render(<NumberInput value={5} onChange={() => {}} label="Weight" unit="kg" />);
    expect(screen.getByText("kg")).toBeInTheDocument();
  });

  it("renders error message and aria-invalid when error prop set", () => {
    render(<NumberInput value={5} onChange={() => {}} label="Weight" error="Too high" />);
    expect(screen.getByText("Too high")).toBeInTheDocument();
    expect(screen.getByLabelText("Weight")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders helper text when no error", () => {
    render(<NumberInput value={5} onChange={() => {}} label="Weight" helper="Enter in kg" />);
    expect(screen.getByText("Enter in kg")).toBeInTheDocument();
  });

  describe("steppers (when showSteppers=true)", () => {
    it("renders + and − buttons", () => {
      render(<NumberInput value={5} onChange={() => {}} label="Reps" showSteppers />);
      expect(screen.getByLabelText("Decrease Reps")).toBeInTheDocument();
      expect(screen.getByLabelText("Increase Reps")).toBeInTheDocument();
    });

    it("increments by step when + clicked", () => {
      const onChange = vi.fn();
      render(<NumberInput value={5} onChange={onChange} label="Reps" showSteppers step={1} />);
      fireEvent.click(screen.getByLabelText("Increase Reps"));
      expect(onChange).toHaveBeenCalledWith(6);
    });

    it("decrements by step when − clicked", () => {
      const onChange = vi.fn();
      render(<NumberInput value={5} onChange={onChange} label="Reps" showSteppers step={1} />);
      fireEvent.click(screen.getByLabelText("Decrease Reps"));
      expect(onChange).toHaveBeenCalledWith(4);
    });

    it("clamps at min when decrementing", () => {
      const onChange = vi.fn();
      render(<NumberInput value={1} onChange={onChange} label="Reps" showSteppers min={1} />);
      fireEvent.click(screen.getByLabelText("Decrease Reps"));
      expect(onChange).not.toHaveBeenCalled();
    });

    it("clamps at max when incrementing", () => {
      const onChange = vi.fn();
      render(<NumberInput value={10} onChange={onChange} label="Reps" showSteppers max={10} />);
      fireEvent.click(screen.getByLabelText("Increase Reps"));
      expect(onChange).not.toHaveBeenCalled();
    });

    it("treats null as 0 baseline when incrementing from empty", () => {
      const onChange = vi.fn();
      render(<NumberInput value={null} onChange={onChange} label="Reps" showSteppers step={1} />);
      fireEvent.click(screen.getByLabelText("Increase Reps"));
      expect(onChange).toHaveBeenCalledWith(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (component doesn't exist yet)**

```bash
npm test -- NumberInput
```

Expected: all tests fail with "Cannot find module '../NumberInput'" or equivalent.

- [ ] **Step 3: Commit failing tests**

```bash
git add src/components/ui/__tests__/NumberInput.test.tsx
git commit -m "test(ui): add NumberInput component tests (failing — component not yet implemented)"
```

---

## Task 2: Implement NumberInput component

**Files:**

- Create: `src/components/ui/NumberInput.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/ui/NumberInput.tsx
"use client";

import {
  forwardRef,
  ReactNode,
  useCallback,
  useId,
  useMemo,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { AlertCircle, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseNumericInput, parseIntegerInput } from "@/lib/forms/parse-numeric";

type HtmlInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "min" | "max" | "step" | "size"
>;

export interface NumberInputProps extends HtmlInputProps {
  value: number | null;
  onChange: (next: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  unit?: string;
  leftIcon?: ReactNode;
  showSteppers?: boolean;
  allowNegative?: boolean;
  className?: string;
  id?: string;
}

function isIntegerStep(step: number | undefined): boolean {
  if (step == null) return true;
  return Number.isInteger(step);
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    value,
    onChange,
    min,
    max,
    step,
    label,
    helper,
    error,
    required,
    unit,
    leftIcon,
    showSteppers = false,
    allowNegative = false,
    placeholder,
    disabled,
    id: externalId,
    className,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const isInt = isIntegerStep(step);
  const parser = isInt ? parseIntegerInput : parseNumericInput;
  const stepValue = step ?? 1;

  const inputMode = isInt ? "numeric" : "decimal";

  // Render value as string. value=0 renders "0" (the bug this fixes).
  const displayValue = value == null ? "" : String(value);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "") {
        onChange(null);
        return;
      }
      const parsed = parser(raw);
      if (parsed == null) {
        onChange(null);
        return;
      }
      if (!allowNegative && parsed < 0) return;
      onChange(parsed);
    },
    [onChange, parser, allowNegative]
  );

  const clamp = useCallback(
    (n: number): number => {
      let next = n;
      if (min != null && next < min) next = min;
      if (max != null && next > max) next = max;
      return next;
    },
    [min, max]
  );

  const canDecrement = useMemo(() => {
    const baseline = value ?? 0;
    const next = baseline - stepValue;
    if (min != null && baseline <= min) return false;
    if (!allowNegative && next < 0 && (min == null || min >= 0)) {
      return baseline > 0;
    }
    return true;
  }, [value, stepValue, min, allowNegative]);

  const canIncrement = useMemo(() => {
    const baseline = value ?? 0;
    if (max != null && baseline >= max) return false;
    return true;
  }, [value, max]);

  const handleStep = useCallback(
    (direction: 1 | -1) => {
      const baseline = value ?? 0;
      const next = clamp(baseline + direction * stepValue);
      if (next === baseline) return;
      if (!allowNegative && next < 0) return;
      onChange(next);
    },
    [value, stepValue, clamp, onChange, allowNegative]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (canIncrement) handleStep(1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (canDecrement) handleStep(-1);
      }
    },
    [handleStep, canIncrement, canDecrement]
  );

  const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && (
            <span className="ml-1 text-danger-500 dark:text-danger-400" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className="relative flex items-stretch">
        {showSteppers && (
          <button
            type="button"
            onClick={() => handleStep(-1)}
            disabled={disabled || !canDecrement}
            aria-label={`Decrease ${label ?? "value"}`}
            className={cn(
              "flex items-center justify-center px-3 rounded-l-xl border border-r-0 border-[var(--card-border)]",
              "bg-[var(--muted-bg)] text-[var(--muted)] shrink-0",
              "hover:bg-surface-100 dark:hover:bg-surface-800/50 transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--muted-bg)]"
            )}
          >
            <Minus size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        )}

        {leftIcon && !showSteppers && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500">
            {leftIcon}
          </div>
        )}

        <input
          {...rest}
          ref={ref}
          id={id}
          type="number"
          inputMode={inputMode}
          disabled={disabled}
          placeholder={placeholder}
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value ?? undefined}
          min={min}
          max={max}
          step={step}
          className={cn(
            "input flex-1 min-w-0 text-center tabular-nums",
            showSteppers && "rounded-none border-x-0",
            !showSteppers && "text-left",
            !showSteppers && unit && "rounded-r-none",
            !showSteppers && leftIcon && "pl-10",
            error &&
              "border-danger-500 dark:border-danger-500 focus-visible:ring-danger-500/50 focus-visible:border-danger-500"
          )}
        />

        {showSteppers ? (
          <button
            type="button"
            onClick={() => handleStep(1)}
            disabled={disabled || !canIncrement}
            aria-label={`Increase ${label ?? "value"}`}
            className={cn(
              "flex items-center justify-center px-3 rounded-r-xl border border-l-0 border-[var(--card-border)]",
              "bg-[var(--muted-bg)] text-[var(--muted)] shrink-0",
              "hover:bg-surface-100 dark:hover:bg-surface-800/50 transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--muted-bg)]"
            )}
          >
            <Plus size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          unit && (
            <div className="flex items-center px-3 rounded-r-xl border border-l-0 border-[var(--card-border)] bg-[var(--muted-bg)] text-sm text-[var(--muted)] shrink-0">
              {unit}
            </div>
          )
        )}
      </div>

      {error && (
        <p
          id={`${id}-error`}
          className="text-xs text-danger-500 dark:text-danger-400 flex items-center gap-1.5"
        >
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </p>
      )}
      {!error && helper && (
        <p id={`${id}-helper`} className="text-xs text-muted">
          {helper}
        </p>
      )}
    </div>
  );
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm test -- NumberInput
```

Expected: all tests pass. If a test fails, fix the component (not the test) until green.

- [ ] **Step 3: Run typecheck and lint**

```bash
npx tsc --noEmit
npm run lint -- src/components/ui/NumberInput.tsx
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/NumberInput.tsx
git commit -m "feat(ui): add NumberInput primitive with number|null API

Eliminates the empty-vs-zero bug class documented in CLAUDE.md §3 by
owning the number↔string boundary at the component level. Callers pass
\`value: number | null\` and never deal with parsing.

- Auto inputMode (decimal for non-integer step, numeric otherwise)
- Optional unit suffix
- Optional +/- steppers with min/max clamping
- ArrowUp/ArrowDown step
- Full a11y: aria-invalid, aria-describedby, spinbutton semantics
- Reuses parseNumericInput/parseIntegerInput helpers"
```

---

## Task 3: Migrate athlete quick-log distance input

**Files:**

- Modify: `src/app/(fullscreen)/athlete/quick-log/_quick-log-client.tsx`

This is the highest-traffic mobile flow. One input. State currently `useState<string>` for `distance`.

- [ ] **Step 1: Read the file to find current state declaration and submit handler**

```bash
grep -n "distance" "src/app/(fullscreen)/athlete/quick-log/_quick-log-client.tsx" | head -20
```

Note exact line numbers for: `const [distance, setDistance] = useState`, the `<input type="number">` JSX block (~line 350-360), and any `parseFloat(distance)` / `parseNumericInput(distance)` at submit time.

- [ ] **Step 2: Change state shape from string to number | null**

Replace:

```tsx
const [distance, setDistance] = useState<string>("");
// or
const [distance, setDistance] = useState("");
```

With:

```tsx
const [distance, setDistance] = useState<number | null>(null);
```

- [ ] **Step 3: Replace the raw `<input>` with `<NumberInput>`**

Add the import at the top:

```tsx
import { NumberInput } from "@/components/ui/NumberInput";
```

Replace the JSX block (lines ~350-360):

```tsx
<input
  id="ql-distance"
  type="number"
  inputMode="decimal"
  step="0.01"
  min="0"
  max="100"
  value={distance}
  onChange={(e) => setDistance(e.target.value)}
  /* …other props… */
/>
```

With:

```tsx
<NumberInput
  id="ql-distance"
  value={distance}
  onChange={setDistance}
  step={0.01}
  min={0}
  max={100}
  unit="m"
  /* preserve label/placeholder/className from original */
/>
```

(If the original had a separate `<label>` element nearby, either remove it and pass `label="Distance"` to `<NumberInput>`, or keep the external label and pass `id` consistently. Match the existing visual layout — do not change the look.)

- [ ] **Step 4: Update submit/save to use `distance` directly (no parse)**

Anywhere downstream uses `parseFloat(distance)` or `parseNumericInput(distance)` — replace with `distance` directly. If submission requires a non-null value, add an explicit guard:

```tsx
if (distance == null) {
  toast.error("Enter a distance");
  return;
}
```

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If `distance` is used anywhere expecting a string, the compiler will catch it.

- [ ] **Step 6: Manual smoke test**

```bash
npm run dev
```

Open athlete quick-log on mobile viewport. Verify:

- Empty input renders empty (placeholder visible)
- Type "65.5" — number renders, submit works
- Type "0" — "0" renders (does NOT collapse to placeholder)
- Clear input — fires null, submit guarded
- Decimal keyboard appears on iOS (use Safari devtools "Responsive Design Mode")

- [ ] **Step 7: Commit**

```bash
git add "src/app/(fullscreen)/athlete/quick-log/_quick-log-client.tsx"
git commit -m "refactor(athlete-quick-log): migrate distance input to NumberInput primitive"
```

---

## Task 4: Migrate plan builder restSeconds (fixes documented zero bug)

**Files:**

- Modify: `src/app/(dashboard)/coach/plans/new/_step-blocks.tsx`

This is the file with the documented bug at line 203: `value={block.restSeconds ? block.restSeconds.toString() : ""}` — for `restSeconds=0`, this renders empty.

- [ ] **Step 1: Add the import**

At the top of the file, near other component imports:

```tsx
import { NumberInput } from "@/components/ui/NumberInput";
```

- [ ] **Step 2: Replace the `<Input type="number">` block (around lines 197-208)**

Find the block:

```tsx
<Input
  label="Rest After (sec)"
  type="number"
  placeholder="120"
  value={block.restSeconds ? block.restSeconds.toString() : ""}
  onChange={(e) => updateBlock(idx, { restSeconds: parseIntegerInput(e.target.value) ?? 0 })}
  min={0}
/>
```

Replace with:

```tsx
<NumberInput
  label="Rest After (sec)"
  placeholder="120"
  value={block.restSeconds ?? null}
  onChange={(next) => updateBlock(idx, { restSeconds: next ?? 0 })}
  min={0}
  step={1}
  unit="sec"
/>
```

Note: kept `?? 0` on the write side because `restSeconds` in the parent state is `number` (not `number | null`). Long term that should also become nullable — out of scope for this PR.

- [ ] **Step 3: Check if `Input` or `parseIntegerInput` is still imported but unused**

```bash
grep -n "Input\|parseIntegerInput" "src/app/(dashboard)/coach/plans/new/_step-blocks.tsx"
```

If `Input` is now unused, remove its import. If `parseIntegerInput` is now unused, remove its import.

- [ ] **Step 4: Run typecheck and lint**

```bash
npx tsc --noEmit
npm run lint -- "src/app/(dashboard)/coach/plans/new/_step-blocks.tsx"
```

Expected: 0 errors.

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

Open `/coach/plans/new`, add a block, check the "Rest After (sec)" field:

- Default state shows placeholder
- Type "60" — shows 60
- Type "0" — shows "0" (bug fix verified)
- Clear — saves as 0 in parent state (per `?? 0` fallback)

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/coach/plans/new/_step-blocks.tsx"
git commit -m "fix(coach-plans): use NumberInput for rest seconds — preserves 0 display

Previously \`value={block.restSeconds ? block.restSeconds.toString() : \"\"}\`
silently rendered empty for restSeconds=0, hiding the real value behind
the placeholder. NumberInput's number|null API renders 0 as \"0\"."
```

---

## Task 5: Migrate coach profile-edit form

**Files:**

- Modify: `src/app/(dashboard)/coach/athletes/[id]/profile/edit/_form.tsx`

This is the most invasive migration: ~6 number fields, plus per-event PRs and per-lift strength records (currently `Record<string, string>`).

- [ ] **Step 1: Add the import**

```tsx
import { NumberInput } from "@/components/ui/NumberInput";
```

- [ ] **Step 2: Change scalar number state from string to number | null**

Replace:

```tsx
const [heightCm, setHeightCm] = useState(initial.heightCm?.toString() ?? "");
const [weightKg, setWeightKg] = useState(initial.weightKg?.toString() ?? "");
const [gradYear, setGradYear] = useState(initial.gradYear?.toString() ?? "");
```

With:

```tsx
const [heightCm, setHeightCm] = useState<number | null>(initial.heightCm);
const [weightKg, setWeightKg] = useState<number | null>(initial.weightKg);
const [gradYear, setGradYear] = useState<number | null>(initial.gradYear);
```

- [ ] **Step 3: Change record state from Record<string, string> to Record<string, number | null>**

Replace:

```tsx
const [prs, setPrs] = useState<Record<string, string>>(
  Object.fromEntries(EVENTS.map((e) => [e, initial.competitionPRs[e]?.toString() ?? ""]))
);

const [strength, setStrength] = useState<Record<string, string>>(
  Object.fromEntries(
    LIFT_KEYS.map((l) => [l.key, initial.strengthNumbers[l.key]?.toString() ?? ""])
  )
);
```

With:

```tsx
const [prs, setPrs] = useState<Record<string, number | null>>(
  Object.fromEntries(EVENTS.map((e) => [e, initial.competitionPRs[e] ?? null]))
);

const [strength, setStrength] = useState<Record<string, number | null>>(
  Object.fromEntries(LIFT_KEYS.map((l) => [l.key, initial.strengthNumbers[l.key] ?? null]))
);
```

- [ ] **Step 4: Replace the height/weight raw `<input>` blocks (around lines 215-233)**

Replace the height block:

```tsx
<input
  type="number"
  className={inputCls}
  value={heightCm}
  disabled={isClaimed}
  onChange={(e) => setHeightCm(e.target.value)}
/>
```

With:

```tsx
<NumberInput
  value={heightCm}
  onChange={setHeightCm}
  disabled={isClaimed}
  unit="cm"
  step={0.1}
  min={0}
/>
```

Same shape for the weight block (use `unit="kg"`, `step={0.1}`).

The label sits above (`<label className={labelCls}>...</label>`) — keep that or remove and pass `label="Height (cm)"` directly. Match the existing layout.

- [ ] **Step 5: Replace the gradYear raw `<input>` block (around lines 246-252)**

Replace:

```tsx
<input
  type="number"
  className={inputCls}
  value={gradYear}
  disabled={isClaimed}
  onChange={(e) => setGradYear(e.target.value)}
/>
```

With:

```tsx
<NumberInput
  value={gradYear}
  onChange={setGradYear}
  disabled={isClaimed}
  step={1}
  min={1900}
  max={2100}
/>
```

- [ ] **Step 6: Replace the PRs raw `<input>` block (around lines 310-319)**

Replace:

```tsx
<input
  type="number"
  step="0.01"
  className={inputCls}
  value={prs[e]}
  onChange={(ev) => setPrs((p) => ({ ...p, [e]: ev.target.value }))}
  placeholder="e.g. 18.42"
/>
```

With:

```tsx
<NumberInput
  value={prs[e]}
  onChange={(next) => setPrs((p) => ({ ...p, [e]: next }))}
  step={0.01}
  min={0}
  unit="m"
  placeholder="e.g. 18.42"
/>
```

- [ ] **Step 7: Replace the strength raw `<input>` block (around lines 333-342)**

Replace:

```tsx
<input
  type="number"
  step="0.5"
  className={inputCls}
  value={strength[key]}
  onChange={(ev) => setStrength((p) => ({ ...p, [key]: ev.target.value }))}
  placeholder="kg"
/>
```

With:

```tsx
<NumberInput
  value={strength[key]}
  onChange={(next) => setStrength((p) => ({ ...p, [key]: next }))}
  step={0.5}
  min={0}
  unit="kg"
/>
```

- [ ] **Step 8: Simplify the save handler — remove parseNum calls**

Find `handleSave` (around line 88). The body builds payloads using `parseNum(strength[l.key])` and `parseNum(prs[e])`. Since `strength` and `prs` are now `Record<string, number | null>` directly, replace:

```tsx
const body: Record<string, any> = {
  strengthNumbers: Object.fromEntries(LIFT_KEYS.map((l) => [l.key, parseNum(strength[l.key])])),
  competitionPRs: Object.fromEntries(EVENTS.map((e) => [e, parseNum(prs[e])])),
};
```

With:

```tsx
const body: Record<string, any> = {
  strengthNumbers: { ...strength },
  competitionPRs: { ...prs },
};
```

For the `if (!isClaimed)` block further down, replace any `parseNum(heightCm)`, `parseNum(weightKg)`, `parseNum(gradYear)` calls with the bare variable. Read the actual file around lines 105-130 first — the structure may differ from what's shown here.

- [ ] **Step 9: Remove the now-unused `parseNum` helper**

Search for remaining usages:

```bash
grep -n "parseNum" "src/app/(dashboard)/coach/athletes/[id]/profile/edit/_form.tsx"
```

If no remaining call sites, delete the function definition (lines 44-48).

- [ ] **Step 10: Run typecheck and lint**

```bash
npx tsc --noEmit
npm run lint -- "src/app/(dashboard)/coach/athletes/[id]/profile/edit/_form.tsx"
```

Expected: 0 errors. The compiler should catch any leftover places treating `heightCm` etc. as strings.

- [ ] **Step 11: Manual smoke test**

```bash
npm run dev
```

Log in as coach, open an athlete's profile edit page:

- Existing height/weight values render correctly
- Type "0" in weight (athlete bodyweight scenario) — renders "0", saves as 0
- Clear height — renders empty, saves as null
- PR field accepts decimal (18.42)
- Strength field accepts 0.5 step (e.g., 102.5)
- Save → toast success → values persist on reload

Verify both light and dark themes don't break the layout (especially the unit suffix box on PRs/strength).

- [ ] **Step 12: Commit**

```bash
git add "src/app/(dashboard)/coach/athletes/[id]/profile/edit/_form.tsx"
git commit -m "refactor(coach-profile-edit): migrate all numeric fields to NumberInput

Removes string-state ↔ parseNum boundary. Form state now holds
\`number | null\` directly for height/weight/gradYear/PRs/strength,
so the API payload doesn't need re-parsing at save time.

Side effect: bodyweight=0 (legitimate value for some athletes) and
strength=0 (unweighted variants) now display correctly instead of
collapsing to empty placeholder."
```

---

## Task 6: Final verification + PR

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass, including pre-existing tests (verify no regressions).

- [ ] **Step 2: Run full lint**

```bash
npm run lint
```

Expected: 0 new errors. Pre-existing warnings allowed but no new ones.

- [ ] **Step 3: Run typecheck across whole project**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Inspect git log + diff**

```bash
git log main..HEAD --oneline
git diff main..HEAD --stat
```

Expected: 6 commits (1 test + 1 component + 3 migrations + the branch creation has no commit). Diff touches the 5 files listed above.

- [ ] **Step 5: Pause — confirm with user before pushing**

Per `feedback_batch_pushes.md` and `feedback_use_feat_branch_workflow.md`: do NOT push without user direction. Surface the diff stats and ask whether to push the branch + open a PR with `gh pr create` + `gh pr merge --auto --squash`.

If user says push:

```bash
git push -u origin feat/number-input-primitive
gh pr create --title "feat(ui): NumberInput primitive — fixes empty-vs-zero bug class" --body "$(cat <<'EOF'
## Summary
- Adds \`<NumberInput>\` primitive (\`value: number | null\` API) at \`src/components/ui/NumberInput.tsx\`
- Migrates 3 highest-leverage call sites: athlete quick-log, coach plan builder restSeconds, coach profile edit
- Fixes the documented empty-vs-zero bug from CLAUDE.md §3 at every migrated site

## Spec
\`docs/superpowers/specs/2026-05-04-number-input-primitive-design.md\`

## Plan
\`docs/superpowers/plans/2026-05-04-number-input-primitive.md\`

## Test plan
- [x] Vitest: NumberInput.test.tsx
- [x] \`tsc --noEmit\` clean
- [x] \`npm run lint\` clean
- [x] Manual smoke: athlete quick-log distance (mobile + desktop, both themes)
- [x] Manual smoke: coach plan builder rest seconds (verifies \`0\` no longer collapses)
- [x] Manual smoke: coach profile edit (height, weight, gradYear, PRs, strength)

## Out of scope (follow-up)
- Migrate remaining ~50 raw \`<input type="number">\` sites — opportunistic
- New primitives for other catalog gaps: Textarea, Checkbox, Radio, DatePicker, FileUpload
- Remove redundant \`<PasswordInput>\` (Input handles type="password")

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --auto --squash
```

---

## Self-review

- **Spec coverage:** Component built (Task 2), tests written (Task 1), 3 migrations done (Tasks 3-5), verification (Task 6). ✓
- **Placeholder scan:** No TODOs. Every code block is concrete. ✓
- **Type consistency:** `value: number | null` used everywhere. `step?: number`. `parser` is `parseIntegerInput` for integer step, `parseNumericInput` otherwise. ✓
- **Push policy:** Explicitly does NOT push without user OK. ✓
- **Branch policy:** `feat/number-input-primitive` per project workflow. ✓
- **Pre-existing dirty working tree:** Task 0 flags it for user decision before branching. ✓
