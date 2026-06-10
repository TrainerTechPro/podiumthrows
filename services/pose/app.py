"""Modal GPU pose service (PRD F3).

Deploy: see DEPLOY.md. Scales to zero; budget ≤ $0.05 / 10s clip, p95 ≤ 90s.

Job flow:
  POST /process  (Bearer MODAL_POSE_TOKEN)
    { jobId, clipUrl, poseUploadUrl, rawPath, webhookUrl }
  → download clip → frames → detect+pose (POSE_MODEL backend)
  → PUT pose JSON to poseUploadUrl (presigned R2; no R2 creds in Modal)
  → POST signed webhook { jobId, status, rawPath, ... } to webhookUrl.

Secrets (modal secret create pose-service ...):
  POSE_WEBHOOK_SECRET — HMAC key shared with the Next.js webhook route
  MODAL_POSE_TOKEN    — bearer token the Next.js trigger sends
"""

import json
import os
import time
import urllib.request

import modal

app = modal.App("podium-pose")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libgl1", "libglib2.0-0")
    .pip_install(
        "rtmlib==0.0.13",
        "onnxruntime-gpu==1.18.1",
        "opencv-python-headless==4.10.0.84",
        "numpy<2",
        # vitpose-l backend (flag-switched; both stay benchmarkable)
        "torch==2.4.0",
        "transformers==4.46.2",
        "pillow",
        "fastapi[standard]",
    )
    .add_local_dir(".", remote_path="/root/pose_src")
)

with image.imports():
    import sys

    sys.path.insert(0, "/root/pose_src")


@app.function(
    image=image,
    gpu="T4",
    timeout=600,
    secrets=[modal.Secret.from_name("pose-service")],
)
@modal.fastapi_endpoint(method="POST")
def process(payload: dict, request_headers: dict | None = None):
    from fastapi import HTTPException  # noqa: PLC0415

    expected = os.environ.get("MODAL_POSE_TOKEN", "")
    auth = (request_headers or {}).get("authorization", "")
    if not expected or auth != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="bad token")

    job_id = payload["jobId"]
    webhook_url = payload["webhookUrl"]
    secret = os.environ["POSE_WEBHOOK_SECRET"]

    sys.path.insert(0, "/root/pose_src")
    from models import AmbiguousDetection, load_backend  # noqa: PLC0415
    from pipeline import run_pipeline  # noqa: PLC0415
    from webhook import post_webhook  # noqa: PLC0415

    timings = {"startedAt": time.time()}
    try:
        clip_path = "/tmp/clip.mp4"
        urllib.request.urlretrieve(payload["clipUrl"], clip_path)
        timings["downloaded"] = time.time() - timings["startedAt"]

        backend = load_backend(device="cuda")
        output = run_pipeline(
            clip_path, job_id, backend,
            trim_start=payload.get("trimStart"), trim_end=payload.get("trimEnd"),
        )
        timings["pose"] = time.time() - timings["startedAt"]

        body = json.dumps(output).encode("utf-8")
        put = urllib.request.Request(
            payload["poseUploadUrl"],
            data=body,
            headers={"Content-Type": "application/json"},
            method="PUT",
        )
        with urllib.request.urlopen(put, timeout=120) as resp:
            if resp.status >= 300:
                raise RuntimeError(f"pose JSON upload failed: {resp.status}")
        timings["uploaded"] = time.time() - timings["startedAt"]

        post_webhook(webhook_url, secret, {
            "jobId": job_id,
            "status": "pose_complete",
            "rawPath": payload["rawPath"],
            "modelId": output["modelId"],
            "modelVersion": output["modelVersion"],
            "fpsTrue": output["fps"],
            "timings": {k: round(v, 3) for k, v in timings.items() if k != "startedAt"},
        })
        return {"ok": True}
    except AmbiguousDetection:
        post_webhook(webhook_url, secret, {
            "jobId": job_id,
            "status": "failed",
            "error": {"code": "MULTI_PERSON", "message": "Multiple comparable people detected; one athlete per clip."},
        })
        return {"ok": False, "reason": "MULTI_PERSON"}
    except Exception as err:  # noqa: BLE001 — reported via webhook, never swallowed
        post_webhook(webhook_url, secret, {
            "jobId": job_id,
            "status": "failed",
            "error": {"code": "POSE_PIPELINE_ERROR", "message": str(err)[:500]},
        })
        raise
