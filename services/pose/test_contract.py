"""Wire-contract test for the pose endpoint (run: python -m pytest test_contract.py).

Pins the bug that shipped 2026-06-10: the handler had TWO body-typed params
(payload + request_headers), so FastAPI embedded both and 422'd the flat
{jobId, ...} body the Next.js client sends — and the Authorization HTTP
header was never read at all. The handler signature is the wire contract.
"""

import os

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import process

api = FastAPI()
api.post("/")(process)
client = TestClient(api, raise_server_exceptions=False)

FLAT_BODY = {
    "jobId": "job_test",
    "clipUrl": "https://example.com/clip.mp4",
    "poseUploadUrl": "https://example.com/put",
    "rawPath": "analysis/job_test/pose-raw.json",
    "webhookUrl": "https://example.com/webhook",
}


def test_flat_body_without_token_is_401_not_422(monkeypatch):
    monkeypatch.setenv("MODAL_POSE_TOKEN", "tok")
    res = client.post("/", json=FLAT_BODY)
    assert res.status_code == 401  # body accepted flat; auth is what fails


def test_wrong_bearer_is_401(monkeypatch):
    monkeypatch.setenv("MODAL_POSE_TOKEN", "tok")
    res = client.post("/", json=FLAT_BODY, headers={"Authorization": "Bearer wrong"})
    assert res.status_code == 401


def test_unset_token_fails_closed(monkeypatch):
    monkeypatch.delenv("MODAL_POSE_TOKEN", raising=False)
    res = client.post("/", json=FLAT_BODY, headers={"Authorization": "Bearer "})
    assert res.status_code == 401


def test_valid_bearer_reaches_pipeline(monkeypatch):
    # Correct auth must get PAST the 401 gate. The pipeline then fails on the
    # fake clip URL — anything but 401/422 proves the contract is honored.
    monkeypatch.setenv("MODAL_POSE_TOKEN", "tok")
    monkeypatch.setenv("POSE_WEBHOOK_SECRET", "whsec")
    res = client.post("/", json=FLAT_BODY, headers={"Authorization": "Bearer tok"})
    assert res.status_code not in (401, 422)
