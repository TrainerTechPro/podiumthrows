import { z } from "zod";
import { NextResponse } from "next/server";

// ── Auth Schemas ────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
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
  password: z.string().min(8, "Password must be at least 8 characters"),
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
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
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
  source: z.enum(["MANUAL", "WHOOP_AUTO", "WHOOP_ASSISTED", "OURA_AUTO", "OURA_ASSISTED"]).optional(),
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
});

export const CompetitionUpdateSchema = z.object({
  id: z.string().min(1, "Competition ID is required"),
  result: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  resultBy: z.string().nullable().optional(),
});

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
  quizResponses: z.object({
    adaptationSpeed: z.array(z.record(z.string(), z.number())).optional(),
    transferType: z.array(z.record(z.string(), z.number())).optional(),
    selfFeeling: z.array(z.record(z.string(), z.number())).optional(),
    lightImpl: z.array(z.record(z.string(), z.number())).optional(),
    recovery: z.array(z.record(z.string(), z.number())).optional(),
  }).refine(
    (v) => Object.values(v).some(Boolean),
    "At least one quiz response is required"
  ),
});

// ── Coach Add Athlete ───────────────────────────────────────────────────

export const CoachAddAthleteSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
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

export const LogSessionSchema = z.object({
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

// ── Coach Teams ─────────────────────────────────────────────────────────

export const TeamCreateSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  description: z.string().optional(),
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
  blockType: z.string().min(1),
  position: z.number().int().min(0).optional(),
  config: z.unknown(),
});

export const ThrowsSessionCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sessionType: z.string().min(1, "Session type is required"),
  event: z.string().min(1, "Event is required"),
  targetPhase: z.string().optional().nullable(),
  estimatedDuration: z.number().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  notes: z.string().optional().nullable(),
  blocks: z.array(ThrowsBlockSchema).optional(),
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const fieldErrors = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "_body",
      message: issue.message,
    }));
    return NextResponse.json({ error: "Validation failed", fieldErrors }, { status: 400 });
  }

  return result.data;
}
