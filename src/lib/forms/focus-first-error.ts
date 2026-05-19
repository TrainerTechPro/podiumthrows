/**
 * Find the first invalid field in `container` and focus it.
 *
 * Selector priority (NOT DOM order):
 *   1. `[aria-invalid="true"]` — the semantic marker browsers and AT
 *      understand. Preferred whenever the input itself can carry an
 *      attribute.
 *   2. `[data-field-error="true"]` — escape hatch for custom components
 *      that can't set `aria-invalid` directly (e.g. third-party wrappers
 *      that don't forward attributes to the inner control). Only consulted
 *      if no aria-invalid match exists.
 *
 * If the matched node is a wrapper, focus the first focusable descendant
 * (input/textarea/select/button or any `[tabindex]>=0` element) and fall
 * back to focusing the wrapper itself if there is none.
 *
 * Focus call uses `{ preventScroll: true }` so the scroll is driven by the
 * explicit `scrollIntoView({ block: "center" })` afterwards — otherwise the
 * default focus-scroll lands the field at the viewport top, hidden under a
 * sticky form header on mobile.
 *
 * Use after surfacing a validation error toast — the toast tells WHAT went
 * wrong, the focus tells WHERE. Both belong together; one without the other
 * is half a fix.
 *
 * Returns `true` if an invalid field was found and focused, `false` otherwise.
 */
export function focusFirstError(container: HTMLElement | Document | null = document): boolean {
  if (!container) return false;

  // Priority is enforced by querying each selector separately and short-
  // circuiting on the first hit. A combined `"a, b"` selector would return
  // whichever match comes FIRST IN DOM ORDER, not which selector matched —
  // that's the wrong semantic when both markers coexist on the same form.
  const target =
    container.querySelector<HTMLElement>("[aria-invalid='true']") ??
    container.querySelector<HTMLElement>("[data-field-error='true']");

  if (!target) return false;

  // Exclude tabindex="-1" on every element type — buttons can carry tabindex
  // too, not just generic divs. Hidden inputs are skipped as well.
  const focusable =
    target.querySelector<HTMLElement>(
      [
        "input:not([type='hidden']):not([tabindex='-1'])",
        "textarea:not([tabindex='-1'])",
        "select:not([tabindex='-1'])",
        "button:not([tabindex='-1'])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(", ")
    ) ?? target;

  focusable.focus({ preventScroll: true });
  focusable.scrollIntoView({ block: "center", behavior: "smooth" });
  return true;
}
