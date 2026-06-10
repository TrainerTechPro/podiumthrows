import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/r2", () => ({
  getPresignedDownloadUrl: vi.fn(async () => "https://r2.example/clip?sig=1"),
  getPresignedUploadUrl: vi.fn(async () => ({ uploadUrl: "https://r2.example/put?sig=2" })),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

import { enqueuePoseJob } from "@/lib/analysis/pose-client";

const JOB = { id: "job_1", clipPath: "analysis/job_1/clip.mp4" };
const ENV_KEYS = ["MODAL_POSE_URL", "MODAL_POSE_TOKEN", "NEXT_PUBLIC_APP_URL", "APP_URL"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  process.env.MODAL_POSE_URL = "https://pose.example.run";
  process.env.MODAL_POSE_TOKEN = "tok";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  delete process.env.APP_URL;
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

describe("enqueuePoseJob env hygiene", () => {
  // Shipped bug (2026-06-10): NEXT_PUBLIC_APP_URL stored with a trailing
  // newline made Modal's urllib reject the webhook URL after the full
  // GPU pipeline had already run. Env values must be trimmed at this boundary.
  it("strips whitespace/newlines from env-derived URLs", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com\n";
    process.env.MODAL_POSE_URL = " https://pose.example.run\n";

    const ok = await enqueuePoseJob(JOB);
    expect(ok).toBe(true);

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://pose.example.run");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.webhookUrl).toBe("https://app.example.com/api/analysis/webhooks/pose");
    expect(body.webhookUrl).not.toMatch(/\s/);
  });

  it("strips a trailing slash before appending the webhook path", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/\n";
    await enqueuePoseJob(JOB);
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.webhookUrl).toBe("https://app.example.com/api/analysis/webhooks/pose");
  });

  it("returns false without fetching when service env is missing", async () => {
    delete process.env.MODAL_POSE_URL;
    const ok = await enqueuePoseJob(JOB);
    expect(ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
