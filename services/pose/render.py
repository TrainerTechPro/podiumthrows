"""Annotated keyframe renderer (F8 server-side, decisions.md D9).

Given a clip + render spec (frames, skeleton points, angle arcs, callout
text), produces annotated JPEG stills for report embedding. Runs in the same
Modal container (OpenCV available) or locally.

Spec shape (one entry per requested keyframe):
{
  "frame": 45,
  "keypoints": [{"x":..,"y":..,"conf":..} x17],
  "angles": [{"a": 5, "b": 11, "c": 13, "label": "Separation 18°"}],
  "callout": "Early shoulder opening — measured 18° (target 35–45°)"
}
"""

import json
import tempfile
from pathlib import Path

SKELETON_EDGES = [
    (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),
    (5, 11), (6, 12), (11, 12),
    (11, 13), (13, 15), (12, 14), (14, 16),
    (0, 5), (0, 6),
]
MIN_CONF = 0.2
AMBER = (0, 200, 255)  # BGR
WHITE = (255, 255, 255)
INK = (20, 20, 24)


def render_keyframes(clip_path: str, spec: list, out_dir: str) -> list:
    """Returns list of {frame, path} for rendered stills."""
    import cv2  # noqa: PLC0415

    from frames import extract_frames  # noqa: PLC0415

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    results = []
    with tempfile.TemporaryDirectory() as tmp:
        frame_paths = extract_frames(clip_path, tmp)
        for item in spec:
            idx = int(item["frame"])
            if idx < 0 or idx >= len(frame_paths):
                continue
            image = cv2.imread(frame_paths[idx])
            if image is None:
                continue
            kps = item.get("keypoints") or []

            for a, b in SKELETON_EDGES:
                if a >= len(kps) or b >= len(kps):
                    continue
                if kps[a]["conf"] < MIN_CONF or kps[b]["conf"] < MIN_CONF:
                    continue
                cv2.line(
                    image,
                    (int(kps[a]["x"]), int(kps[a]["y"])),
                    (int(kps[b]["x"]), int(kps[b]["y"])),
                    AMBER, 3, cv2.LINE_AA,
                )
            for kp in kps:
                if kp["conf"] < MIN_CONF:
                    continue
                cv2.circle(image, (int(kp["x"]), int(kp["y"])), 5, WHITE, -1, cv2.LINE_AA)

            for arc in item.get("angles", []):
                b = arc["b"]
                if b < len(kps) and kps[b]["conf"] >= MIN_CONF:
                    center = (int(kps[b]["x"]), int(kps[b]["y"]))
                    cv2.circle(image, center, 28, AMBER, 2, cv2.LINE_AA)
                    cv2.putText(
                        image, arc["label"], (center[0] + 34, center[1] - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, AMBER, 2, cv2.LINE_AA,
                    )

            callout = item.get("callout")
            if callout:
                (tw, th), _ = cv2.getTextSize(callout, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)
                cv2.rectangle(image, (16, 16), (16 + tw + 20, 16 + th + 20), INK, -1)
                cv2.putText(
                    image, callout, (26, 16 + th + 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, WHITE, 2, cv2.LINE_AA,
                )

            path = str(out / f"keyframe_{idx:06d}.jpg")
            cv2.imwrite(path, image, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
            results.append({"frame": idx, "path": path})
    return results


if __name__ == "__main__":
    import argparse
    import sys
    import os

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    parser = argparse.ArgumentParser()
    parser.add_argument("--clip", required=True)
    parser.add_argument("--spec", required=True, help="JSON file with keyframe spec list")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    with open(args.spec, encoding="utf-8") as fh:
        spec = json.load(fh)
    rendered = render_keyframes(args.clip, spec, args.out)
    print(json.dumps(rendered))
