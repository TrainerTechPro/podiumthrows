import { cloneTracks, type Tracks } from "./tracks";

/**
 * F4 step 4 — per-landmark OneEuro smoothing (Casiez et al. 2012).
 * Parameters are exported so golden-set tuning (PRD: "tuned so release-frame
 * dynamics aren't smeared") changes one place; Savitzky-Golay remains the
 * comparison baseline in the eval harness, not in production.
 *
 * Filter state resets across null gaps longer than the interpolation window —
 * smoothing must never bridge data that interpolation refused to invent.
 */

export interface OneEuroParams {
  minCutoff: number; // Hz — lower = more smoothing at rest
  beta: number; // speed coefficient — higher = less lag at speed
  dCutoff: number; // derivative low-pass cutoff, Hz
}

export const DEFAULT_ONE_EURO: OneEuroParams = {
  minCutoff: 1.7,
  beta: 0.3,
  dCutoff: 1.0,
};

function smoothingFactor(cutoff: number, dt: number): number {
  const r = 2 * Math.PI * cutoff * dt;
  return r / (r + 1);
}

class OneEuro1D {
  private xPrev: number | null = null;
  private dxPrev = 0;

  constructor(
    private readonly params: OneEuroParams,
    private readonly dt: number
  ) {}

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
  }

  next(x: number): number {
    if (this.xPrev === null) {
      this.xPrev = x;
      this.dxPrev = 0;
      return x;
    }
    const dxRaw = (x - this.xPrev) / this.dt;
    const aD = smoothingFactor(this.params.dCutoff, this.dt);
    const dx = aD * dxRaw + (1 - aD) * this.dxPrev;
    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(dx);
    const a = smoothingFactor(cutoff, this.dt);
    const filtered = a * x + (1 - a) * this.xPrev;
    this.xPrev = filtered;
    this.dxPrev = dx;
    return filtered;
  }
}

export function smoothOneEuro(
  tracks: Tracks,
  params: OneEuroParams = DEFAULT_ONE_EURO
): Tracks {
  const out = cloneTracks(tracks);
  const dt = 1 / out.fps;

  for (const track of out.points) {
    const fx = new OneEuro1D(params, dt);
    const fy = new OneEuro1D(params, dt);
    for (let f = 0; f < track.length; f++) {
      const p = track[f];
      if (!p) {
        fx.reset();
        fy.reset();
        continue;
      }
      track[f] = { x: fx.next(p.x), y: fy.next(p.y), conf: p.conf };
    }
  }

  return out;
}
