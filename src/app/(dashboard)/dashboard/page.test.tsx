import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  cookieGet: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`__REDIRECT__:${url}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getSession: (...a: unknown[]) => mocks.getSession(...a),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) => mocks.cookieGet(name),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mocks.redirect(url),
}));

import DashboardEntryPage from "./page";

type Payload = {
  userId: string;
  email: string;
  role?: string;
  isAdmin?: boolean;
};

function setPayload(p: Payload | null) {
  mocks.getSession.mockResolvedValue(p);
}

function setActiveMode(v: string | undefined) {
  mocks.cookieGet.mockImplementation((name: string) =>
    name === "active-mode" && v ? { value: v } : undefined
  );
}

async function expectRedirect(to: string) {
  await expect(DashboardEntryPage()).rejects.toThrow(`__REDIRECT__:${to}`);
}

describe("/dashboard router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveMode(undefined);
  });

  it("athletes go to /athlete/dashboard", async () => {
    setPayload({ userId: "u1", email: "a@t.com", role: "ATHLETE" });
    await expectRedirect("/athlete/dashboard");
  });

  it("coach with no active-mode cookie goes to /coach/dashboard", async () => {
    setPayload({ userId: "u2", email: "c@t.com", role: "COACH" });
    await expectRedirect("/coach/dashboard");
  });

  it("coach with active-mode=TRAINING goes to /athlete/dashboard", async () => {
    setPayload({ userId: "u2", email: "c@t.com", role: "COACH" });
    setActiveMode("TRAINING");
    await expectRedirect("/athlete/dashboard");
  });

  it("admin coach with active-mode=TRAINING still goes to /athlete/dashboard (training wins)", async () => {
    setPayload({ userId: "u3", email: "admin@t.com", role: "COACH", isAdmin: true });
    setActiveMode("TRAINING");
    await expectRedirect("/athlete/dashboard");
  });

  it("null payload goes to /login?redirect=/dashboard", async () => {
    setPayload(null);
    await expectRedirect("/login?redirect=/dashboard");
  });

  it("undefined role with isAdmin=true goes to /coach/dashboard", async () => {
    setPayload({ userId: "u4", email: "admin@t.com", isAdmin: true });
    await expectRedirect("/coach/dashboard");
  });

  it("garbage role without admin falls through to /login?redirect=/dashboard", async () => {
    setPayload({ userId: "u5", email: "x@t.com", role: "SOMETHING_ELSE" });
    await expectRedirect("/login?redirect=/dashboard");
  });
});
