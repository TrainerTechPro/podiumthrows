#!/usr/bin/env bash
# Copies @mediapipe/tasks-vision WASM bundle into public/ so the live
# pose-detection page can load it from the same origin instead of
# cdn.jsdelivr.net (blocked by CSP). Runs as part of postinstall, so
# every fresh `npm install` (local + Vercel cloud build) re-syncs.
#
# Why not just commit public/mediapipe/wasm/? The two .wasm blobs are
# 21MB combined — ballast in git. Pinning the dep version in
# package.json + a postinstall sync gives us the same guarantee
# without the binary in history.
set -euo pipefail

SRC=node_modules/@mediapipe/tasks-vision/wasm
DST=public/mediapipe/wasm

if [[ ! -d "$SRC" ]]; then
  echo "  ⚠ $SRC not found; @mediapipe/tasks-vision must be installed first"
  exit 0
fi

mkdir -p "$DST"
cp "$SRC"/*.js "$SRC"/*.wasm "$DST"/
echo "  ✓ MediaPipe WASM bundle copied to $DST/"
