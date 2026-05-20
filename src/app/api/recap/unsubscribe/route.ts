import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { verifyUnsubscribeToken } from "@/lib/recap/unsubscribe-token";
import { updatePushPreferences } from "@/lib/push/preferences";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  aid: z.string().min(1),
  t: z.string().min(1),
});

const ConfirmationHtml = (state: "ok" | "invalid"): string => {
  const ok = state === "ok";
  const heading = ok ? "Weekly recap turned off" : "This unsubscribe link is invalid";
  const body = ok
    ? "We won&#39;t email or in-app notify you for the Sunday recap. You can re-enable it anytime in Settings."
    : "The link may have expired or been altered. Re-open the latest weekly recap email and try again, or update your preferences directly.";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${heading} — Podium Throws</title>
  <style>
    body { margin:0; padding:0; background:#0d0c09; font-family:'Segoe UI',Tahoma,sans-serif; }
    .wrap { max-width: 480px; margin: 0 auto; padding: 64px 24px; text-align:center; }
    h1 { color:#f59e0b; font-size: 22px; margin: 0 0 16px 0; }
    p { color:#e5e1d8; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; }
    a { display:inline-block; background:#f59e0b; color:#0d0c09; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${heading}</h1>
    <p>${body}</p>
    <a href="/athlete/settings?tab=notifications">Open notification settings</a>
  </div>
</body>
</html>`;
};

/**
 * GET /api/recap/unsubscribe?aid=&t=
 *
 * One-click unsubscribe — flips both `weeklyRecapEmail` and
 * `weeklyRecapInApp` to false. Token is HMAC-bound to athleteId; the link
 * carries no auth beyond that, by design (RFC 2369 list-unsubscribe).
 *
 * Also handles POST so List-Unsubscribe-Post=One-Click works for Gmail
 * and Outlook one-click controls.
 */
export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      aid: url.searchParams.get("aid"),
      t: url.searchParams.get("t"),
    });
    if (!parsed.success) {
      return new NextResponse(ConfirmationHtml("invalid"), {
        status: 400,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    const { aid, t } = parsed.data;
    if (!verifyUnsubscribeToken(aid, t)) {
      return new NextResponse(ConfirmationHtml("invalid"), {
        status: 401,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    await updatePushPreferences(aid, {
      weeklyRecapEmail: false,
      weeklyRecapInApp: false,
    });

    return new NextResponse(ConfirmationHtml("ok"), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    logger.error("recap unsubscribe failed", { context: "api", metadata: { error: String(err) } });
    return new NextResponse(ConfirmationHtml("invalid"), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
}
