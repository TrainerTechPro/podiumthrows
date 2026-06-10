import { COCO17_KEYPOINTS } from "@/lib/contracts";
import { cloneTracks, type Tracks } from "./tracks";

/**
 * F4 step 2 — left/right identity enforcement: the signature rotational
 * failure is the pose model swapping limb identities mid-turn. For each L/R
 * pair, frame by frame, if assigning the detected points to the OPPOSITE
 * identities is closer to where each limb was last seen, swap them back.
 *
 * Deterministic trajectory-continuity check; corrects only when both sides
 * are present (a lone point carries no pair-identity evidence).
 */

type KpName = (typeof COCO17_KEYPOINTS)[number];

const PAIRS: Array<[KpName, KpName]> = [
  ["left_eye", "right_eye"],
  ["left_ear", "right_ear"],
  ["left_shoulder", "right_shoulder"],
  ["left_elbow", "right_elbow"],
  ["left_wrist", "right_wrist"],
  ["left_hip", "right_hip"],
  ["left_knee", "right_knee"],
  ["left_ankle", "right_ankle"],
];

const IDX = new Map(COCO17_KEYPOINTS.map((n, i) => [n, i]));

function d2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export interface LrResult {
  tracks: Tracks;
  swappedFrames: number[];
}

export function enforceLeftRight(tracks: Tracks): LrResult {
  const out = cloneTracks(tracks);
  const swapped = new Set<number>();

  for (const [leftName, rightName] of PAIRS) {
    const li = IDX.get(leftName)!;
    const ri = IDX.get(rightName)!;
    const left = out.points[li];
    const right = out.points[ri];

    let prevL: { x: number; y: number } | null = null;
    let prevR: { x: number; y: number } | null = null;

    for (let f = 0; f < out.frameCount; f++) {
      const l = left[f];
      const r = right[f];
      if (l && r && prevL && prevR) {
        const keep = d2(l, prevL) + d2(r, prevR);
        const swap = d2(l, prevR) + d2(r, prevL);
        if (swap < keep) {
          left[f] = r;
          right[f] = l;
          swapped.add(f);
        }
      }
      if (left[f]) prevL = { x: left[f]!.x, y: left[f]!.y };
      if (right[f]) prevR = { x: right[f]!.x, y: right[f]!.y };
    }
  }

  return { tracks: out, swappedFrames: [...swapped].sort((a, b) => a - b) };
}
