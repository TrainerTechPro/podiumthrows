import type { Tracks } from "./tracks";

/**
 * Per-frame quality = mean over the 17 landmarks of (present ? conf : 0).
 * Clips with meanQuality below LOW_CONFIDENCE_THRESHOLD park at
 * LOW_CONFIDENCE — flagged "refilm", never analyzed with false confidence (F4).
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

export interface QualityResult {
  perFrame: number[];
  mean: number;
  lowConfidence: boolean;
}

export function computeQuality(
  tracks: Tracks,
  threshold: number = LOW_CONFIDENCE_THRESHOLD
): QualityResult {
  const perFrame: number[] = new Array(tracks.frameCount).fill(0);
  for (let f = 0; f < tracks.frameCount; f++) {
    let sum = 0;
    for (const track of tracks.points) {
      const p = track[f];
      if (p) sum += p.conf;
    }
    perFrame[f] = tracks.points.length > 0 ? sum / tracks.points.length : 0;
  }
  const mean =
    perFrame.length > 0 ? perFrame.reduce((a, b) => a + b, 0) / perFrame.length : 0;
  return { perFrame, mean, lowConfidence: mean < threshold };
}
