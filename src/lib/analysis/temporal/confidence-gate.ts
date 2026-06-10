import { cloneTracks, type Tracks } from "./tracks";

/**
 * F4 step 1 — confidence gating: keypoints below threshold become null,
 * never trusted. Pure; returns a new Tracks.
 */
export const DEFAULT_CONF_THRESHOLD = 0.3;

export function gateByConfidence(
  tracks: Tracks,
  threshold: number = DEFAULT_CONF_THRESHOLD
): Tracks {
  const out = cloneTracks(tracks);
  for (const track of out.points) {
    for (let f = 0; f < track.length; f++) {
      const p = track[f];
      if (p && p.conf < threshold) track[f] = null;
    }
  }
  return out;
}
