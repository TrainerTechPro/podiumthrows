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
  getCurrentUser: vi.fn(),
  canAccessAthlete: vi.fn(),
  throwsAssignmentFindUnique: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mocks.redirect(url),
  notFound: () => mocks.notFound(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    throwsAssignment: {
      findUnique: (...a: unknown[]) => mocks.throwsAssignmentFindUnique(...a),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...a: unknown[]) => mocks.getCurrentUser(...a),
}));

vi.mock("@/lib/authorize", () => ({
  canAccessAthlete: (...a: unknown[]) => mocks.canAccessAthlete(...a),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("./live", () => ({
  AthleteThrowsLive: ({ assignment }: { assignment: { id: string; status: string } }) =>
    React.createElement("div", {
      "data-testid": "live",
      "data-assignment-id": assignment.id,
      "data-status": assignment.status,
    }),
}));

vi.mock("./recap", () => ({
  AthleteThrowsRecap: ({ assignment }: { assignment: { id: string; status: string } }) =>
    React.createElement("div", {
      "data-testid": "recap",
      "data-assignment-id": assignment.id,
      "data-status": assignment.status,
    }),
}));

import AthleteThrowsPage from "./page";

function seed(status: string) {
  mocks.getCurrentUser.mockResolvedValue({ userId: "u1", email: "a@t.com", role: "ATHLETE" });
  mocks.canAccessAthlete.mockResolvedValue(true);
  mocks.throwsAssignmentFindUnique.mockResolvedValue({
    id: "ta1",
    athleteId: "a1",
    status,
    session: { blocks: [] },
    throwLogs: [],
    athlete: { user: { id: "u1", email: "a@t.com" } },
  });
}

async function callPage(view: string | undefined) {
  return AthleteThrowsPage({
    params: Promise.resolve({ id: "ta1" }),
    searchParams: Promise.resolve(view ? { view } : {}),
  });
}

describe("athlete /throws/[id] page — live statuses", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["ASSIGNED", "NOTIFIED", "IN_PROGRESS"])(
    "status=%s with no ?view redirects to ?view=live",
    async (status) => {
      seed(status);
      await expect(callPage(undefined)).rejects.toThrow(
        "__REDIRECT__:/athlete/throws/ta1?view=live"
      );
    }
  );

  it.each(["ASSIGNED", "NOTIFIED", "IN_PROGRESS"])(
    "status=%s with ?view=live renders AthleteThrowsLive",
    async (status) => {
      seed(status);
      const tree = await callPage("live");
      const { getByTestId } = render(tree as React.ReactElement);
      expect(getByTestId("live").getAttribute("data-status")).toBe(status);
    }
  );
});

describe("athlete /throws/[id] page — recap statuses", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["COMPLETED", "PARTIAL", "SKIPPED"])(
    "status=%s with no ?view redirects to ?view=recap",
    async (status) => {
      seed(status);
      await expect(callPage(undefined)).rejects.toThrow(
        "__REDIRECT__:/athlete/throws/ta1?view=recap"
      );
    }
  );

  it.each(["COMPLETED", "PARTIAL", "SKIPPED"])(
    "status=%s with ?view=recap renders AthleteThrowsRecap",
    async (status) => {
      seed(status);
      const tree = await callPage("recap");
      const { getByTestId } = render(tree as React.ReactElement);
      expect(getByTestId("recap").getAttribute("data-status")).toBe(status);
    }
  );
});

describe("athlete /throws/[id] page — guard rails", () => {
  beforeEach(() => vi.clearAllMocks());

  it("no user → notFound", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(callPage("live")).rejects.toThrow("__NOT_FOUND__");
  });

  it("assignment not found → notFound", async () => {
    mocks.getCurrentUser.mockResolvedValue({ userId: "u1", email: "a@t.com", role: "ATHLETE" });
    mocks.throwsAssignmentFindUnique.mockResolvedValue(null);
    await expect(callPage("live")).rejects.toThrow("__NOT_FOUND__");
  });

  it("access denied → notFound", async () => {
    seed("ASSIGNED");
    mocks.canAccessAthlete.mockResolvedValue(false);
    await expect(callPage("live")).rejects.toThrow("__NOT_FOUND__");
  });
});
