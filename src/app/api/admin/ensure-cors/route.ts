import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { configureR2Cors, isR2Configured } from "@/lib/r2";

/**
 * POST /api/admin/ensure-cors
 *
 * One-time R2 CORS configuration. Called automatically before
 * frame extraction to ensure cross-origin video access works.
 * Only coaches can trigger this (authenticated).
 * Idempotent — safe to call multiple times.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "COACH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isR2Configured()) {
      // Local dev — CORS not needed (same-origin)
      return NextResponse.json({ status: "skipped", reason: "R2 not configured (local dev)" });
    }

    await configureR2Cors();
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[ensure-cors] Failed to configure R2 CORS:", err);
    return NextResponse.json(
      { error: "Failed to configure CORS", detail: String(err) },
      { status: 500 }
    );
  }
}
