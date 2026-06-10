import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Pins the strand that shipped 2026-06-10: a job whose webhook landed but
// whose post-pose continuation died with the function instance sat at
// POSE_COMPLETE forever — the cron only scanned QUEUED/PROCESSING.

vi.mock("@/lib/prisma", () => ({
  default: { analysisJob: { findMany: vi.fn() } },
}));
vi.mock("@/lib/analysis/jobs", () => ({ transitionJob: vi.fn() }));
vi.mock("@/lib/analysis/pose-client", () => ({ enqueuePoseJob: vi.fn() }));
vi.mock("@/lib/analysis/process", () => ({ processPoseComplete: vi.fn() }));

import prisma from "@/lib/prisma";
import { transitionJob } from "@/lib/analysis/jobs";
import { enqueuePoseJob } from "@/lib/analysis/pose-client";
import { processPoseComplete } from "@/lib/analysis/process";
import { POST } from "@/app/api/cron/requeue-stale-analysis/route";

const CRON_SECRET = "test-cron-secret";
const mockFn = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function cronRequest(auth?: string) {
  return new NextRequest("http://localhost/api/cron/requeue-stale-analysis", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  mockFn(prisma.analysisJob.findMany).mockResolvedValue([]);
  mockFn(enqueuePoseJob).mockResolvedValue(true);
  mockFn(processPoseComplete).mockResolvedValue(undefined);
  mockFn(transitionJob).mockResolvedValue({ id: "job_1", status: "QUEUED" });
});

describe("requeue-stale-analysis cron", () => {
  it("rejects without the cron bearer", async () => {
    const res = await POST(cronRequest());
    expect(res.status).toBe(401);
  });

  it("scans POSE_COMPLETE jobs and re-runs the continuation, not the GPU", async () => {
    mockFn(prisma.analysisJob.findMany).mockResolvedValue([
      { id: "job_stranded", status: "POSE_COMPLETE" },
    ]);

    const res = await POST(cronRequest(`Bearer ${CRON_SECRET}`));
    const payload = await res.json();

    expect(payload.data).toEqual({ scanned: 1, retriggered: 1 });
    expect(processPoseComplete).toHaveBeenCalledWith("job_stranded");
    expect(enqueuePoseJob).not.toHaveBeenCalled();

    const where = mockFn(prisma.analysisJob.findMany).mock.calls[0][0].where;
    expect(where.OR.map((c: { status: string }) => c.status)).toContain("POSE_COMPLETE");
  });

  it("re-triggers QUEUED jobs via enqueuePoseJob", async () => {
    mockFn(prisma.analysisJob.findMany).mockResolvedValue([
      { id: "job_q", status: "QUEUED" },
    ]);

    const res = await POST(cronRequest(`Bearer ${CRON_SECRET}`));
    const payload = await res.json();

    expect(payload.data).toEqual({ scanned: 1, retriggered: 1 });
    expect(enqueuePoseJob).toHaveBeenCalledWith(expect.objectContaining({ id: "job_q" }));
    expect(processPoseComplete).not.toHaveBeenCalled();
  });

  it("counts a throwing continuation as not retriggered", async () => {
    mockFn(prisma.analysisJob.findMany).mockResolvedValue([
      { id: "job_bad", status: "POSE_COMPLETE" },
    ]);
    mockFn(processPoseComplete).mockRejectedValue(new Error("boom"));

    const res = await POST(cronRequest(`Bearer ${CRON_SECRET}`));
    const payload = await res.json();

    expect(payload.data).toEqual({ scanned: 1, retriggered: 0 });
  });
});
