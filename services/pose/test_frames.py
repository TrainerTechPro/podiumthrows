"""Pins probe() returning DISPLAY dimensions (shipped 2026-06-10): portrait
phone clips carry a rotation display matrix; ffmpeg rotates extracted frames
but the coded width/height ffprobe reports is unrotated. The mismatch put
keypoints in portrait space against a landscape resolution and the overlay
skeleton rendered quarter-scale in a corner.

Run: python -m pytest test_frames.py  (needs ffmpeg/ffprobe on PATH)
"""

import shutil
import subprocess

import pytest

from frames import extract_frames, probe

pytestmark = pytest.mark.skipif(
    not (shutil.which("ffmpeg") and shutil.which("ffprobe")),
    reason="ffmpeg/ffprobe not on PATH",
)


def make_clip(tmp_path, rotation):
    plain = tmp_path / "plain.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
         "testsrc=size=640x360:rate=30", "-t", "0.2",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", str(plain)],
        check=True,
    )
    if rotation == 0:
        return str(plain)
    rotated = tmp_path / f"rot{rotation}.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-display_rotation", str(rotation),
         "-i", str(plain), "-c", "copy", str(rotated)],
        check=True,
    )
    return str(rotated)


def test_unrotated_clip_keeps_coded_dimensions(tmp_path):
    meta = probe(make_clip(tmp_path, 0))
    assert (meta["width"], meta["height"]) == (640, 360)


@pytest.mark.parametrize("rotation", [90, -90])
def test_rotated_clip_reports_display_dimensions(tmp_path, rotation):
    clip = make_clip(tmp_path, rotation)
    meta = probe(clip)
    assert (meta["width"], meta["height"]) == (360, 640)


def test_probe_matches_extracted_frame_dimensions(tmp_path):
    """The invariant that actually matters: probe() == extracted frame size."""
    clip = make_clip(tmp_path, -90)
    meta = probe(clip)
    frames = extract_frames(clip, str(tmp_path / "frames"))
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "stream=width,height",
         "-of", "csv=p=0", frames[0]],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    w, h = (int(v) for v in out.split(",")[:2])
    assert (meta["width"], meta["height"]) == (w, h)
