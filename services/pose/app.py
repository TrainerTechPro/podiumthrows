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

import hmac
import json
import os
import time
import urllib.request

import modal
from fastapi import Header, HTTPException

app = modal.App("podium-pose")

# ORT dlopens libcublasLt/libcudnn at session creation; the pip nvidia-* wheels
# live outside the default loader path, so without this the CUDA EP fails to
# load and ORT silently falls back to CPU on a billed T4 (shipped 2026-06-10).
_NVIDIA_WHEEL_LIBS = ":".join(
    f"/usr/local/lib/python3.11/site-packages/nvidia/{pkg}/lib"
    for pkg in ("cublas", "cudnn", "cuda_runtime", "cufft", "curand", "cuda_nvrtc")
)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libgl1", "libglib2.0-0")
    .pip_install(
        "rtmlib==0.0.13",
        # CUDA 12 build (PyPI default from 1.19) — matches the nvidia-*-cu12
        # wheels torch 2.4.0 pulls in. 1.18.x on PyPI is a CUDA 11 build and
        # needs libcublasLt.so.11, which nothing in this image provides.
        "onnxruntime-gpu==1.19.2",
        "opencv-python-headless==4.10.0.84",
        "numpy<2",
        # vitpose-l backend (flag-switched; both stay benchmarkable)
        "torch==2.4.0",
        "transformers==4.46.2",
        "pillow",
        "fastapi[standard]",
    )
    .env({"LD_LIBRARY_PATH": _NVIDIA_WHEEL_LIBS})
    .add_local_dir(".", remote_path="/root/pose_src")
)

with image.imports():
    import sys

    sys.path.insert(0, "/root/pose_src")


def process(payload: dict, authorization: str = Header(default="")):
    # `payload` must stay the ONLY body param: a second one would make
    # FastAPI embed both ({"payload": ...}) and break the flat contract
    # in the module docstring. Auth comes from the real HTTP header.
    expected = os.environ.get("MODAL_POSE_TOKEN", "")
    if not expected or not hmac.compare_digest(authorization, f"Bearer {expected}"):
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
        print(
            f"[pose] job={job_id} model={backend.model_id} "
            f"activeProviders={backend.active_providers}"
        )
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


# Registered as a plain call (not stacked decorators) so the handler above
# stays importable by test_contract.py — the signature IS the wire contract.
web_process = app.function(
    image=image,
    gpu="T4",
    timeout=600,
    secrets=[modal.Secret.from_name("pose-service")],
)(modal.fastapi_endpoint(method="POST")(process))
