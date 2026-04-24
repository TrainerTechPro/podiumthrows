#!/usr/bin/env tsx
/**
 * Thin entry point for the canonical-surface screenshot harness. The actual
 * capture logic lives in e2e/canonical-screenshots.spec.ts — that location
 * inherits the Playwright project's webServer, auth-setup dependency, and
 * the POSTGRES_* → localhost env override from playwright.config.ts.
 * Running standalone would bypass those guardrails and risk hitting prod
 * Supabase from .env.local (see feedback_e2e_tests_prod_db_incident.md).
 *
 * Usage:
 *   npx tsx scripts/screenshot-canonical-surfaces.ts
 *   npm run screenshots:canonical
 *
 * Output: tasks/screenshots/pr1/ (40 PNGs) — gitignored; manifest is force-added.
 */

import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["playwright", "test", "--project=canonical-screenshots"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
