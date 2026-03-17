import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`health:${ip}`, {
    maxAttempts: 60,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
    );
  }

  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", timestamp, db: "connected" });
  } catch {
    return NextResponse.json(
      { status: "degraded", timestamp, db: "disconnected" },
      { status: 503 }
    );
  }
}
