import { z } from "zod";
import { NextResponse } from "next/server";
import { validateImplementSequence } from "@/lib/bondarchuk/sequencing";
import { validateBlockOrder, type SessionBlockType } from "@/lib/bondarchuk/block-order";

const SessionBlockTypeEnum = z.enum([
  "THROWING",
  "STRENGTH",
  "WARMUP",
  "COOLDOWN",
  "PLYOMETRIC",
  "NOTES",
  "MOBILITY",
  "RECOVERY",
  "CONDITIONING",
]) satisfies z.ZodType<SessionBlockType>;

// ── Auth Schemas ────────────────────────────────────────────────────────

// Password must be at least 8 characters with at least one uppercase and one digit
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/\d/, "Password must contain at least one digit");

// Login uses a relaxed password check — don't reject existing passwords that were set before complexity rules
const loginPasswordSchema = z.string().min(1, "Password is required");

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: loginPasswordSchema,
});

export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["COACH", "ATHLETE"], {
    message: "Role must be COACH or ATHLETE",
  }),
  inviteToken: z.string().optional(),
  leadId: z.string().optional(),
  plan: z.string().optional(),
  interval: z.string().optional(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordSchema,
});

// ── MFA Schemas ────────────────────────────────────────────────────────

export const MfaVerifySetupSchema = z.object({
  token: z
    .string()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Code must be 6 digits"),
  encryptedSecret: z.string().min(1, "Secret is required"),
});

export const MfaVerifySchema = z.object({
  mfaSessionToken: z.string().min(1, "MFA session token is required"),
  token: z
    .string()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const MfaDisableSchema = z.object({
  password: z.string().min(1, "Password is required"),
  token: z
    .string()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const MfaBackupSchema = z.object({
  mfaSessionToken: z.string().min(1, "MFA session token is required"),
  code: z.string().min(1, "Backup code is required"),
});

// ── Profile Schemas ─────────────────────────────────────────────────────

export const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const CoachProfileUpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  bio: z.string().optional(),
  organization: z.string().optional(),
});

// ── Lead Capture ────────────────────────────────────────────────────────

export const LeadCaptureSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().optional().nullable(),
  source: z.string().optional(),
  event: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  deficitResult: z.record(z.string(), z.unknown()).optional().nullable(),
  utmSource: z.string().optional().nullable(),
  utmMedium: z.string().optional().nullable(),
  utmCampaign: z.string().optional().nullable(),
});

// ── Voice Notes ─────────────────────────────────────────────────────────

export const VoiceNoteCreateSchema = z.object({
  audioData: z
    .string()
    .min(1, "Audio data is required")
    .max(5 * 1024 * 1024, "Audio data exceeds 5MB limit"),
  duration: z.number({ message: "Duration is required" }),
  sessionId: z.string().optional().nullable(),
  transcription: z.string().optional().nullable(),
});

// ── Throws Assignments ──────────────────────────────────────────────────

export const ThrowsAssignmentCreateSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  athleteIds: z.array(z.string()).min(1, "At least one athlete is required"),
  assignedDate: z.string().min(1, "Assigned date is required"),
  // Coach-acknowledged override for athletes whose Bondarchuk assessment is
  // >90 days stale. Required when any target athlete is in the `expired` tier;
  // ignored otherwise. Never valid for `never`-tier athletes (no assessment).
  overrideAssessment: z.boolean().optional().default(false),
  overrideReason: z.string().max(500).nullable().optional(),
});

// Assignment PUT: discriminated union on `action`. Each variant declares its
// own field shape; downstream handler code uses `"rpe" in parsed` guards to
// preserve existing post-completion logic (streak updates, notifications).
const completionFields = {
  rpe: z.number().min(1).max(10).nullable().optional(),
  selfFeeling: z.string().nullable().optional(),
  feedbackNotes: z.string().nullable().optional(),
} as const;

export const ThrowsAssignmentUpdateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("complete"), ...completionFields }),
  z.object({ action: z.literal("partial"), ...completionFields }),
  z.object({
    action: z.literal("skip"),
    skipReason: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("update_blocks"),
    completedBlockIds: z.array(z.string()).min(0),
  }),
]);

// ── Questionnaire Submission ────────────────────────────────────────────

export const QuestionnaireSubmissionSchema = z.object({
  answers: z.unknown().refine((v) => v !== undefined && v !== null, "Answers are required"),
  durationSeconds: z.number().optional().nullable(),
});

// ── Readiness Check-In ─────────────────────────────────────────────────

export const ReadinessCheckInSchema = z.object({
  sleepQuality: z.number().min(1, "Must be at least 1").max(10, "Must be at most 10"),
  sleepHours: z.number().min(1, "Must be at least 1").max(24, "Must be at most 24"),
  soreness: z.number().min(1, "Must be at least 1").max(10, "Must be at most 10"),
  sorenessArea: z.string().nullable().optional(),
  stressLevel: z.number().min(1, "Must be at least 1").max(10, "Must be at most 10"),
  energyMood: z.number().min(1, "Must be at least 1").max(10, "Must be at most 10"),
  hydration: z.enum(["POOR", "ADEQUATE", "GOOD"], {
    message: "Must be POOR, ADEQUATE, or GOOD",
  }),
  injuryStatus: z.enum(["NONE", "MONITORING", "ACTIVE"]).catch("NONE"),
  injuryNotes: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Wearable integration fields
  hrvMs: z.number().optional(),
  restingHR: z.number().optional(),
  spo2: z.number().optional(),
  whoopStrain: z.number().optional(),
  ouraReadiness: z.number().optional(),
  ouraActivityScore: z.number().optional(),
  ouraSleepScore: z.number().optional(),
  temperatureDeviation: z.number().optional(),
  source: z
    .enum(["MANUAL", "WHOOP_AUTO", "WHOOP_ASSISTED", "OURA_AUTO", "OURA_ASSISTED"])
    .optional(),
});

// ── Athlete Schemas (for future use) ────────────────────────────────────

export const AthleteCreateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  events: z.array(z.string()),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  dateOfBirth: z.string().optional(),
  heightCm: z.number().optional(),
  weightKg: z.number().optional(),
});

export const AthleteUpdateSchema = AthleteCreateSchema.partial();

// ── Competition ─────────────────────────────────────────────────────────

export const CompetitionCreateSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
  name: z.string().min(1, "Competition name is required"),
  date: z.string().min(1, "Date is required"),
  event: z.string().min(1, "Event is required"),
  priority: z.enum(["A", "B", "C"]).optional(),
  result: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),

  // v2 per-meet context (all nullable + optional per project rule #4)
  implementWeightKg: z.number().positive().nullable().optional(),
  placeFinish: z.number().int().min(1).nullable().optional(),
  meetStatus: z.enum(["COMPLETED", "DNS", "DNF", "DQ"]).nullable().optional(),
  venueType: z.enum(["INDOOR", "OUTDOOR"]).nullable().optional(),
  weather: z.string().max(200).nullable().optional(),
  windMps: z.number().nullable().optional(), // allow negative for headwind
  format: z.enum(["THREE_PLUS_THREE", "FOUR_STRAIGHT"]).nullable().optional(),
  madeFinals: z.boolean().nullable().optional(),
});

export const CompetitionUpdateSchema = z.object({
  id: z.string().min(1, "Competition ID is required"),

  // legacy editable fields
  result: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  resultBy: z.string().nullable().optional(),

  // v2 per-meet context
  name: z.string().min(1).nullable().optional(),
  date: z.string().min(1).nullable().optional(),
  priority: z.enum(["A", "B", "C"]).nullable().optional(),
  implementWeightKg: z.number().positive().nullable().optional(),
  placeFinish: z.number().int().min(1).nullable().optional(),
  meetStatus: z.enum(["COMPLETED", "DNS", "DNF", "DQ"]).nullable().optional(),
  venueType: z.enum(["INDOOR", "OUTDOOR"]).nullable().optional(),
  weather: z.string().max(200).nullable().optional(),
  windMps: z.number().nullable().optional(),
  format: z.enum(["THREE_PLUS_THREE", "FOUR_STRAIGHT"]).nullable().optional(),
  madeFinals: z.boolean().nullable().optional(),
});

// ── Competition Throws (v2) ─────────────────────────────────────────────

const ThrowResultSchema = z.discriminatedUnion("resultType", [
  z.object({ resultType: z.literal("MARK"), distance: z.number().positive() }),
  z.object({ resultType: z.literal("FOUL"), foulType: z.enum(["RING", "SECTOR"]) }),
  z.object({ resultType: z.literal("PASS") }),
]);

const ThrowSlotSchema = z.object({
  round: z.enum(["PRELIM", "FINALS"]),
  attemptInRound: z.number().int().min(1).max(4),
});

const ThrowOptionalsSchema = z.object({
  videoUrl: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  wireLength: z.enum(["FULL", "THREE_QUARTER", "HALF"]).nullable().optional(),
});

export const CompetitionThrowCreateSchema = z.intersection(
  ThrowSlotSchema,
  z.intersection(ThrowResultSchema, ThrowOptionalsSchema)
);

export const CompetitionThrowUpdateSchema = z.intersection(
  ThrowSlotSchema.partial(),
  z.intersection(ThrowResultSchema, ThrowOptionalsSchema.partial())
);

// ── Legacy promotion ────────────────────────────────────────────────────
// POST body is empty — the competition ID comes from the URL.
export const LegacyPromoteSchema = z.object({});

// ── Athlete Throws Session ──────────────────────────────────────────────

const DrillLogSchema = z.object({
  drillType: z.string().min(1),
  implementWeight: z.number().nullable().optional(),
  implementWeightUnit: z.string().nullable().optional(),
  implementWeightOriginal: z.number().nullable().optional(),
  wireLength: z.string().nullable().optional(),
  throwCount: z.number().int().min(0).nullable().optional(),
  bestMark: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const AthleteThrowsSessionCreateSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
  event: z.string().min(1, "Event is required"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().nullable().optional(),
  drillLogs: z.array(DrillLogSchema).optional(),
});

// ── Throws Check-In ─────────────────────────────────────────────────────

// NOTE: numeric fields below come from React form state (sliders/number inputs
// in the throws check-in wizards). Per CLAUDE.md Rule 4, form-originated
// numerics must be `.nullable().optional()` — `.optional()` alone accepts
// undefined but rejects null, which silently breaks saves when form state uses
// `useState<number | null>(null)` for cleared fields. `selfFeeling` stays
// required; `notes` is already nullable; `source` is a string enum, not a
// numeric form field.
export const ThrowsCheckInSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
  date: z.string().min(1, "Date is required"),
  selfFeeling: z.number().min(1).max(10),
  sleepHours: z.number().min(0).max(24).nullable().optional(),
  sleepQuality: z.number().min(1).max(10).nullable().optional(),
  energy: z.number().min(1).max(10).nullable().optional(),
  sorenessGeneral: z.number().min(1).max(10).nullable().optional(),
  sorenessShoulder: z.number().min(0).max(10).nullable().optional(),
  sorenessBack: z.number().min(0).max(10).nullable().optional(),
  sorenessHip: z.number().min(0).max(10).nullable().optional(),
  sorenessKnee: z.number().min(0).max(10).nullable().optional(),
  sorenessElbow: z.number().min(0).max(10).nullable().optional(),
  sorenessWrist: z.number().min(0).max(10).nullable().optional(),
  lightImplFeeling: z.number().min(1).max(10).nullable().optional(),
  heavyImplFeeling: z.number().min(1).max(10).nullable().optional(),
  notes: z.string().nullable().optional(),
  source: z.enum(["ATHLETE", "COACH"]).optional(),
});

// ── Bondarchuk Typing ───────────────────────────────────────────────────

export const TypingSubmitSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
  quizResponses: z
    .object({
      adaptationSpeed: z.array(z.record(z.string(), z.number())).optional(),
      transferType: z.array(z.record(z.string(), z.number())).optional(),
      selfFeeling: z.array(z.record(z.string(), z.number())).optional(),
      lightImpl: z.array(z.record(z.string(), z.number())).optional(),
      recovery: z.array(z.record(z.string(), z.number())).optional(),
    })
    .refine((v) => Object.values(v).some(Boolean), "At least one quiz response is required"),
});

// ── Coach Add Athlete ───────────────────────────────────────────────────

export const CoachAddAthleteSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).default("OTHER"),
  events: z
    .array(z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]))
    .min(1, "At least one event is required"),
});

// ── Lifting Program ─────────────────────────────────────────────────────

const LiftingPhaseSchema = z.object({
  name: z.string().min(1),
  weeks: z.number().int().min(1),
  exercises: z.array(z.unknown()).optional(),
});

export const LiftingProgramCreateSchema = z.object({
  name: z.string().min(1, "Program name is required"),
  goals: z.string().optional(),
  workoutsPerWeek: z.number().int().min(1, "Must have at least 1 workout per week"),
  totalWeeks: z.number().int().min(1, "Must have at least 1 week"),
  rpeTargets: z.unknown().optional(),
  startDate: z.string().optional(),
  phases: z.array(LiftingPhaseSchema).min(1, "At least one phase is required"),
});

export const LiftingWorkoutCreateSchema = z.object({
  programId: z.string().min(1, "Program ID is required"),
  weekNumber: z.number().int().min(1, "Week number must be positive"),
  workoutNumber: z.number().int().min(1, "Workout number must be positive"),
  date: z.string().min(1, "Date is required"),
});

// ── Log Session (athlete + coach) ────────────────────────────────────

const LogSessionDrillSchema = z.object({
  drillType: z.string().min(1),
  implementWeight: z.number().nullable().optional(),
  implementWeightUnit: z.string().nullable().optional(),
  implementWeightOriginal: z.number().nullable().optional(),
  wireLength: z.string().nullable().optional(),
  throwCount: z.number().int().min(0).nullable().optional(),
  bestMark: z.number().nullable().optional(),
  averageMark: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  marks: z.array(z.number()).optional(),
});

export const LogSessionSchema = z
  .object({
    event: z.string().min(1, "Event is required"),
    date: z.string().min(1, "Date is required"),
    focus: z.string().optional(),
    notes: z.string().optional(),
    sleepQuality: z.number().min(1).max(10).nullable().optional(),
    sorenessLevel: z.number().min(1).max(10).nullable().optional(),
    energyLevel: z.number().min(1).max(10).nullable().optional(),
    sessionRpe: z.number().min(1).max(10).nullable().optional(),
    sessionFeeling: z.string().optional(),
    techniqueRating: z.number().min(1).max(10).nullable().optional(),
    mentalFocus: z.number().min(1).max(10).nullable().optional(),
    bestPart: z.string().optional(),
    improvementArea: z.string().optional(),
    drills: z.array(LogSessionDrillSchema),
  })
  .superRefine((data, ctx) => {
    // Bondarchuk Rule 1: Implement weights within a session must descend.
    // Vol IV p.114-117: ascending order causes 2-4m performance decrease.
    const result = validateImplementSequence(
      data.drills.map((d, i) => ({
        implementWeightKg: d.implementWeight ?? null,
        orderIndex: i,
      }))
    );
    if (!result.ok) {
      const drill = data.drills[result.offendingIndex];
      const name = drill?.drillType ? ` (${drill.drillType})` : "";
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["drills", result.offendingIndex, "implementWeight"],
        message: `Bondarchuk sequencing violation${name}: ${result.violation}`,
      });
    }
  });

// ── Practice Session ────────────────────────────────────────────────────

export const PracticeSessionCreateSchema = z.object({
  name: z.string().min(1, "Session name is required"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().nullable().optional(),
});

// ── Exercise Complex ────────────────────────────────────────────────────

export const ComplexCreateSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
  startDate: z.string().min(1, "Start date is required"),
  exercises: z.array(z.unknown()).min(1, "At least one exercise is required"),
  event: z.string().min(1, "Event is required"),
});

// ── Athlete Bio ─────────────────────────────────────────────────────────

export const AthleteBioUpdateSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  sport: z.string().optional(),
  height: z.union([z.number(), z.string()]).nullable().optional(),
  weight: z.union([z.number(), z.string()]).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
});

// ── Coach Teams / Roster Groups ─────────────────────────────────────────────

export const TeamCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(100)
    .transform((s) => s.trim()),
  description: z.string().max(500).nullable().optional(),
  parentTeamId: z.string().cuid().nullable().optional(),
  order: z.number().int().min(0).nullable().optional(),
});

export const TeamUpdateSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .transform((s) => s.trim())
    .optional(),
  description: z.string().max(500).nullable().optional(),
  parentTeamId: z.string().cuid().nullable().optional(),
  order: z.number().int().min(0).nullable().optional(),
});

export const TeamAddMembersSchema = z.object({
  athleteIds: z.array(z.string().cuid()).min(1).max(100),
});

// ── Event Groups ────────────────────────────────────────────────────────

export const EventGroupCreateSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  events: z.array(z.string()).min(1, "At least one event is required"),
  color: z.string().optional(),
  description: z.string().optional(),
});

// ── Typing Assign ───────────────────────────────────────────────────────

export const TypingAssignSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
});

// ── Throws Session ──────────────────────────────────────────────────────

const ThrowsBlockSchema = z.object({
  blockType: SessionBlockTypeEnum,
  position: z.number().int().min(0).optional(),
  config: z.unknown(),
});

export const ThrowsSessionCreateSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    sessionType: z.string().min(1, "Session type is required"),
    event: z.string().min(1, "Event is required"),
    targetPhase: z.string().optional().nullable(),
    estimatedDuration: z.number().optional().nullable(),
    tags: z.array(z.string()).optional().nullable(),
    notes: z.string().optional().nullable(),
    blocks: z.array(ThrowsBlockSchema).optional(),
  })
  .superRefine((data, ctx) => {
    // Bondarchuk Vol IV p.113: no two adjacent THROWING blocks. A strength
    // block (or any non-throwing separator) must come between throws.
    if (!data.blocks || data.blocks.length === 0) return;
    const result = validateBlockOrder(
      data.blocks.map((b, i) => ({
        type: b.blockType,
        order: b.position ?? i,
      }))
    );
    if (!result.ok) {
      // offendingIndex is the block's `order` value; find the array index
      // so the client's per-field error UI highlights the right row.
      const arrayIndex = data.blocks.findIndex(
        (b, i) => (b.position ?? i) === result.offendingIndex
      );
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blocks", arrayIndex < 0 ? 0 : arrayIndex, "blockType"],
        message: `Bondarchuk ordering violation: ${result.violation}`,
      });
    }
  });

// ── Throws Roster / Practice Schemas ────────────────────────────────────

export const PodiumRosterEnrollSchema = z
  .object({
    athleteId: z.string().min(1, "Athlete ID is required"),
    events: z.array(z.string()).optional(),
    event: z.string().optional(),
    gender: z.string().min(1, "Gender is required"),
    competitionPb: z.number().nullable().optional(),
  })
  .refine((d) => (d.events && d.events.length > 0) || d.event, {
    message: "At least one event is required",
    path: ["events"],
  });

export const PodiumRosterPatchSchema = z.object({
  status: z.string().optional(),
  event: z.string().optional(),
  competitionPb: z.number().nullable().optional(),
  heavyImplementPr: z.number().nullable().optional(),
  heavyImplementKg: z.number().nullable().optional(),
  lightImplementPr: z.number().nullable().optional(),
  lightImplementKg: z.number().nullable().optional(),
  strengthBenchmarks: z.unknown().nullable().optional(),
  adaptationProfile: z.string().nullable().optional(),
  sessionsToForm: z.number().nullable().optional(),
  recommendedMethod: z.string().nullable().optional(),
  coachNotes: z.string().nullable().optional(),
});

export const PracticeSessionPatchSchema = z.object({
  status: z.string().optional(),
  name: z.string().optional(),
  notes: z.string().nullable().optional(),
});

export const PracticeAttemptCreateSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
  event: z.string().min(1, "Event is required"),
  implement: z.string().min(1, "Implement is required"),
  distance: z.number().nullable().optional(),
  drillType: z.string().nullable().optional(),
  coachNote: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  attemptNumber: z.number().nullable().optional(),
});

export const CoachAthleteSessionCreateSchema = z.object({
  event: z.string().min(1, "Event is required"),
  date: z.string().min(1, "Date is required"),
  drillLogs: z
    .array(
      z.object({
        drillType: z.string(),
        implementWeight: z.number().optional(),
        throwCount: z.number().optional(),
        bestMark: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .min(1, "At least one drill log is required"),
});

// ── Exercise Library ────────────────────────────────────────────────────

export const ExerciseLibraryPatchSchema = z.object({
  videoUrl: z.string().url().nullable().optional(),
  videoEmbed: z.string().max(2000).nullable().optional(),
  tips: z.string().max(5000).nullable().optional(),
});

// ── Register Claim ─────────────────────────────────────────────────────

export const RegisterClaimSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  events: z.array(z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"])).optional(),
});

// ── ThrowFlow Analysis ────────────────────────────────────────────────

export const ThrowFlowAnalysisSchema = z.object({
  event: z.string().min(1, "Event is required"),
  drillType: z.string().min(1, "Drill type is required"),
  cameraAngle: z.string().min(1, "Camera angle is required"),
  athleteId: z.string().optional().nullable(),
  athleteHeight: z.number().optional().nullable(),
  implementWeight: z.number().optional().nullable(),
  knownDistance: z.number().optional().nullable(),
  frames: z.array(z.string()).optional(),
  keyFrames: z
    .array(z.string())
    .min(1, "At least one key frame is required")
    .max(20, "Maximum 20 key frames"),
  keyFrameIndices: z.array(z.number()).optional(),
  totalFrames: z.number().optional(),
  videoDuration: z.number().optional().nullable(),
});

// ── Throws Block Logs ──────────────────────────────────────────────────

export const ThrowsBlockLogCreateSchema = z.object({
  assignmentId: z.string().min(1, "Assignment ID is required"),
  blockId: z.string().min(1, "Block ID is required"),
  throws: z
    .array(
      z.object({
        throwNumber: z.number().int().min(1),
        distance: z.number().nullable(),
        implement: z.string().min(1, "Implement is required"),
        notes: z.string().optional().nullable(),
      })
    )
    .min(1, "At least one throw is required"),
});

// ── Throws PRs ─────────────────────────────────────────────────────────

export const ThrowsPrCheckSchema = z.object({
  event: z.string().min(1, "Event is required"),
  implement: z.string().min(1, "Implement is required"),
  distance: z.number().positive("Distance must be positive"),
  source: z.string().optional(),
  athleteId: z.string().optional().nullable(),
});

// ── Drill PRs ──────────────────────────────────────────────────────────

export const DrillPrCreateSchema = z.object({
  event: z.string().min(1, "Event is required"),
  drillType: z.string().min(1, "Drill type is required"),
  implement: z.string().min(1, "Implement is required"),
  distance: z.number().min(0, "Distance cannot be negative"),
  athleteId: z.string().optional().nullable(),
  achievedAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ── Program Session Schemas ────────────────────────────────────────────

export const ProgramPatchSchema = z.object({
  status: z.string().optional(),
  daysPerWeek: z.number().int().min(1).max(7).optional(),
  sessionsPerDay: z.number().int().min(1).max(3).optional(),
  includeLift: z.boolean().optional(),
});

const LiftInputSchema = z.object({
  exerciseName: z.string().min(1, "Exercise name is required"),
  sets: z.number().int().nullable().optional(),
  reps: z.number().int().nullable().optional(),
  weight: z.number().nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const ProgramLiftsSchema = z.object({
  lifts: z.array(LiftInputSchema).min(1, "At least one lift is required"),
});

export const ProgramSessionCompleteSchema = z.object({
  actualThrows: z.number().int().nullable().optional(),
  selfFeeling: z.string().nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  bestMark: z.number().nullable().optional(),
  sessionNotes: z.string().nullable().optional(),
  wasModified: z.boolean().optional(),
  actualPrescription: z.unknown().optional(),
  modificationNotes: z.string().nullable().optional(),
});

const BestMarkInputSchema = z.object({
  implement: z.string().min(1, "Implement is required"),
  distance: z.number().positive("Distance must be positive"),
  drillType: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const ProgramBestMarksSchema = z
  .object({
    marks: z.array(BestMarkInputSchema).min(1, "At least one mark is required"),
  })
  .or(BestMarkInputSchema); // Accepts single mark or { marks: [...] }

export const ProgramAlternateSchema = z
  .object({
    actualPrescription: z.unknown().optional(),
    modificationNotes: z.string().nullable().optional(),
  })
  .refine(
    (d) =>
      d.actualPrescription !== undefined ||
      (d.modificationNotes != null && d.modificationNotes.length > 0),
    "Provide at least actualPrescription or modificationNotes"
  );

// ── Testing / Benchmarks ──────────────────────────────────────────────

export const TestingBenchmarksPatchSchema = z.object({
  athleteId: z.string().optional().nullable(),
  benchmarks: z.record(z.string(), z.number().nullable().optional()),
});

// ── Equipment Inventory ───────────────────────────────────────────────

export const EquipmentInventorySchema = z.object({
  implements: z.array(z.unknown()).min(0),
  hasCage: z.boolean().optional(),
  hasRing: z.boolean().optional(),
  hasFieldAccess: z.boolean().optional(),
  hasGym: z.boolean().optional(),
  gymEquipment: z.array(z.string()).optional(),
});

// ── Coach Preferences ─────────────────────────────────────────────────

export const CoachPreferencesPatchSchema = z.object({
  globalDefaultPage: z.string().optional(),
  workspaceDefaults: z.record(z.string(), z.string()).optional(),
  dashboardLayout: z
    .object({
      widgets: z.array(
        z.object({
          id: z.string(),
          visible: z.boolean(),
          order: z.number(),
        })
      ),
    })
    .optional(),
  myTraining: z
    .object({
      mode: z.enum(["competitive", "recreational"]).optional(),
      primaryEvent: z.string().optional(),
      gender: z.enum(["male", "female"]).optional(),
    })
    .optional(),
  lastTeamId: z.string().nullable().optional(),
});

// ── Questionnaire Update ──────────────────────────────────────────────

export const QuestionnaireUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  blocks: z.unknown().optional(),
  questions: z.unknown().optional(),
  displayMode: z.string().optional(),
  welcomeScreen: z.unknown().nullable().optional(),
  thankYouScreen: z.unknown().nullable().optional(),
  conditionalLogic: z.unknown().nullable().optional(),
  scoringEnabled: z.boolean().optional(),
  scoringRules: z.unknown().nullable().optional(),
  allowAnonymous: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
});

// ── Questionnaire Schedule ────────────────────────────────────────────

export const QuestionnaireScheduleSchema = z.object({
  frequency: z.string().min(1, "Frequency is required"),
  specificDays: z.array(z.number()).optional(),
  timeOfDay: z.string().optional(),
  athleteIds: z.array(z.string()).optional(),
  groupIds: z.array(z.string()).optional(),
  assignToAll: z.boolean().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

// ── Typing Override (coach manual classification) ──────────────────────

export const TypingOverrideSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
  adaptationGroup: z
    .union([z.number().int().min(1).max(4), z.string()])
    .optional()
    .nullable(),
  transferType: z.string().optional().nullable(),
  selfFeelingAccuracy: z.string().optional().nullable(),
  lightImplResponse: z.string().optional().nullable(),
  recoveryProfile: z.string().optional().nullable(),
});

// ─── COACH PROXY PROFILE SCHEMAS ────────────────────────────────────────────

export const CoachLogThrowSchema = z.object({
  event: z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]),
  implementWeight: z.number().positive("Implement weight must be positive"),
  implementWeightUnit: z.enum(["kg", "lbs"]).default("kg"),
  implementWeightOriginal: z.number().positive().nullable().optional(),
  distance: z.number().positive("Distance must be positive").nullable().optional(),
  isCompetition: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  videoUrl: z.string().url("Invalid video URL").nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  wireLength: z.enum(["FULL", "THREE_QUARTER", "HALF"]).nullable().optional(),
});

export const CoachNoteSchema = z.object({
  content: z.string().min(1, "Note content is required").max(5000, "Note content is too long"),
  category: z.enum(["TECHNICAL", "MENTAL", "INJURY", "GENERAL"]).default("GENERAL"),
  isPrivate: z.boolean().default(false),
});

export const CoachNoteUpdateSchema = z.object({
  content: z
    .string()
    .min(1, "Note content is required")
    .max(5000, "Note content is too long")
    .optional(),
  category: z.enum(["TECHNICAL", "MENTAL", "INJURY", "GENERAL"]).optional(),
  isPrivate: z.boolean().optional(),
});

export const CoachEditProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  events: z
    .array(z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]))
    .min(1)
    .optional(),
  dateOfBirth: z
    .string()
    .datetime({ message: "Date of birth must be a valid ISO datetime" })
    .nullable()
    .optional(),
  heightCm: z.number().min(100).max(250).nullable().optional(),
  weightKg: z.number().min(30).max(200).nullable().optional(),
  classStanding: z.string().nullable().optional(),
  gradYear: z
    .number()
    .int()
    .min(1950, "Grad year too early")
    .max(2050, "Grad year too late")
    .nullable()
    .optional(),
  turnDirection: z.enum(["LEFT", "RIGHT"]).nullable().optional(),
  strengthNumbers: z.record(z.string(), z.number().nullable()).nullable().optional(),
  technicalProfile: z.record(z.string(), z.unknown()).nullable().optional(),
  injuryHistory: z.record(z.string(), z.unknown()).nullable().optional(),
  movementRestrictions: z.record(z.string(), z.unknown()).nullable().optional(),
  competitionPRs: z.record(z.string(), z.number().nullable()).nullable().optional(),
  implementPRs: z.record(z.string(), z.number().nullable()).nullable().optional(),
});

// ── Session Complete + Log ──────────────────────────────────────────────

export const SessionCompleteSchema = z.object({
  rpe: z.number().min(1).max(10).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const SessionLogSchema = z.object({
  exerciseName: z.string().min(1, "Exercise name is required").max(200),
  sets: z.number().int().min(1, "Sets must be at least 1"),
  reps: z.number().int().min(0).nullable().optional(),
  weight: z.number().min(0).nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  distance: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  // Throw-specific fields
  isThrow: z.boolean().optional(),
  event: z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]).optional(),
  implementKg: z.number().min(0).optional(),
});

// ── Goals ───────────────────────────────────────────────────────────────

export const GoalCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  targetValue: z.number().positive("Target value must be a positive number"),
  unit: z.string().min(1, "Unit is required").max(50),
  startingValue: z.number().nullable().optional(),
  deadline: z.string().nullable().optional(),
  event: z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]).nullable().optional(),
  description: z.string().nullable().optional(),
});

export const GoalUpdateSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    targetValue: z.number().positive().optional(),
    currentValue: z.number().optional(),
    unit: z.string().min(1).max(50).optional(),
    deadline: z.string().nullable().optional(),
    event: z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]).nullable().optional(),
    description: z.string().nullable().optional(),
    status: z.enum(["ACTIVE", "COMPLETED", "ABANDONED"]).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field is required",
  });

// ── Availability ───────────────────────────────────────────────────────

export const AvailabilityBlockSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6, "dayOfWeek must be 0-6 (Sun-Sat)"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  type: z.string().min(1, "type is required").max(50),
  label: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const AvailabilityOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  type: z.string().min(1, "type is required").max(50),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  reason: z.string().max(500).nullable().optional(),
});

// ── Athlete Self-Edit Profile ───────────────────────────────────────────

/**
 * PATCH schema for the athlete self-edit profile endpoint.
 *
 * All fields are optional — only those present in the payload are updated.
 * JSON blobs (competitionGoals, strengthNumbers) are accepted as unknown
 * objects here; deeper per-field validation lives in the tab components
 * and in the data access layer. `.nullable().optional()` covers the React
 * form pattern where unset values arrive as null.
 */
export const AthleteProfileSelfPatchSchema = z.object({
  firstName: z.string().min(1, "First name cannot be empty").max(100).optional(),
  lastName: z.string().min(1, "Last name cannot be empty").max(100).optional(),
  events: z.array(z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"])).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: z.string().nullable().optional(),
  heightCm: z.number().min(50).max(260).nullable().optional(),
  weightKg: z.number().min(20).max(300).nullable().optional(),
  turnDirection: z.enum(["LEFT", "RIGHT"]).nullable().optional(),
  classStanding: z.string().nullable().optional(),
  gradYear: z.number().int().min(1950).max(2050).nullable().optional(),
  competitionGoals: z.record(z.string(), z.unknown()).nullable().optional(),
  strengthNumbers: z.record(z.string(), z.unknown()).nullable().optional(),
  competitionPBs: z
    .array(
      z.object({
        event: z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]),
        distance: z.number().nullable().optional(),
      })
    )
    .optional(),
  completeOnboarding: z.boolean().optional(),
});

// ── parseBody Helper ────────────────────────────────────────────────────

/**
 * Parse and validate a request body against a Zod schema.
 * Returns the parsed data on success, or a 400 NextResponse on failure.
 *
 * Usage:
 * ```ts
 * const parsed = await parseBody(request, LoginSchema);
 * if (parsed instanceof NextResponse) return parsed;
 * const { email, password } = parsed;
 * ```
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<T | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const fieldErrors = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "_body",
      message: issue.message,
    }));
    return NextResponse.json(
      { success: false, error: "Validation failed", fieldErrors },
      { status: 400 }
    );
  }

  return result.data;
}

/**
 * Parse and validate URL query parameters against a Zod schema.
 * Returns the parsed data on success, or a 400 NextResponse on failure.
 *
 * Usage:
 * ```ts
 * const parsed = parseQuery(request, HistoryQuerySchema);
 * if (parsed instanceof NextResponse) return parsed;
 * const { range, prOnly } = parsed;
 * ```
 */
export function parseQuery<T>(request: Request, schema: z.ZodType<T>): T | NextResponse {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) {
    raw[k] = v;
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const fieldErrors = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "_query",
      message: issue.message,
    }));
    return NextResponse.json(
      { success: false, error: "Invalid query parameters", fieldErrors },
      { status: 400 }
    );
  }

  return result.data;
}
