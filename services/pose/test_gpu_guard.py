"""Pins the silent-CPU-fallback prohibition (shipped 2026-06-10): a backend
asked for CUDA must raise GpuUnavailable when the CUDA EP is inactive, never
quietly run CPU inference on a billed T4.

Run: python -m pytest test_gpu_guard.py
"""

import pytest

from models import GpuUnavailable, _require_cuda


def test_cuda_device_without_cuda_provider_raises():
    with pytest.raises(GpuUnavailable, match="CUDAExecutionProvider is not active"):
        _require_cuda("cuda", ["CPUExecutionProvider"], "CUDA EP failed to load.")


def test_cuda_device_with_no_sessions_found_fails_closed():
    with pytest.raises(GpuUnavailable):
        _require_cuda("cuda", [], "no sessions introspected")


def test_cuda_device_with_cuda_provider_passes():
    _require_cuda("cuda", ["CUDAExecutionProvider", "CPUExecutionProvider"], "ok")


def test_cpu_device_never_raises():
    _require_cuda("cpu", ["CPUExecutionProvider"], "local run")
