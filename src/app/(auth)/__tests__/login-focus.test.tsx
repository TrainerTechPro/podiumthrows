/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, fireEvent } from "@testing-library/react";
import LoginPage from "../login/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));
vi.mock("@/lib/csrf-client", () => ({ csrfHeaders: () => ({}) }));

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

/**
 * Focus side-effect is covered by 10 cases in
 * src/lib/forms/__tests__/focus-first-error.test.ts. Here we verify the
 * page wires the helper correctly by asserting aria-invalid lands on the
 * right input after each client-side failure — if the marker is on the
 * field, the helper has a real target to focus.
 */
describe("/login — focus-first-error wiring", () => {
  it("marks email aria-invalid when the form submits empty", async () => {
    const { container } = render(<LoginPage />);
    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      fireEvent.submit(form);
    });

    const email = document.getElementById("email") as HTMLInputElement;
    expect(email.getAttribute("aria-invalid")).toBe("true");
  });

  it("marks password aria-invalid when only email is filled", async () => {
    const { container } = render(<LoginPage />);
    const email = document.getElementById("email") as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      fireEvent.change(email, { target: { value: "coach@example.com" } });
    });
    await act(async () => {
      fireEvent.submit(form);
    });

    const password = document.getElementById("password") as HTMLInputElement;
    expect(password.getAttribute("aria-invalid")).toBe("true");
    expect(email.getAttribute("aria-invalid")).toBe("false");
  });
});
