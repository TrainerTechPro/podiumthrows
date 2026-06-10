import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  isR2Configured,
} from "@/lib/r2";

/**
 * Artifact storage for the analysis pipeline: R2 when configured (presigned
 * server-side fetch — same client the rest of the repo uses), local
 * .local-storage/ fallback for dev (served via /api/dev-artifacts, NEVER
 * public/ — anything under public/ ships with every deploy), injectable
 * for tests.
 */

export interface AnalysisStorage {
  getJson(key: string): Promise<unknown>;
  putJson(key: string, data: unknown): Promise<void>;
  putBytes(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
}

/**
 * Single source of truth for where a local-dev artifact key lives on disk.
 * Keys are R2-style (`analysis/...`), so everything lands under
 * .local-storage/analysis/.
 */
export function localArtifactPath(key: string): string {
  return path.join(process.cwd(), ".local-storage", key);
}

/** Local-dev write used by the upload fallback route. */
export function saveLocalArtifact(key: string, bytes: Uint8Array): void {
  const p = localArtifactPath(key);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, bytes);
}

export const defaultStorage: AnalysisStorage = {
  async getJson(key) {
    if (isR2Configured()) {
      const url = await getPresignedDownloadUrl(key, 600);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Artifact fetch failed (${res.status}): ${key}`);
      return res.json();
    }
    return JSON.parse(readFileSync(localArtifactPath(key), "utf8"));
  },

  async putJson(key, data) {
    await this.putBytes(key, new TextEncoder().encode(JSON.stringify(data)), "application/json");
  },

  async putBytes(key, bytes, contentType) {
    if (isR2Configured()) {
      const { uploadUrl } = await getPresignedUploadUrl(key, contentType);
      const res = await fetch(uploadUrl, {
        method: "PUT",
        // Content-Type intentionally NOT sent: r2.ts keeps it out of the AWS
        // signature, so sending it here would 403.
        body: bytes as BodyInit,
      });
      if (!res.ok) throw new Error(`Artifact upload failed (${res.status}): ${key}`);
      return;
    }
    saveLocalArtifact(key, bytes);
  },
};
