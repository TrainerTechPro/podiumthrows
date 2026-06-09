"""Shared clip → PoseOutput pipeline used by both the Modal app and local_run.

Output validates src/lib/contracts/pose.ts (PoseOutputSchema) byte-for-byte:
frames[] { idx, t, bbox, keypoints[17] { x, y, conf } } + model id/version,
fps, resolution.
"""

import tempfile

from frames import probe, extract_frames
from models import AmbiguousDetection

POSE_SCHEMA_VERSION = "1.0"


def run_pipeline(clip_path: str, job_id: str, backend) -> dict:
    import cv2  # noqa: PLC0415

    meta = probe(clip_path)
    with tempfile.TemporaryDirectory() as tmp:
        frame_paths = extract_frames(clip_path, tmp)
        frames = []
        ambiguous_frames = 0
        for idx, path in enumerate(frame_paths):
            image = cv2.imread(path)
            if image is None:
                frames.append({"idx": idx, "t": idx / meta["fps"], "bbox": None, "keypoints": None})
                continue
            try:
                bbox, kps = backend.infer_frame(image)
            except AmbiguousDetection:
                ambiguous_frames += 1
                bbox, kps = None, None
            frames.append(
                {
                    "idx": idx,
                    "t": idx / meta["fps"],
                    "bbox": bbox,
                    "keypoints": kps,
                }
            )

    # PRD Non-Goal: multi-person clips are rejected, not half-analyzed.
    if frame_paths and ambiguous_frames / len(frame_paths) > 0.20:
        raise AmbiguousDetection()

    return {
        "schemaVersion": POSE_SCHEMA_VERSION,
        "jobId": job_id,
        "modelId": backend.model_id,
        "modelVersion": backend.model_version,
        "fps": meta["fps"],
        "resolution": {"width": meta["width"], "height": meta["height"]},
        "frames": frames,
    }
