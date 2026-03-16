/**
 * Audit logging for security-sensitive actions.
 *
 * All calls are fire-and-forget — they never block the request path
 * and silently swallow errors to avoid impacting user-facing flows.
 */

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";

export interface AuditEntry {
  userId?: string | null;
  action: string;
  resource?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Extract client IP from request headers. */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Extract user-agent from request headers. */
export function getUserAgent(req: NextRequest): string {
  return req.headers.get("user-agent") || "unknown";
}

/**
 * Write an audit log entry. Fire-and-forget — call without `await`.
 *
 * Usage:
 * ```ts
 * void logAudit({ userId: user.id, action: "LOGIN_SUCCESS", ip, userAgent });
 * ```
 */
export function logAudit(entry: AuditEntry): void {
  prisma.auditLog
    .create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        resource: entry.resource ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: (entry.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    })
    .catch((err) => {
      logger.error("Failed to write audit log", { context: "audit", error: err });
    });
}

/**
 * Convenience: build common request fields for audit entries.
 */
export function auditRequestInfo(req: NextRequest) {
  return {
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  };
}
