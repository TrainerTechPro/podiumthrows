"use client";

import { csrfHeaders } from "@/lib/csrf-client";

/**
 * Client-side mutation helpers.
 *
 * The middleware rejects any same-origin POST/PUT/PATCH/DELETE without the
 * X-CSRF-Token header (double-submit cookie check) — route state-changing
 * requests through these instead of bare fetch() so the header can't be
 * forgotten. Cross-origin requests (e.g. presigned storage PUTs) must NOT
 * use these: the custom header would force a CORS preflight.
 */

export async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: JSON.stringify(body),
  });
  const payload = await res.json();
  return { res, payload };
}

/**
 * Multipart POST. Content-Type is intentionally NOT set — the browser must
 * generate the multipart boundary itself.
 */
export async function postForm(url: string, form: FormData) {
  const res = await fetch(url, {
    method: "POST",
    headers: csrfHeaders(),
    body: form,
  });
  const payload = await res.json();
  return { res, payload };
}
