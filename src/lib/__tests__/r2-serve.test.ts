import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the presigner so toServeUrl's signed path is exercised without network/creds.
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://acct.r2.cloudflarestorage.com/key?X-Amz-Signature=abc"),
}));

import { toServeUrl, isPrivateServingEnabled } from "@/lib/r2";

const R2_ENV = {
  R2_ACCOUNT_ID: "acct",
  R2_ACCESS_KEY_ID: "ak",
  R2_SECRET_ACCESS_KEY: "sk",
  R2_BUCKET_NAME: "bucket",
  R2_PUBLIC_URL: "https://pub.example.com",
};

beforeEach(() => {
  for (const [k, v] of Object.entries(R2_ENV)) vi.stubEnv(k, v);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("isPrivateServingEnabled", () => {
  it("is false unless R2_PRIVATE_SERVING === 'true'", () => {
    vi.stubEnv("R2_PRIVATE_SERVING", "");
    expect(isPrivateServingEnabled()).toBe(false);
    vi.stubEnv("R2_PRIVATE_SERVING", "1");
    expect(isPrivateServingEnabled()).toBe(false);
    vi.stubEnv("R2_PRIVATE_SERVING", "true");
    expect(isPrivateServingEnabled()).toBe(true);
  });
});

describe("toServeUrl — flag OFF (default)", () => {
  it("returns the stored URL unchanged", async () => {
    vi.stubEnv("R2_PRIVATE_SERVING", "");
    const stored = "https://pub.example.com/videos/athletes/a1/clip.mp4";
    expect(await toServeUrl(stored)).toBe(stored);
  });

  it("passes through null/undefined", async () => {
    vi.stubEnv("R2_PRIVATE_SERVING", "");
    expect(await toServeUrl(null)).toBeNull();
    expect(await toServeUrl(undefined)).toBeUndefined();
  });
});

describe("toServeUrl — flag ON", () => {
  beforeEach(() => vi.stubEnv("R2_PRIVATE_SERVING", "true"));

  it("mints a presigned URL when the key is recoverable from the stored URL", async () => {
    const out = await toServeUrl("https://pub.example.com/videos/athletes/a1/clip.mp4");
    expect(out).toContain("X-Amz-Signature");
  });

  it("mints a presigned URL from an explicit key field", async () => {
    const out = await toServeUrl("https://pub.example.com/anything", {
      key: "videos/athletes/a1/clip.mp4",
    });
    expect(out).toContain("X-Amz-Signature");
  });

  it("leaves a non-R2 / local path untouched (unrecoverable key)", async () => {
    expect(await toServeUrl("/uploads/clip.mp4")).toBe("/uploads/clip.mp4");
  });

  it("falls back to the stored URL when R2 is not configured", async () => {
    vi.stubEnv("R2_PUBLIC_URL", "");
    const stored = "https://pub.example.com/videos/x.mp4";
    expect(await toServeUrl(stored)).toBe(stored);
  });
});
