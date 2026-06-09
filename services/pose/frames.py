"""ffmpeg/ffprobe frame extraction at native fps (PRD F3)."""

import json
import subprocess
from pathlib import Path


def probe(clip_path: str) -> dict:
    """Return {fps, width, height, nb_frames, duration} from the video stream."""
    out = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=r_frame_rate,width,height,nb_frames,duration",
            "-of", "json", clip_path,
        ],
        capture_output=True, text=True, check=True,
    ).stdout
    stream = json.loads(out)["streams"][0]
    num, _, den = str(stream["r_frame_rate"]).partition("/")
    fps = float(num) / float(den or 1)
    return {
        "fps": fps,
        "width": int(stream["width"]),
        "height": int(stream["height"]),
        "nb_frames": int(stream.get("nb_frames") or 0),
        "duration": float(stream.get("duration") or 0),
    }


def extract_frames(clip_path: str, out_dir: str) -> list:
    """Extract every frame at native fps as JPEG. Returns ordered paths."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error", "-i", clip_path,
            "-qscale:v", "2", "-start_number", "0",
            str(out / "frame_%06d.jpg"),
        ],
        check=True,
    )
    return sorted(str(p) for p in out.glob("frame_*.jpg"))
