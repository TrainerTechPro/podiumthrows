import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    analysisJob: { create: vi.fn(), findUnique: vi.fn() },
    calibrationSession: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/authorize", () => ({ canAccessAthlete: vi.fn() }));
vi.mock("@/lib/analysis/gating", () => ({ checkAnalysisAllowance: vi.fn() }));
vi.mock("@/lib/analysis/pose-client", () => ({ enqueuePoseJob: vi.fn() }));
vi.mock("@/lib/r2", () => ({
  isR2Configured: vi.fn(() => false),
  getPresignedDownloadUrl: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { checkAnalysisAllowance } from "@/lib/analysis/gating";
import { enqueuePoseJob } from "@/lib/analysis/pose-client";
import { POST } from "@/app/api/analysis/jobs/route";
import { GET } from "@/app/api/analysis/jobs/[id]/artifacts/route";

const ME = "user_me";
const OTHER = "user_other";

const mockFn = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockFn(getSession).mockResolvedValue({ userId: ME, role: "COACH" });
  mockFn(canAccessAthlete).mockResolvedValue(true);
  mockFn(checkAnalysisAllowance).mockResolvedValue({ allowed: true, plan: "ELITE" });
  mockFn(enqueuePoseJob).mockResolvedValue(undefined);
  mockFn(prisma.analysisJob.create).mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({ id: "job_new", ...args.data })
  );
});

function createRequest(clipPath: string) {
  return new NextRequest("http://localhost/api/analysis/jobs", {
    method: "POST",
    body: JSON.stringify({ athleteId: "ath_1", event: "SHOT_PUT", clipPath }),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/analysis/jobs — clipPath ownership (IDOR, 4c589f0)", () => {
  it("rejects a clipPath under another user's prefix with 400 and creates no job", async () => {
    const res = await POST(createRequest(`analysis/clips/${OTHER}/x.mp4`));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json).toEqual({ success: false, error: "Invalid clip path" });
    expect(prisma.analysisJob.create).not.toHaveBeenCalled();
  });

  it("rejects a clipPath with path traversal even under the caller's own prefix", async () => {
    const res = await POST(createRequest(`analysis/clips/${ME}/../${OTHER}/x.mp4`));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json).toEqual({ success: false, error: "Invalid clip path" });
    expect(prisma.analysisJob.create).not.toHaveBeenCalled();
  });

  it("rejects a clipPath outside the clips namespace entirely", async () => {
    const res = await POST(createRequest("exports/billing.csv"));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json).toEqual({ success: false, error: "Invalid clip path" });
    expect(prisma.analysisJob.create).not.toHaveBeenCalled();
  });

  it("accepts a legitimate clipPath under the caller's own prefix with 201", async () => {
    const clipPath = `analysis/clips/${ME}/clip.mp4`;
    const res = await POST(createRequest(clipPath));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(prisma.analysisJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: ME, clipPath }),
    });
  });
});

const legitimateJob = {
  id: "job_1",
  userId: ME,
  athleteId: "ath_1",
  clipPath: `analysis/clips/${ME}/clip.mp4`,
  poseArtifact: { smoothedPath: "analysis/job_1/pose-smoothed.json" },
  result: { reportPdfPath: "analysis/job_1/report.pdf" },
};

function artifactsRequest() {
  const req = new NextRequest("http://localhost/api/analysis/jobs/job_1/artifacts");
  return GET(req, { params: Promise.resolve({ id: "job_1" }) });
}

describe("GET /api/analysis/jobs/[id]/artifacts — key prefix re-check (IDOR, 4c589f0)", () => {
  it("resolves clipUrl to null when the stored clipPath sits under another user's prefix", async () => {
    mockFn(prisma.analysisJob.findUnique).mockResolvedValue({
      ...legitimateJob,
      clipPath: `analysis/clips/${OTHER}/stolen.mp4`,
    });
    const res = await artifactsRequest();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.clipUrl).toBeNull();
    expect(json.data.smoothedPoseUrl).not.toBeNull();
    expect(json.data.reportPdfUrl).not.toBeNull();
  });

  it("resolves smoothedPoseUrl to null when smoothedPath points outside analysis/<jobId>/", async () => {
    mockFn(prisma.analysisJob.findUnique).mockResolvedValue({
      ...legitimateJob,
      poseArtifact: { smoothedPath: "analysis/job_other/pose-smoothed.json" },
    });
    const res = await artifactsRequest();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.smoothedPoseUrl).toBeNull();
    expect(json.data.clipUrl).not.toBeNull();
    expect(json.data.reportPdfUrl).not.toBeNull();
  });

  it("resolves reportPdfUrl to null when reportPdfPath points outside analysis/<jobId>/", async () => {
    mockFn(prisma.analysisJob.findUnique).mockResolvedValue({
      ...legitimateJob,
      result: { reportPdfPath: "exports/billing.csv" },
    });
    const res = await artifactsRequest();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.reportPdfUrl).toBeNull();
    expect(json.data.clipUrl).not.toBeNull();
    expect(json.data.smoothedPoseUrl).not.toBeNull();
  });

  it("resolves all three URLs when every key sits under its legitimate prefix", async () => {
    mockFn(prisma.analysisJob.findUnique).mockResolvedValue(legitimateJob);
    const res = await artifactsRequest();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toEqual({
      clipUrl: `/uploads/analysis/clips/${ME}/clip.mp4`,
      smoothedPoseUrl: "/uploads/analysis/job_1/pose-smoothed.json",
      reportPdfUrl: "/uploads/analysis/job_1/report.pdf",
    });
  });
});
