import type { FacilityConfig, LiftingPrs, TypingSnapshot } from "@/lib/throws/engine/types";

export const DEFAULT_FACILITIES: FacilityConfig = {
  hasCage: true,
  hasRing: true,
  hasFieldAccess: true,
  hasGym: true,
  gymEquipment: {
    barbell: true,
    squatRack: true,
    platform: true,
    dumbbells: true,
    cables: true,
    medBalls: true,
    boxes: true,
    bands: true,
  },
};

export const DEFAULT_LIFTING_PRS: LiftingPrs = {
  bodyWeightKg: 80,
};

export const DEFAULT_TYPING: TypingSnapshot = {
  adaptationGroup: 2,
  sessionsToForm: 24,
  recommendedMethod: "complex",
  transferType: "balanced",
  selfFeelingAccuracy: "moderate",
  recoveryProfile: "moderate",
};
