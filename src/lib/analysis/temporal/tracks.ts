import { COCO17_KEYPOINTS, type PoseOutput } from "@/lib/contracts";

/**
 * Working representation for the temporal layer (F4): one track per landmark,
 * one slot per frame. null = untrusted/missing — downstream NEVER invents a
 * position for a null except explicit gap interpolation.
 */

export type TrackPoint = { x: number; y: number; conf: number } | null;

export interface Tracks {
  fps: number;
  frameCount: number;
  /** [keypointIndex][frameIndex] */
  points: TrackPoint[][];
}

export function tracksFromPose(pose: PoseOutput): Tracks {
  const frameCount = pose.frames.length;
  const points: TrackPoint[][] = COCO17_KEYPOINTS.map(() =>
    new Array<TrackPoint>(frameCount).fill(null)
  );
  pose.frames.forEach((frame, fi) => {
    if (!frame.keypoints) return;
    frame.keypoints.forEach((kp, ki) => {
      points[ki][fi] = { x: kp.x, y: kp.y, conf: kp.conf };
    });
  });
  return { fps: pose.fps, frameCount, points };
}

export function cloneTracks(tracks: Tracks): Tracks {
  return {
    ...tracks,
    points: tracks.points.map((track) => track.map((p) => (p ? { ...p } : null))),
  };
}
