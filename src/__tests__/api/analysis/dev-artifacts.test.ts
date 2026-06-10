import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));

import { getSession } from "@/lib/auth";
import { GET } from "@/app/api/dev-artifacts/[...key]/route";
import { localArtifactPath } from "@/lib/analysis/storage";

const FIXTURE_DIR = "analysis/__devartifacts_test__";

function get(segments: string[]) {
  const req = new NextRequest(`http://localhost/api/dev-artifacts/${segments.join("/")}`);
  return GET(req, { params: Promise.resolve({ key: segments }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "u1", role: "COACH" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(localArtifactPath(FIXTURE_DIR), { recursive: true, force: true });
});

describe("GET /api/dev-artifacts/[...key]", () => {
  it("streams a file under .local-storage/analysis/ with its content type", async () => {
    const key = `${FIXTURE_DIR}/report.pdf`;
    mkdirSync(path.dirname(localArtifactPath(key)), { recursive: true });
    writeFileSync(localArtifactPath(key), "%PDF-fake");

    const res = await get(key.split("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(await res.text()).toBe("%PDF-fake");
  });

  it("rejects traversal out of the analysis root with 400", async () => {
    const res = await get(["analysis", "..", "..", "package.json"]);
    expect(res.status).toBe(400);
  });

  it("rejects keys outside the analysis namespace with 400", async () => {
    const res = await get(["exports", "billing.csv"]);
    expect(res.status).toBe(400);
  });

  it("requires a session", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await get([FIXTURE_DIR, "report.pdf"]);
    expect(res.status).toBe(401);
  });

  it("is a hard 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await get([FIXTURE_DIR, "report.pdf"]);
    expect(res.status).toBe(404);
  });

  it("404s a missing file", async () => {
    const res = await get([FIXTURE_DIR, "nope.json"]);
    expect(res.status).toBe(404);
  });
});
