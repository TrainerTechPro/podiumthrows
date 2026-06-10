"""Pose backends behind the POSE_MODEL flag (PRD F3).

POSE_MODEL ∈ {"rtmpose-l", "vitpose-l"} — both produce COCO-17 keypoints so the
output contract never changes when the flag flips (Poseidon-class multi-frame
models are the planned v2 swap behind the same interface).

Person selection: largest detection wins; if the second-largest is ≥ 60% of the
winner's area the clip is ambiguous (multi-person) and the frame is rejected —
PRD Non-Goal: "reject clips where detection finds ambiguity".
"""

import os

AMBIGUITY_RATIO = 0.60
MIN_DET_CONF = 0.40


def select_person(detections):
    """detections: list of (bbox_xyxy, score). Returns bbox or raises Ambiguous."""
    boxes = [(b, s) for b, s in detections if s >= MIN_DET_CONF]
    if not boxes:
        return None
    areas = sorted(
        ((max(0, b[2] - b[0]) * max(0, b[3] - b[1]), b) for b, _ in boxes),
        key=lambda t: t[0],
        reverse=True,
    )
    if len(areas) >= 2 and areas[1][0] >= AMBIGUITY_RATIO * areas[0][0]:
        raise AmbiguousDetection()
    return areas[0][1]


class AmbiguousDetection(Exception):
    """Two comparably-sized people in frame — clip must be rejected."""


class GpuUnavailable(RuntimeError):
    """CUDA requested but inference would run on CPU — fail loudly, never bill a GPU for CPU work."""


def _require_cuda(device: str, active_providers: list, detail: str):
    if device.startswith("cuda") and "CUDAExecutionProvider" not in active_providers:
        raise GpuUnavailable(
            f"device={device!r} but CUDAExecutionProvider is not active "
            f"(active: {active_providers or 'none'}). {detail} "
            "Refusing silent CPU fallback on a GPU-configured function."
        )


class RtmposeBackend:
    """rtmlib (ONNX Runtime) — runs on GPU in Modal, CPU locally."""

    model_id = "rtmpose-l"

    # Explicit rtmpose-l checkpoint: mode="performance" silently loads
    # rtmpose-x, which would make the POSE_MODEL flag a lie.
    POSE_CKPT = (
        "https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/"
        "rtmpose-l_simcc-body7_pt-body7_420e-256x192-4dba18fc_20230504.zip"
    )

    def __init__(self, device: str = "cpu"):
        from rtmlib import Body  # noqa: PLC0415 — heavy import deferred

        # Body = YOLOX person detector + RTMPose top-down on crops.
        self.body = Body(
            pose=self.POSE_CKPT,
            pose_input_size=(192, 256),
            backend="onnxruntime",
            device=device,
        )
        try:
            from importlib.metadata import version  # noqa: PLC0415

            rtmlib_version = version("rtmlib")
        except Exception:  # noqa: BLE001
            rtmlib_version = "unknown"
        self.model_version = f"body7-256x192-20230504/rtmlib-{rtmlib_version}"

        # ORT appends a CPU fallback even when only CUDA is requested; the
        # session's OWN provider list is the only truthful signal.
        self.active_providers = sorted({
            provider
            for tool_name in ("det_model", "pose_model")
            for provider in self._tool_providers(tool_name)
        })
        _require_cuda(
            device,
            self.active_providers,
            "The CUDA EP failed to load (check onnxruntime-gpu build vs CUDA libs on LD_LIBRARY_PATH).",
        )

    def _tool_providers(self, tool_name: str) -> list:
        session = getattr(getattr(self.body, tool_name, None), "session", None)
        return session.get_providers() if session is not None else []

    def infer_frame(self, bgr_image):
        """Returns (bbox_xywh | None, keypoints17 | None).

        keypoints17: list of {x, y, conf} in image pixels, COCO-17 order.
        """
        import numpy as np  # noqa: PLC0415

        keypoints, scores = self.body(bgr_image)
        if keypoints is None or len(keypoints) == 0:
            return None, None
        # rtmlib returns one row per detection. Detectors frequently emit
        # duplicate boxes for the SAME person — ambiguity means a comparably
        # sized person somewhere ELSE (low overlap), not a duplicate.
        boxes = []
        extents = []
        for person in keypoints:
            xs, ys = person[:, 0], person[:, 1]
            boxes.append((float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max())))
            extents.append(float((xs.max() - xs.min()) * (ys.max() - ys.min())))
        order = np.argsort(extents)[::-1]
        if len(order) >= 2 and extents[order[1]] >= AMBIGUITY_RATIO * extents[order[0]]:
            a, b = boxes[order[0]], boxes[order[1]]
            ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
            iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
            inter = ix * iy
            union = extents[order[0]] + extents[order[1]] - inter
            iou = inter / union if union > 0 else 0.0
            if iou < 0.5:
                raise AmbiguousDetection()
        best = int(order[0])
        person, person_scores = keypoints[best], scores[best]
        xs, ys = person[:, 0], person[:, 1]
        bbox = [float(xs.min()), float(ys.min()), float(xs.max() - xs.min()), float(ys.max() - ys.min())]
        kps = [
            {"x": float(x), "y": float(y), "conf": max(0.0, min(1.0, float(c)))}
            for (x, y), c in zip(person, person_scores)
        ]
        return bbox, kps


class VitposeBackend:
    """ViTPose-L via HuggingFace transformers (RT-DETR person detector + ViTPose).

    GPU-only in practice; used in Modal for the golden-set benchmark shootout.
    """

    model_id = "vitpose-l"

    def __init__(self, device: str = "cuda"):
        import torch  # noqa: PLC0415
        from transformers import (  # noqa: PLC0415
            AutoProcessor,
            RTDetrForObjectDetection,
            VitPoseForPoseEstimation,
        )

        self.torch = torch
        self.device = device
        self.det_processor = AutoProcessor.from_pretrained("PekingU/rtdetr_r50vd_coco_o365")
        self.detector = RTDetrForObjectDetection.from_pretrained(
            "PekingU/rtdetr_r50vd_coco_o365"
        ).to(device)
        self.pose_processor = AutoProcessor.from_pretrained("usyd-community/vitpose-plus-large")
        self.pose_model = VitPoseForPoseEstimation.from_pretrained(
            "usyd-community/vitpose-plus-large"
        ).to(device)
        self.model_version = "usyd-community/vitpose-plus-large"

        self.active_providers = (
            ["CUDAExecutionProvider"] if torch.cuda.is_available() else ["CPUExecutionProvider"]
        )
        _require_cuda(device, self.active_providers, "torch.cuda.is_available() is False.")

    def infer_frame(self, bgr_image):
        import numpy as np  # noqa: PLC0415
        from PIL import Image  # noqa: PLC0415

        image = Image.fromarray(bgr_image[:, :, ::-1])
        inputs = self.det_processor(images=image, return_tensors="pt").to(self.device)
        with self.torch.no_grad():
            outputs = self.detector(**inputs)
        results = self.det_processor.post_process_object_detection(
            outputs,
            target_sizes=self.torch.tensor([(image.height, image.width)]),
            threshold=MIN_DET_CONF,
        )[0]
        persons = [
            (box.tolist(), float(score))
            for box, score, label in zip(results["boxes"], results["scores"], results["labels"])
            if int(label) == 0  # COCO person
        ]
        box = select_person(persons)
        if box is None:
            return None, None
        x1, y1, x2, y2 = box
        bbox_xywh = [x1, y1, x2 - x1, y2 - y1]
        pose_inputs = self.pose_processor(
            image, boxes=[[bbox_xywh]], return_tensors="pt"
        ).to(self.device)
        with self.torch.no_grad():
            pose_out = self.pose_model(**pose_inputs, dataset_index=self.torch.tensor([0]))
        pose_results = self.pose_processor.post_process_pose_estimation(
            pose_out, boxes=[[bbox_xywh]]
        )[0][0]
        kps = [
            {"x": float(x), "y": float(y), "conf": max(0.0, min(1.0, float(c)))}
            for (x, y), c in zip(pose_results["keypoints"].tolist(), pose_results["scores"].tolist())
        ]
        return [float(v) for v in bbox_xywh], kps


def load_backend(device: str):
    name = os.environ.get("POSE_MODEL", "rtmpose-l")
    if name == "rtmpose-l":
        return RtmposeBackend(device=device)
    if name == "vitpose-l":
        return VitposeBackend(device=device)
    raise ValueError(f"Unknown POSE_MODEL: {name}")
