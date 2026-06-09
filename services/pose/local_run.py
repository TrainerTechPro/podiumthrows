"""CPU fallback runner (PRD F3 / build stage 3 external gate).

Runs the same detector+pose pipeline as the Modal app on a short clip, on CPU,
so the contract can be verified without a Modal account.

Usage:
    pip install -r requirements-local.txt
    python3 local_run.py --clip fixtures/fixture-clip.mp4 --out /tmp/pose.json
"""

import argparse
import json
import os
import sys


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--clip", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--job-id", default="local-fixture")
    args = parser.parse_args()

    os.environ.setdefault("POSE_MODEL", "rtmpose-l")
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    from models import load_backend  # noqa: PLC0415
    from pipeline import run_pipeline  # noqa: PLC0415

    backend = load_backend(device="cpu")
    output = run_pipeline(args.clip, args.job_id, backend)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(output, fh)

    detected = sum(1 for f in output["frames"] if f["bbox"] is not None)
    print(
        f"wrote {args.out}: {len(output['frames'])} frames, "
        f"{detected} with detections, model {output['modelId']} {output['modelVersion']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
