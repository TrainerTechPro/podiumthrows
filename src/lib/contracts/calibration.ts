import { z } from "zod";
import { AnalysisEventSchema } from "./metrics";

/**
 * Calibration contracts (PRD F1). The wizard persists
 * { deviceOrientation, ringEllipseScreenCoords, eventType, timestamp };
 * the server computes a ground-plane homography from the imaged ring ellipse
 * + known circle diameter (shot/hammer 2.135 m, discus 2.50 m).
 */

export const RING_DIAMETER_M: Record<string, number> = {
  SHOT_PUT: 2.135,
  HAMMER: 2.135,
  DISCUS: 2.5,
  // Javelin has no circle; runway calibration is out of scope for v1.
};

/** Imaged ring ellipse in screen/pixel coordinates. rotation in radians. */
export const RingEllipseSchema = z.object({
  cx: z.number(),
  cy: z.number(),
  rx: z.number().positive(),
  ry: z.number().positive(),
  rotation: z.number(),
});
export type RingEllipse = z.infer<typeof RingEllipseSchema>;

/** Null when gyro permission was denied — flow degrades, never blocks (F1). */
export const DeviceOrientationSchema = z.object({
  alpha: z.number().nullable(),
  beta: z.number().nullable(),
  gamma: z.number().nullable(),
});
export type DeviceOrientationSample = z.infer<typeof DeviceOrientationSchema>;

export const CalibrationCreateSchema = z.object({
  event: AnalysisEventSchema,
  ringEllipse: RingEllipseSchema,
  deviceOrientation: DeviceOrientationSchema.nullable().optional(),
  calibrationStillPath: z.string().nullable().optional(),
  athleteId: z.string().nullable().optional(),
});
export type CalibrationCreate = z.infer<typeof CalibrationCreateSchema>;

/** Row-major 3×3 ground-plane homography + derived scale. */
export const HomographySchema = z.object({
  matrix: z.array(z.number()).length(9),
  pixelsPerMeter: z.number().positive(),
  /** Fraction of ring diameter; must be < 0.02 to be valid (F1 acceptance). */
  reprojectionError: z.number().nonnegative(),
  ringDiameterM: z.number().positive(),
});
export type Homography = z.infer<typeof HomographySchema>;

export const MAX_REPROJECTION_ERROR = 0.02;
