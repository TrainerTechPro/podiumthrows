import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`__REDIRECT__:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error(`__NOT_FOUND__`);
  }),
  requireAthleteSession: vi.fn(),
  getSessionWithPrescription: vi.fn(),
  programSessionFindFirst: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mocks.redirect(url),
  notFound: () => mocks.notFound(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    programSession: {
      findFirst: (...a: unknown[]) => mocks.programSessionFindFirst(...a),
    },
  },
}));

vi.mock("@/lib/data/athlete", () => ({
  requireAthleteSession: (...a: unknown[]) => mocks.requireAthleteSession(...a),
  getSessionWithPrescription: (...a: unknown[]) => mocks.getSessionWithPrescription(...a),
}));

vi.mock("./live", () => ({
  LiveTrainingSession: ({ session }: { session: { id: string; status: string } }) =>
    React.createElement("div", {
      "data-testid": "live",
      "data-session-id": session.id,
      "data-status": session.status,
    }),
}));

vi.mock("./recap", () => ({
  TrainingSessionRecap: ({ sessionId }: { sessionId: string }) =>
    React.createElement("div", { "data-testid": "recap", "data-session-id": sessionId }),
}));

vi.mock("./_program-session-view", () => ({
  ProgramSessionView: () => React.createElement("div", { "data-testid": "program" }),
}));

import AthleteSessionPage from "./page";

const ATHLETE = { id: "a1", firstName: "Alice" };
const AUTH_SESSION = { userId: "u1", email: "a@t.com", role: "ATHLETE" as const };

function seed(status: string) {
  mocks.requireAthleteSession.mockResolvedValue({
    session: AUTH_SESSION,
    athlete: ATHLETE,
    isOnboarded: true,
  });
  mocks.getSessionWithPrescription.mockResolvedValue({ id: "s1", status });
}

async function callPage(view: string | undefined) {
  return AthleteSessionPage({
    params: Promise.resolve({ id: "s1" }),
    searchParams: Promise.resolve(view ? { view } : {}),
  });
}

describe("athlete /session/[id] page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("?view=live renders LiveTrainingSession", async () => {
    seed("IN_PROGRESS");
    const tree = await callPage("live");
    const { getByTestId } = render(tree as React.ReactElement);
    expect(getByTestId("live").getAttribute("data-session-id")).toBe("s1");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("?view=recap renders TrainingSessionRecap", async () => {
    seed("COMPLETED");
    const tree = await callPage("recap");
    const { getByTestId } = render(tree as React.ReactElement);
    expect(getByTestId("recap").getAttribute("data-session-id")).toBe("s1");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("no ?view + status=COMPLETED redirects to ?view=recap", async () => {
    seed("COMPLETED");
    await expect(callPage(undefined)).rejects.toThrow(
      "__REDIRECT__:/athlete/session/s1?view=recap"
    );
  });

  it("no ?view + status=IN_PROGRESS redirects to ?view=live", async () => {
    seed("IN_PROGRESS");
    await expect(callPage(undefined)).rejects.toThrow("__REDIRECT__:/athlete/session/s1?view=live");
  });

  it("no ?view + status=SCHEDULED redirects to ?view=live", async () => {
    seed("SCHEDULED");
    await expect(callPage(undefined)).rejects.toThrow("__REDIRECT__:/athlete/session/s1?view=live");
  });

  it("requireAthleteSession rejection surfaces (no access)", async () => {
    mocks.requireAthleteSession.mockRejectedValue(new Error("__REDIRECT__:/login"));
    await expect(callPage("live")).rejects.toThrow("__REDIRECT__:/login");
  });
});
