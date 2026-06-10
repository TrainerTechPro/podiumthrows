"""T4 benchmark for the pose pipeline on the bundled fixture clip.

Usage: cd services/pose && modal run bench.py

Reuses the EXACT production image from app.py and reports the active ONNX
Runtime providers plus wall-clock per stage, so a CPU fallback on a billed
GPU (the bug that shipped 2026-06-10) is visible, not silent.
"""

import sys
import time

import modal

# Locally app.py sits beside this file; in the Modal container the source
# tree is mounted at /root/pose_src and is NOT on sys.path when the runner
# re-imports bench.py.
sys.path.insert(0, "/root/pose_src")
from app import app, image  # noqa: E402


def _session_providers(backend) -> dict:
    """Active ORT providers per inner session (det + pose)."""
    found = {}
    body = getattr(backend, "body", None)
    if body is None:
        return found
    for name in ("det_model", "pose_model"):
        session = getattr(getattr(body, name, None), "session", None)
        if session is not None:
            found[name] = session.get_providers()
    return found


@app.function(image=image, gpu="T4", timeout=900, secrets=[modal.Secret.from_name("pose-service")])
def bench() -> dict:
    import sys

    sys.path.insert(0, "/root/pose_src")
    import onnxruntime as ort  # noqa: PLC0415
    from models import load_backend  # noqa: PLC0415
    from pipeline import run_pipeline  # noqa: PLC0415

    t0 = time.time()
    backend = load_backend(device="cuda")
    load_s = time.time() - t0

    t1 = time.time()
    output = run_pipeline("/root/pose_src/fixtures/fixture-clip.mp4", "bench", backend)
    infer_s = time.time() - t1

    return {
        "onnxruntime": ort.__version__,
        "availableProviders": ort.get_available_providers(),
        "activeProviders": _session_providers(backend),
        "frames": len(output["frames"]),
        "fps": output["fps"],
        "resolution": output["resolution"],
        "modelLoadS": round(load_s, 2),
        "pipelineS": round(infer_s, 2),
        "totalS": round(load_s + infer_s, 2),
    }


@app.local_entrypoint()
def main():
    import json

    print(json.dumps(bench.remote(), indent=2))
