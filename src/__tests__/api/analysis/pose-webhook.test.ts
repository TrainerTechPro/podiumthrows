import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    analysisJob: { findUnique: vi.fn() },
    poseArtifact: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import prisma from "@/lib/prisma";
import { POST } from "@/app/api/analysis/webhooks/pose/route";

const SECRET = "test-pose-webhook-secret";

function signedRequest(payload: unknown, opts: { signature?: string } = {}) {
  const body = JSON.stringify(payload);
  const signature =
    opts.signature ?? createHmac("sha256", SECRET).update(body).digest("hex");
  return new NextRequest("http://localhost/api/analysis/webhooks/pose", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", "x-pose-signature": signature },
  });
}

const completePayload = {
  jobId: "job_1",
  status: "pose_complete",
  rawPath: "analysis/job_1/pose-raw.json",
  modelId: "rtmpose-l",
  modelVersion: "0.0.13",
  fpsTrue: 30,
  timings: { pose: 12.5 },
};

/** $transaction(cb) runs against the same mocked prisma (transitionJob path). */
function wireTransaction(jobRow: { id: string; status: string } | null) {
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        analysisJob: {
          findUnique: vi.fn().mockResolvedValue(jobRow),
          update: vi
            .fn()
            .mockImplementation(async (args: { data: { status: string } }) => ({
              ...jobRow,
              status: args.data.status,
            })),
        },
      })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.POSE_WEBHOOK_SECRET = SECRET;
});

describe("POST /api/analysis/webhooks/pose — signature", () => {
  it("rejects a missing signature with 401", async () => {
    const body = JSON.stringify(completePayload);
    const req = new NextRequest("http://localhost/api/analysis/webhooks/pose", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects a wrong signature with 401 and touches nothing", async () => {
    const res = await POST(signedRequest(completePayload, { signature: "0".repeat(64) }));
    expect(res.status).toBe(401);
    expect(prisma.analysisJob.findUnique).not.toHaveBeenCalled();
  });

  it("rejects when the secret is unset (fail closed)", async () => {
    delete process.env.POSE_WEBHOOK_SECRET;
    const res = await POST(signedRequest(completePayload));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/analysis/webhooks/pose — pose_complete", () => {
  it("records the artifact and advances PROCESSING → POSE_COMPLETE", async () => {
    const jobRow = { id: "job_1", status: "PROCESSING", timings: {}, poseArtifact: null };
    (prisma.analysisJob.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(jobRow);
    wireTransaction(jobRow);

    const res = await POST(signedRequest(completePayload));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.duplicate).toBeUndefined();
    expect(prisma.poseArtifact.create).toHaveBeenCalledWith({
      data: {
        jobId: "job_1",
        rawPath: "analysis/job_1/pose-raw.json",
        modelId: "rtmpose-l",
        modelVersion: "0.0.13",
      },
    });
  });

  it("walks QUEUED → PROCESSING → POSE_COMPLETE when the accept callback was missed", async () => {
    const jobRow = { id: "job_1", status: "QUEUED", timings: null, poseArtifact: null };
    (prisma.analysisJob.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(jobRow);
    const statuses: string[] = [];
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          analysisJob: {
            findUnique: vi.fn().mockResolvedValue({ ...jobRow, status: statuses.at(-1) ?? "QUEUED" }),
            update: vi.fn().mockImplementation(async (args: { data: { status: string } }) => {
              statuses.push(args.data.status);
              return { ...jobRow, status: args.data.status };
            }),
          },
        })
    );

    const res = await POST(signedRequest(completePayload));
    expect(res.status).toBe(200);
    expect(statuses).toEqual(["PROCESSING", "POSE_COMPLETE"]);
  });

  it("treats a duplicate delivery as a no-op", async () => {
    (prisma.analysisJob.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job_1",
      status: "POSE_COMPLETE",
      timings: {},
      poseArtifact: { id: "pa_1" },
    });

    const res = await POST(signedRequest(completePayload));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.duplicate).toBe(true);
    expect(prisma.poseArtifact.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("400s a pose_complete without artifact fields", async () => {
    (prisma.analysisJob.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job_1",
      status: "PROCESSING",
      timings: {},
      poseArtifact: null,
    });
    const res = await POST(signedRequest({ jobId: "job_1", status: "pose_complete" }));
    expect(res.status).toBe(400);
  });

  it("404s an unknown job", async () => {
    (prisma.analysisJob.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(signedRequest(completePayload));
    expect(res.status).toBe(404);
  });

  it("400s a payload that fails the contract", async () => {
    const res = await POST(signedRequest({ jobId: "job_1", status: "what" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/analysis/webhooks/pose — failed", () => {
  it("transitions to FAILED with the reported error", async () => {
    const jobRow = { id: "job_1", status: "PROCESSING", timings: {}, poseArtifact: null };
    (prisma.analysisJob.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(jobRow);
    wireTransaction(jobRow);

    const res = await POST(
      signedRequest({
        jobId: "job_1",
        status: "failed",
        error: { code: "MULTI_PERSON", message: "two people" },
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.received).toBe(true);
  });

  it("is idempotent for an already-FAILED job", async () => {
    (prisma.analysisJob.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job_1",
      status: "FAILED",
      timings: {},
      poseArtifact: null,
    });
    const res = await POST(
      signedRequest({ jobId: "job_1", status: "failed", error: { code: "X", message: "y" } })
    );
    const json = await res.json();
    expect(json.data.duplicate).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
