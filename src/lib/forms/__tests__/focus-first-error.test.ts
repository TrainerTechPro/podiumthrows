/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { focusFirstError } from "../focus-first-error";

beforeEach(() => {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  // jsdom doesn't implement scrollIntoView; stub once per test so we can spy.
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

function makeInput(id: string, opts: { ariaInvalid?: boolean } = {}): HTMLInputElement {
  const el = document.createElement("input");
  el.id = id;
  if (opts.ariaInvalid) el.setAttribute("aria-invalid", "true");
  return el;
}

describe("focusFirstError — selector priority", () => {
  it("prefers [aria-invalid='true'] even when [data-field-error='true'] appears earlier in DOM order", () => {
    // Wrapper marked with data-field-error first; aria-invalid input after.
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-field-error", "true");
    wrapper.id = "wrap-first";
    wrapper.appendChild(makeInput("wrap-inner"));
    document.body.appendChild(wrapper);

    const ariaInput = makeInput("aria-target", { ariaInvalid: true });
    document.body.appendChild(ariaInput);

    expect(focusFirstError(document.body)).toBe(true);
    expect(document.activeElement?.id).toBe("aria-target");
  });

  it("falls back to [data-field-error='true'] when no aria-invalid match exists", () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-field-error", "true");
    wrapper.id = "wrap-only";
    wrapper.appendChild(makeInput("inner"));
    document.body.appendChild(wrapper);

    expect(focusFirstError(document.body)).toBe(true);
    expect(document.activeElement?.id).toBe("inner");
  });

  it("focuses the first aria-invalid in DOM order when multiple exist", () => {
    document.body.appendChild(makeInput("clean"));
    document.body.appendChild(makeInput("first-bad", { ariaInvalid: true }));
    document.body.appendChild(makeInput("second-bad", { ariaInvalid: true }));

    expect(focusFirstError(document.body)).toBe(true);
    expect(document.activeElement?.id).toBe("first-bad");
  });
});

describe("focusFirstError — wrapper drill-down", () => {
  it("focuses the inner focusable when the matched element is a wrapper", () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-field-error", "true");
    wrapper.id = "wrap";
    const inner = makeInput("inner");
    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);

    expect(focusFirstError(document.body)).toBe(true);
    expect(document.activeElement?.id).toBe("inner");
    expect(document.activeElement?.id).not.toBe("wrap");
  });

  it("focuses the wrapper itself when no inner focusable exists", () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-field-error", "true");
    wrapper.id = "wrap-empty";
    wrapper.setAttribute("tabindex", "0");
    document.body.appendChild(wrapper);

    expect(focusFirstError(document.body)).toBe(true);
    expect(document.activeElement?.id).toBe("wrap-empty");
  });

  it("skips hidden inputs and disabled-tabindex elements when drilling into wrappers", () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-field-error", "true");
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.id = "hidden";
    const tabminus = document.createElement("button");
    tabminus.id = "tabminus";
    tabminus.setAttribute("tabindex", "-1");
    const real = makeInput("real");
    wrapper.appendChild(hidden);
    wrapper.appendChild(tabminus);
    wrapper.appendChild(real);
    document.body.appendChild(wrapper);

    expect(focusFirstError(document.body)).toBe(true);
    // Button (no -1) would win over input, so put the button second? Here
    // hidden + tabindex=-1 are skipped by the selector, leaving `real`.
    expect(document.activeElement?.id).toBe("real");
  });
});

describe("focusFirstError — focus + scroll contract", () => {
  it("focuses with preventScroll: true so the explicit scrollIntoView controls placement", () => {
    const input = makeInput("only", { ariaInvalid: true });
    const focusSpy = vi.spyOn(input, "focus");
    document.body.appendChild(input);

    expect(focusFirstError(document.body)).toBe(true);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("calls scrollIntoView({ block: 'center', behavior: 'smooth' }) on the focused element", () => {
    const input = makeInput("only", { ariaInvalid: true });
    document.body.appendChild(input);
    const scrollSpy = input.scrollIntoView as unknown as ReturnType<typeof vi.fn>;

    expect(focusFirstError(document.body)).toBe(true);
    expect(scrollSpy).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
  });
});

describe("focusFirstError — null + no-match behavior", () => {
  it("returns false and does nothing when given a null container", () => {
    // Place an aria-invalid input in document so we'd see a false positive
    // if the helper accidentally fell through to the default container.
    document.body.appendChild(makeInput("should-not-focus", { ariaInvalid: true }));
    const activeBefore = document.activeElement;
    expect(focusFirstError(null)).toBe(false);
    expect(document.activeElement).toBe(activeBefore);
  });

  it("returns false when the container has no invalid markers", () => {
    document.body.appendChild(makeInput("a"));
    document.body.appendChild(makeInput("b"));
    expect(focusFirstError(document.body)).toBe(false);
  });
});
