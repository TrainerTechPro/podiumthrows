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
  // WHOOP integration fields
  hrvMs: z.number().optional(),
  restingHR: z.number().optional(),
  spo2: z.number().optional(),
  whoopStrain: z.number().optional(),
  source: z.enum(["MANUAL", "WHOOP_AUTO", "WHOOP_ASSISTED"]).optional(),
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
