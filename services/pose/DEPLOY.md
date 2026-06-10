# Pose service — deploy runbook

The service is fully scaffolded; deploying requires **your** Modal account and
secrets. Nothing here has been deployed by the build run (no fabricated deploys).

## One-time setup

```bash
pip install modal
modal token new                     # authenticates your Modal account

# Shared secrets: the webhook HMAC key + the bearer token Next.js sends.
# Generate strong values once and reuse them in Vercel env (below).
modal secret create pose-service \
  POSE_WEBHOOK_SECRET="$(openssl rand -hex 32)" \
  MODAL_POSE_TOKEN="$(openssl rand -hex 32)"
```

## Deploy

```bash
cd services/pose
modal deploy app.py
# → prints the web endpoint URL, e.g. https://<user>--podium-pose-process.modal.run
```

## Wire into Vercel

```bash
vercel env add MODAL_POSE_URL        # the endpoint URL from modal deploy
vercel env add MODAL_POSE_TOKEN      # same value as in the Modal secret
vercel env add POSE_WEBHOOK_SECRET   # same value as in the Modal secret
```

For local dev, add the same three keys to `.env.local`.

## Measured performance (T4, fixture clip: 60 frames / 2s @ 720×720)

Benchmark: `modal run bench.py` — reports active ORT providers + wall-clock.

| Image                                  | Active provider | Pipeline | Total (load + pipeline) |
| -------------------------------------- | --------------- | -------- | ----------------------- |
| onnxruntime-gpu 1.18.1 (CUDA 11 build) | CPU (silent fallback) | 22.5s | 29.9s |
| onnxruntime-gpu 1.19.2 (CUDA 12 build) | **CUDA**        | 14.5s    | 22.1s                   |

Measured 2026-06-10. GPU cost at Modal's T4 rate ($0.59/h ≈ $0.000164/s):
~$0.0036/run vs ~$0.0049 on the silent-CPU image — and the CPU fallback is
now impossible: the backend asserts CUDAExecutionProvider is active when
`device="cuda"` and fails the job loudly otherwise (`GpuUnavailable`), with
active providers logged every run.

## Model flag

`POSE_MODEL` env var on the Modal app: `rtmpose-l` (default) or `vitpose-l`.
Benchmark both against the golden set (`scripts/eval/run-benchmark.ts`) before
picking the shipped default — PRD Phase 1 gate.

## Local CPU fallback (no Modal account needed)

```bash
cd services/pose
python3 -m pip install -r requirements-local.txt
python3 local_run.py --clip fixtures/fixture-clip.mp4 --out /tmp/pose.json
# validate against the contract:
cd ../.. && npx tsx scripts/eval/validate-pose-json.ts /tmp/pose.json
```

First run downloads ONNX weights (~250 MB) from the rtmlib release mirror.
