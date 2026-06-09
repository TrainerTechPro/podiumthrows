"""Signed webhook back to /api/analysis/webhooks/pose.

Signature: hex(HMAC-SHA256(secret, raw_body)) in the X-Pose-Signature header.
Mirrors src/app/api/analysis/webhooks/pose/route.ts verification exactly.
"""

import hashlib
import hmac
import json
import time
import urllib.request


def sign(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def post_webhook(url: str, secret: str, payload: dict, attempts: int = 3) -> int:
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    last_err = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(
                url,
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Pose-Signature": sign(secret, body),
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.status
        except Exception as err:  # noqa: BLE001 — retried, then raised
            last_err = err
            time.sleep(2 ** attempt)
    raise RuntimeError(f"webhook failed after {attempts} attempts: {last_err}")
