import { describe, it, expect } from "vitest";
import {
  CoachAssessmentCreateSchema,
  CoachAssignSessionsSchema,
  CoachDrillCreateSchema,
  CoachDrillUpdateSchema,
  CoachGoalCreateSchema,
  CoachFrameAnnotationSchema,
  CoachFrameAnnotationsBatchSchema,
  CoachNotificationToggleSchema,
  CoachNotificationsBulkSchema,
  CoachVideoCreateSchema,
  CoachVideoShareSchema,
  CoachVideoStatusPatchSchema,
  CoachVideoTranscodeCompleteSchema,
  CoachVideoUpdateSchema,
  CoachVideoUploadUrlSchema,
  NotificationPreferencesPatchSchema,
  PushSendSchema,
  SelfProgramUpdateSchema,
  TeamActivityReactionSchema,
} from "@/lib/api-schemas";

/**
 * Smoke tests for the schemas introduced during the HIGH-03 envelope
 * migration. Each route that switched from raw `request.json()` to
 * `parseBody(req, Schema)` is represented here so a future schema
 * regression (e.g. dropping a `.nullable().optional()`) fails locally
 * before reaching production. Per CLAUDE.md §4, every form-fed field
 * must tolerate `null`.
 */

describe("envelope migration schemas — happy paths", () => {
  it("PushSendSchema accepts a minimal cron payload", () => {
    const result = PushSendSchema.safeParse({
      userId: "user_1",
      preferenceKey: "coachFeedback",
      payload: { title: "Hi", body: "There" },
    });
    expect(result.success).toBe(true);
  });

  it("CoachGoalCreateSchema parses a typical coach goal (requires athleteId)", () => {
    const ok = CoachGoalCreateSchema.safeParse({
      athleteId: "ath_1",
      title: "Hit 20m in Shot Put",
      targetValue: 20,
      unit: "m",
      startingValue: 17.5,
      deadline: "2026-06-01",
      event: "SHOT_PUT",
      description: null,
    });
    expect(ok.success).toBe(true);

    const missingAthlete = CoachGoalCreateSchema.safeParse({
      title: "x",
      targetValue: 1,
      unit: "m",
    });
    expect(missingAthlete.success).toBe(false);
  });

  it("CoachAssignSessionsSchema requires at least one athlete", () => {
    const ok = CoachAssignSessionsSchema.safeParse({
      planId: "plan_1",
      athleteIds: ["a1", "a2"],
      scheduledDate: "2026-06-01",
      coachNotes: null,
    });
    expect(ok.success).toBe(true);

    const empty = CoachAssignSessionsSchema.safeParse({
      planId: "plan_1",
      athleteIds: [],
      scheduledDate: "2026-06-01",
    });
    expect(empty.success).toBe(false);
  });

  it("CoachAssessmentCreateSchema validates athlete type enum", () => {
    const ok = CoachAssessmentCreateSchema.safeParse({
      athleteId: "ath_1",
      athleteType: "EXPLOSIVE",
      results: { strength: 1, speed: 2 },
    });
    expect(ok.success).toBe(true);

    const bad = CoachAssessmentCreateSchema.safeParse({
      athleteId: "ath_1",
      athleteType: "ROCKET",
      results: {},
    });
    expect(bad.success).toBe(false);
  });

  it("CoachDrillCreateSchema accepts numeric-string implementKg (form coerces)", () => {
    const result = CoachDrillCreateSchema.safeParse({
      name: "Hammer pulls",
      category: "GPE",
      implementKg: "16",
      cues: null,
      athleteTypes: null,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.implementKg).toBe(16);
  });

  it("CoachDrillUpdateSchema requires at least one field", () => {
    const ok = CoachDrillUpdateSchema.safeParse({ difficulty: "advanced" });
    expect(ok.success).toBe(true);

    const empty = CoachDrillUpdateSchema.safeParse({});
    expect(empty.success).toBe(false);
  });

  it("CoachVideoCreateSchema tolerates null on form-fed fields", () => {
    const result = CoachVideoCreateSchema.safeParse({
      url: "https://cdn.example/v.mp4",
      title: "Throw 1",
      storageKey: null,
      description: null,
      event: null,
      athleteId: null,
      category: null,
      tags: null,
      durationSec: null,
      fileSizeMb: null,
      thumbnailUrl: null,
      status: null,
    });
    expect(result.success).toBe(true);
  });

  it("CoachVideoUpdateSchema requires at least one field", () => {
    const empty = CoachVideoUpdateSchema.safeParse({});
    expect(empty.success).toBe(false);
    const ok = CoachVideoUpdateSchema.safeParse({ title: "Updated" });
    expect(ok.success).toBe(true);
  });

  it("CoachVideoStatusPatchSchema rejects unknown transitions", () => {
    expect(CoachVideoStatusPatchSchema.safeParse({ status: "ready" }).success).toBe(true);
    expect(CoachVideoStatusPatchSchema.safeParse({ status: "exploded" }).success).toBe(false);
  });

  it("CoachVideoTranscodeCompleteSchema accepts the failed path", () => {
    const failed = CoachVideoTranscodeCompleteSchema.safeParse({
      success: false,
      error: "ffmpeg exit 1",
    });
    expect(failed.success).toBe(true);
  });

  it("CoachVideoShareSchema rejects empty arrays", () => {
    expect(CoachVideoShareSchema.safeParse({ athleteIds: [] }).success).toBe(false);
    expect(CoachVideoShareSchema.safeParse({ athleteIds: ["a1"] }).success).toBe(true);
  });

  it("CoachVideoUploadUrlSchema requires fileName + contentType", () => {
    expect(
      CoachVideoUploadUrlSchema.safeParse({ fileName: "clip.mp4", contentType: "video/mp4" })
        .success
    ).toBe(true);
    expect(CoachVideoUploadUrlSchema.safeParse({ fileName: "clip.mp4" }).success).toBe(false);
  });

  it("CoachFrameAnnotationSchema rejects negative timestamps", () => {
    expect(
      CoachFrameAnnotationSchema.safeParse({ timestamp: 0, payload: { keypoints: [] } }).success
    ).toBe(true);
    expect(CoachFrameAnnotationSchema.safeParse({ timestamp: -1, payload: {} }).success).toBe(
      false
    );
  });

  it("CoachFrameAnnotationsBatchSchema rejects empty arrays", () => {
    expect(CoachFrameAnnotationsBatchSchema.safeParse({ frameAnnotations: [] }).success).toBe(
      false
    );
    expect(
      CoachFrameAnnotationsBatchSchema.safeParse({
        frameAnnotations: [{ timestamp: 0.5, payload: { keypoints: [] } }],
      }).success
    ).toBe(true);
  });

  it("CoachNotificationsBulkSchema accepts markAll or ids", () => {
    expect(CoachNotificationsBulkSchema.safeParse({ markAll: true }).success).toBe(true);
    expect(CoachNotificationsBulkSchema.safeParse({ ids: ["n1", "n2"], read: false }).success).toBe(
      true
    );
  });

  it("CoachNotificationToggleSchema accepts an empty body (toggle)", () => {
    expect(CoachNotificationToggleSchema.safeParse({}).success).toBe(true);
    expect(CoachNotificationToggleSchema.safeParse({ read: true }).success).toBe(true);
  });

  it("NotificationPreferencesPatchSchema accepts partial nested updates", () => {
    expect(
      NotificationPreferencesPatchSchema.safeParse({
        feedPrivacy: { sharePRs: false },
      }).success
    ).toBe(true);
    expect(
      NotificationPreferencesPatchSchema.safeParse({ haptics: { enabled: true } }).success
    ).toBe(true);
  });

  it("TeamActivityReactionSchema enforces emoji enum", () => {
    expect(TeamActivityReactionSchema.safeParse({ emoji: "fire" }).success).toBe(true);
    expect(TeamActivityReactionSchema.safeParse({ emoji: "skull" }).success).toBe(false);
  });

  it("SelfProgramUpdateSchema only enforces object shape", () => {
    expect(
      SelfProgramUpdateSchema.safeParse({
        daysPerWeek: 4,
        preferredDays: ["Mon", "Tue", "Wed", "Thu"],
      }).success
    ).toBe(true);
    expect(SelfProgramUpdateSchema.safeParse("nope").success).toBe(false);
  });
});

/**
 * Final API contract purity pass — schemas added when the last batch of
 * `request.json()` routes was migrated to `parseBody(req, Schema)`.
 */

import {
  AdminUpgradeSchema,
  AthleteDashboardConfigPatchSchema,
  CoachEventGroupAddMembersSchema,
  CoachEventGroupUpdateSchema,
  LiftingProgramPatchSchema,
  LiftingWorkoutPatchSchema,
  SessionRecapWellnessSchema,
  ThrowsTestingRecordCreateSchema,
  VideoAnalysisPatchSchema,
  VideoAnnotationsBulkUpdateSchema,
  WearableSyncBodySchema,
} from "@/lib/api-schemas";

describe("final purity pass schemas — happy + edge", () => {
  it("WearableSyncBodySchema accepts undefined/null body (normal sync)", () => {
    expect(WearableSyncBodySchema.safeParse(undefined).success).toBe(true);
    expect(WearableSyncBodySchema.safeParse(null).success).toBe(true);
    expect(WearableSyncBodySchema.safeParse({}).success).toBe(true);
  });

  it("WearableSyncBodySchema accepts updateSyncMode enum + rejects others", () => {
    expect(WearableSyncBodySchema.safeParse({ updateSyncMode: "AUTO" }).success).toBe(true);
    expect(WearableSyncBodySchema.safeParse({ updateSyncMode: "ASSISTED" }).success).toBe(true);
    expect(WearableSyncBodySchema.safeParse({ updateSyncMode: "OFF" }).success).toBe(false);
  });

  it("AthleteDashboardConfigPatchSchema requires preset OR (widgets+order)", () => {
    expect(AthleteDashboardConfigPatchSchema.safeParse({ preset: "minimal" }).success).toBe(true);
    expect(
      AthleteDashboardConfigPatchSchema.safeParse({ widgets: ["a"], order: ["a"] }).success
    ).toBe(true);
    expect(AthleteDashboardConfigPatchSchema.safeParse({}).success).toBe(false);
    expect(AthleteDashboardConfigPatchSchema.safeParse({ widgets: ["a"] }).success).toBe(false);
  });

  it("CoachEventGroupAddMembersSchema rejects empty array", () => {
    expect(CoachEventGroupAddMembersSchema.safeParse({ athleteIds: [] }).success).toBe(false);
    expect(CoachEventGroupAddMembersSchema.safeParse({ athleteIds: ["a"] }).success).toBe(true);
  });

  it("CoachEventGroupUpdateSchema enforces event enum + tolerates nullable fields", () => {
    expect(
      CoachEventGroupUpdateSchema.safeParse({ events: ["SHOT_PUT"], name: null }).success
    ).toBe(true);
    expect(CoachEventGroupUpdateSchema.safeParse({ events: ["X"] }).success).toBe(false);
    expect(CoachEventGroupUpdateSchema.safeParse({ events: [] }).success).toBe(false);
  });

  it("LiftingProgramPatchSchema rejects empty patch", () => {
    expect(LiftingProgramPatchSchema.safeParse({}).success).toBe(false);
    expect(LiftingProgramPatchSchema.safeParse({ status: "ACTIVE" }).success).toBe(true);
    expect(LiftingProgramPatchSchema.safeParse({ status: "WHAT" }).success).toBe(false);
  });

  it("LiftingWorkoutPatchSchema accepts status + null fields + optional exerciseLogs", () => {
    expect(LiftingWorkoutPatchSchema.safeParse({}).success).toBe(true);
    expect(
      LiftingWorkoutPatchSchema.safeParse({
        status: "COMPLETED",
        actualRpe: null,
        exerciseLogs: [],
      }).success
    ).toBe(true);
    expect(LiftingWorkoutPatchSchema.safeParse({ status: "DONE" }).success).toBe(false);
  });

  it("ThrowsTestingRecordCreateSchema requires testDate + defaults testType", () => {
    const ok = ThrowsTestingRecordCreateSchema.parse({ testDate: "2026-05-18" });
    expect(ok.testType).toBe("FULL_BATTERY");
    expect(ThrowsTestingRecordCreateSchema.safeParse({}).success).toBe(false);
  });

  it("AdminUpgradeSchema requires valid email", () => {
    expect(AdminUpgradeSchema.safeParse({ email: "x@y.com", plan: "PRO" }).success).toBe(true);
    expect(AdminUpgradeSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(AdminUpgradeSchema.safeParse({ email: "x@y.com", plan: "ALPHA" }).success).toBe(false);
  });

  it("SessionRecapWellnessSchema accepts only 1/2/3 for each field", () => {
    expect(SessionRecapWellnessSchema.safeParse({ legs: 1, energy: 2, focus: 3 }).success).toBe(
      true
    );
    expect(SessionRecapWellnessSchema.safeParse({ legs: 0, energy: 2, focus: 3 }).success).toBe(
      false
    );
    expect(SessionRecapWellnessSchema.safeParse({ legs: 1, energy: 2 }).success).toBe(false);
  });

  it("VideoAnalysisPatchSchema is .strict — rejects unknown keys", () => {
    expect(VideoAnalysisPatchSchema.safeParse({ title: "ok" }).success).toBe(true);
    expect(VideoAnalysisPatchSchema.safeParse({ title: "ok", garbage: 1 }).success).toBe(false);
  });

  it("VideoAnnotationsBulkUpdateSchema requires id + valid type + points", () => {
    expect(
      VideoAnnotationsBulkUpdateSchema.safeParse({
        annotations: [{ id: "a1", timestamp: 0, type: "line", points: [{ x: 0, y: 0 }] }],
      }).success
    ).toBe(true);
    expect(
      VideoAnnotationsBulkUpdateSchema.safeParse({
        annotations: [{ id: "a1", timestamp: -1, type: "line", points: [] }],
      }).success
    ).toBe(false);
    expect(
      VideoAnnotationsBulkUpdateSchema.safeParse({
        annotations: [{ id: "a1", timestamp: 0, type: "spline", points: [] }],
      }).success
    ).toBe(false);
  });
});
