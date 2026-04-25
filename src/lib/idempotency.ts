import { createHash } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Idempotency wrapper for mutation endpoints.
 *
 * The client sends a stable UUID via the `X-Idempotency-Key` header. On the
 * first request the wrapper runs the handler and caches the response keyed on
 * `(userId, endpoint, key)`. On retry — including the offline outbox replay
 * after a dropped response — the cached response is returned and the handler
 * does not run, so the underlying write is not duplicated.
 *
 * The request body is hashed and stored alongside the cache entry: if the
 * client reuses the same key with a different body the wrapper returns 422
 * rather than serving a misleading cached response.
 *
 * No header → bypass entirely (backward compatible). 4xx/5xx responses are
 * never cached so the client can retry hopefully.
 */

export interface IdempotencyContext {
  userId: string;
  endpoint: string;
  req: NextRequest;
}

export type IdempotencyHandler = (bodyText: string) => Promise<NextResponse>;

const HEADER_NAME = "x-idempotency-key";

export async function withIdempotency(
  ctx: IdempotencyContext,
  handler: IdempotencyHandler
): Promise<NextResponse> {
  const bodyText = await ctx.req.text();
  const key = ctx.req.headers.get(HEADER_NAME);

  if (!key) {
    return handler(bodyText);
  }

  const requestHash = sha256(bodyText);

  const existing = await prisma.idempotencyKey.findUnique({
    where: {
      userId_endpoint_key: { userId: ctx.userId, endpoint: ctx.endpoint, key },
    },
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      return NextResponse.json(
        {
          success: false,
          error: "Idempotency-Key reused with a different request body",
        },
        { status: 422 }
      );
    }
    return NextResponse.json(existing.responseBody, { status: existing.responseStatus });
  }

  const response = await handler(bodyText);

  if (response.status >= 200 && response.status < 300) {
    let responseBody: unknown;
    try {
      responseBody = await response.clone().json();
    } catch (err) {
      logger.warn("idempotency: non-JSON 2xx response, skipping cache", {
        context: "src/lib/idempotency.ts",
        metadata: {
          endpoint: ctx.endpoint,
          status: response.status,
          err: err instanceof Error ? err.message : String(err),
        },
      });
      return response;
    }

    try {
      await prisma.idempotencyKey.create({
        data: {
          key,
          userId: ctx.userId,
          endpoint: ctx.endpoint,
          requestHash,
          responseStatus: response.status,
          responseBody: responseBody as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      // P2002 unique violation = a sibling request committed first. The
      // duplicate row exists, the original handler already ran for this
      // request — log and return the response we computed.
      logger.warn("idempotency: cache write failed", {
        context: "src/lib/idempotency.ts",
        metadata: {
          endpoint: ctx.endpoint,
          err: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  return response;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
