-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('COACH', 'ATHLETE');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO', 'ELITE');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SHOT_PUT', 'DISCUS', 'HAMMER', 'JAVELIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExerciseCategory" AS ENUM ('CE', 'SDE', 'SPE', 'GPE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "HydrationLevel" AS ENUM ('POOR', 'ADEQUATE', 'GOOD');

-- CreateEnum
CREATE TYPE "InjuryStatus" AS ENUM ('NONE', 'MONITORING', 'ACTIVE');

-- CreateEnum
CREATE TYPE "QuestionnaireType" AS ENUM ('ONBOARDING', 'ASSESSMENT', 'CHECK_IN', 'READINESS', 'COMPETITION', 'INJURY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FormDisplayMode" AS ENUM ('ALL_AT_ONCE', 'ONE_PER_PAGE', 'SECTIONED');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'SPECIFIC_DAYS', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('MANUAL', 'RECURRING');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('PERSONAL_BEST', 'STREAK', 'MILESTONE', 'ASSESSMENT', 'TRAINING');

-- CreateEnum
CREATE TYPE "BondarchukAthleteType" AS ENUM ('EXPLOSIVE', 'SPEED_STRENGTH', 'STRENGTH_SPEED', 'STRENGTH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "bio" TEXT,
    "organization" TEXT,
    "avatarUrl" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "preferences" TEXT DEFAULT '{}',
    "enabledModules" TEXT DEFAULT '["general","throws"]',
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "events" "EventType"[],
    "gender" "Gender" NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "onboardingCompletedAt" TIMESTAMP(3),
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDate" TIMESTAMP(3),
    "performanceBenchmarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "coachId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT,
    "category" "ExerciseCategory" NOT NULL,
    "event" "EventType",
    "implementWeight" DOUBLE PRECISION,
    "equipment" TEXT,
    "defaultSets" INTEGER,
    "defaultReps" TEXT,
    "correlationData" JSONB,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutPlan" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "event" "EventType",
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutBlock" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "blockType" TEXT NOT NULL,
    "restSeconds" INTEGER,
    "notes" TEXT,

    CONSTRAINT "WorkoutBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockExercise" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "sets" INTEGER,
    "reps" TEXT,
    "weight" TEXT,
    "rpe" DOUBLE PRECISION,
    "distance" TEXT,
    "restSeconds" INTEGER,
    "notes" TEXT,
    "implementKg" DOUBLE PRECISION,

    CONSTRAINT "BlockExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "planId" TEXT,
    "athleteId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "coachNotes" TEXT,
    "rpe" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER,
    "weight" DOUBLE PRECISION,
    "rpe" DOUBLE PRECISION,
    "distance" DOUBLE PRECISION,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowLog" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "sessionId" TEXT,
    "event" "EventType" NOT NULL,
    "implementWeight" DOUBLE PRECISION NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPersonalBest" BOOLEAN NOT NULL DEFAULT false,
    "isCompetition" BOOLEAN NOT NULL DEFAULT false,
    "rpe" DOUBLE PRECISION,
    "attemptNumber" INTEGER,
    "notes" TEXT,
    "videoUrl" TEXT,

    CONSTRAINT "ThrowLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BondarchukAssessment" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "athleteType" "BondarchukAthleteType" NOT NULL,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BondarchukAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drill" (
    "id" TEXT NOT NULL,
    "coachId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT,
    "event" "EventType",
    "category" "ExerciseCategory" NOT NULL,
    "implementKg" DOUBLE PRECISION,
    "difficulty" TEXT,
    "cues" TEXT[],
    "athleteTypes" "BondarchukAthleteType"[],
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Drill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessCheckIn" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "sleepQuality" INTEGER NOT NULL,
    "sleepHours" DOUBLE PRECISION NOT NULL,
    "soreness" INTEGER NOT NULL,
    "sorenessArea" TEXT,
    "stressLevel" INTEGER NOT NULL,
    "energyMood" INTEGER NOT NULL,
    "hydration" "HydrationLevel" NOT NULL,
    "injuryStatus" "InjuryStatus" NOT NULL DEFAULT 'NONE',
    "injuryNotes" TEXT,
    "notes" TEXT,

    CONSTRAINT "ReadinessCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Questionnaire" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "QuestionnaireType" NOT NULL,
    "questions" JSONB NOT NULL,
    "blocks" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayMode" "FormDisplayMode" NOT NULL DEFAULT 'ALL_AT_ONCE',
    "welcomeScreen" JSONB,
    "thankYouScreen" JSONB,
    "conditionalLogic" JSONB,
    "scoringEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scoringRules" JSONB,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateName" TEXT,
    "allowAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Questionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireResponse" (
    "id" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "assignmentId" TEXT,
    "scores" JSONB,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "durationSeconds" INTEGER,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionnaireResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireAssignment" (
    "id" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "source" "AssignmentSource" NOT NULL DEFAULT 'MANUAL',
    "scheduleId" TEXT,
    "instanceDate" TIMESTAMP(3),
    "draftAnswers" JSONB,

    CONSTRAINT "QuestionnaireAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringSchedule" (
    "id" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "specificDays" INTEGER[],
    "timeOfDay" TEXT,
    "athleteIds" TEXT[],
    "teamIds" TEXT[],
    "assignToAll" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startingValue" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "event" "EventType",
    "deadline" TIMESTAMP(3),
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "type" "AchievementType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "badgeKey" TEXT,
    "metadata" JSONB,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoUpload" (
    "id" TEXT NOT NULL,
    "coachId" TEXT,
    "athleteId" TEXT,
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "thumbnailUrl" TEXT,
    "title" TEXT,
    "description" TEXT,
    "event" "EventType",
    "status" TEXT NOT NULL DEFAULT 'ready',
    "category" TEXT,
    "tags" TEXT[],
    "annotations" JSONB,
    "durationSec" DOUBLE PRECISION,
    "fileSizeMb" DOUBLE PRECISION,
    "sharedWithAthletes" TEXT[],
    "transcodedUrl" TEXT,
    "transcodedKey" TEXT,
    "transcodeStatus" TEXT DEFAULT 'pending',
    "fps" DOUBLE PRECISION DEFAULT 60,
    "gopInterval" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameAnnotation" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "timestamp" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'mediapipe',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrameAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceNote" (
    "id" TEXT NOT NULL,
    "coachId" TEXT,
    "athleteId" TEXT,
    "sessionId" TEXT,
    "audioData" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "transcription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMeasurement" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "bodyFat" DOUBLE PRECISION,
    "chest" DOUBLE PRECISION,
    "waist" DOUBLE PRECISION,
    "hips" DOUBLE PRECISION,
    "leftArm" DOUBLE PRECISION,
    "rightArm" DOUBLE PRECISION,
    "leftThigh" DOUBLE PRECISION,
    "rightThigh" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Injury" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "injuryDate" TEXT NOT NULL,
    "recoveryDate" TEXT,
    "bodyPart" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "type" TEXT,
    "description" TEXT,
    "treatmentPlan" TEXT,
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Injury_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "assessmentDate" TEXT NOT NULL,
    "acuteLoad" DOUBLE PRECISION NOT NULL,
    "chronicLoad" DOUBLE PRECISION NOT NULL,
    "acwr" DOUBLE PRECISION NOT NULL,
    "ewmaAcute" DOUBLE PRECISION,
    "ewmaChronic" DOUBLE PRECISION,
    "ewmaAcwr" DOUBLE PRECISION,
    "monotony" DOUBLE PRECISION,
    "strain" DOUBLE PRECISION,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "recommendations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobilityAssessment" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "assessmentDate" TEXT NOT NULL,
    "deepSquat" INTEGER,
    "hurdleStep" INTEGER,
    "inlineLunge" INTEGER,
    "shoulderMobility" INTEGER,
    "activeStraightLegRaise" INTEGER,
    "trunkStabilityPushup" INTEGER,
    "rotaryStability" INTEGER,
    "ankleDorsiflexion" DOUBLE PRECISION,
    "hipFlexion" DOUBLE PRECISION,
    "hipExtension" DOUBLE PRECISION,
    "hipInternalRotation" DOUBLE PRECISION,
    "hipExternalRotation" DOUBLE PRECISION,
    "shoulderFlexion" DOUBLE PRECISION,
    "shoulderExtension" DOUBLE PRECISION,
    "thoracicRotation" DOUBLE PRECISION,
    "sitAndReach" DOUBLE PRECISION,
    "thomasTest" TEXT,
    "oberTest" TEXT,
    "hamstringLength" INTEGER,
    "fmsTotal" INTEGER,
    "overallRating" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobilityAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteGoal" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "specific" TEXT NOT NULL,
    "measurable" TEXT NOT NULL,
    "achievable" TEXT NOT NULL,
    "relevant" TEXT NOT NULL,
    "timeBound" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startDate" TEXT,
    "completedDate" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsSession" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "targetPhase" TEXT,
    "event" TEXT NOT NULL,
    "estimatedDuration" INTEGER,
    "tags" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsBlock" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "blockType" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "config" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowsBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsAssignment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "assignedDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rpe" INTEGER,
    "selfFeeling" TEXT,
    "feedbackNotes" TEXT,
    "skipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowsAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsBlockLog" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "throwNumber" INTEGER NOT NULL,
    "distance" DOUBLE PRECISION,
    "implement" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThrowsBlockLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSession" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeAttempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "implement" TEXT NOT NULL,
    "distance" DOUBLE PRECISION,
    "drillType" TEXT,
    "coachNote" TEXT,
    "videoUrl" TEXT,
    "isPR" BOOLEAN NOT NULL DEFAULT false,
    "attemptNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsPR" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "implement" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "achievedAt" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowsPR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsDrillPR" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "drillType" TEXT NOT NULL,
    "implement" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "achievedAt" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowsDrillPR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsCheckIn" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "selfFeeling" INTEGER NOT NULL,
    "sleepHours" DOUBLE PRECISION,
    "sleepQuality" INTEGER,
    "energy" INTEGER,
    "sorenessGeneral" INTEGER,
    "sorenessShoulder" INTEGER,
    "sorenessBack" INTEGER,
    "sorenessHip" INTEGER,
    "sorenessKnee" INTEGER,
    "sorenessElbow" INTEGER,
    "sorenessWrist" INTEGER,
    "lightImplFeeling" INTEGER,
    "heavyImplFeeling" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'ATHLETE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowsCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsTyping" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "quizAdaptationSpeed" TEXT,
    "quizTransferType" TEXT,
    "quizSelfFeeling" TEXT,
    "quizLightImpl" TEXT,
    "quizRecovery" TEXT,
    "adaptationGroup" INTEGER,
    "transferType" TEXT,
    "selfFeelingAccuracy" TEXT,
    "lightImplResponse" TEXT,
    "recoveryProfile" TEXT,
    "recommendedMethod" TEXT,
    "optimalComplexDuration" TEXT,
    "estimatedSessionsToForm" INTEGER,
    "confidenceAdaptation" INTEGER NOT NULL DEFAULT 0,
    "confidenceTransfer" INTEGER NOT NULL DEFAULT 0,
    "confidenceSelfFeeling" INTEGER NOT NULL DEFAULT 0,
    "complexesAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "totalSessionsTracked" INTEGER NOT NULL DEFAULT 0,
    "quizCompletedDate" TEXT,
    "lastRefinedDate" TEXT,
    "typingSource" TEXT NOT NULL DEFAULT 'QUIZ',
    "quizAssignedByCoach" BOOLEAN NOT NULL DEFAULT false,
    "quizAssignedDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowsTyping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsComplex" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "exercises" TEXT NOT NULL,
    "sessionsCount" INTEGER NOT NULL DEFAULT 0,
    "enteredSportsForm" BOOLEAN NOT NULL DEFAULT false,
    "sessionsToForm" INTEGER,
    "peakMark" DOUBLE PRECISION,
    "avgMarkAtForm" DOUBLE PRECISION,
    "oscillationBand" DOUBLE PRECISION,
    "event" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowsComplex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsCompetition" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'B',
    "result" DOUBLE PRECISION,
    "resultBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowsCompetition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteThrowsSession" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteThrowsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteDrillLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "drillType" TEXT NOT NULL,
    "implementWeight" DOUBLE PRECISION,
    "throwCount" INTEGER NOT NULL DEFAULT 0,
    "bestMark" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteDrillLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowAnalysis" (
    "id" TEXT NOT NULL,
    "coachId" TEXT,
    "athleteId" TEXT,
    "event" TEXT NOT NULL,
    "drillType" TEXT NOT NULL,
    "cameraAngle" TEXT NOT NULL,
    "athleteHeight" DOUBLE PRECISION,
    "implementWeight" DOUBLE PRECISION,
    "knownDistance" DOUBLE PRECISION,
    "phaseScores" TEXT,
    "energyLeaks" TEXT,
    "releaseMetrics" TEXT,
    "overallScore" DOUBLE PRECISION,
    "issueCards" TEXT,
    "drillRecs" TEXT,
    "rawAnalysis" TEXT,
    "frameCount" INTEGER NOT NULL DEFAULT 0,
    "videoDuration" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisVideo" (
    "id" TEXT NOT NULL,
    "coachId" TEXT,
    "athleteId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "duration" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "fps" DOUBLE PRECISION,
    "thumbnailPath" TEXT,
    "eventType" TEXT,
    "tags" TEXT,
    "sessionDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "reviewStatus" TEXT NOT NULL DEFAULT 'UNREVIEWED',
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoAnnotation" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "coachId" TEXT,
    "athleteId" TEXT,
    "tool" TEXT NOT NULL,
    "frameStart" INTEGER NOT NULL,
    "frameEnd" INTEGER,
    "data" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#FF0000',
    "thickness" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsProfile" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "enrolledBy" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "competitionPb" DOUBLE PRECISION,
    "currentDistanceBand" TEXT,
    "heavyImplementPr" DOUBLE PRECISION,
    "heavyImplementKg" DOUBLE PRECISION,
    "lightImplementPr" DOUBLE PRECISION,
    "lightImplementKg" DOUBLE PRECISION,
    "strengthBenchmarks" TEXT,
    "deficitPrimary" TEXT,
    "deficitSecondary" TEXT,
    "deficitStatus" TEXT,
    "overPowered" BOOLEAN NOT NULL DEFAULT false,
    "muscledOut" BOOLEAN NOT NULL DEFAULT false,
    "adaptationProfile" INTEGER,
    "sessionsToForm" INTEGER,
    "recommendedMethod" TEXT,
    "coachNotes" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inactiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowsProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsKpiStandard" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "distanceBand" TEXT NOT NULL,
    "heavyImplRatioMin" DOUBLE PRECISION NOT NULL,
    "heavyImplRatioTypical" DOUBLE PRECISION NOT NULL,
    "lightImplRatioMin" DOUBLE PRECISION NOT NULL,
    "lightImplRatioTypical" DOUBLE PRECISION NOT NULL,
    "squatToBodyweightMin" DOUBLE PRECISION,
    "squatToBodyweightTypical" DOUBLE PRECISION,
    "benchToBodyweightMin" DOUBLE PRECISION,
    "benchToBodyweightTypical" DOUBLE PRECISION,
    "cleanToBodyweightMin" DOUBLE PRECISION,
    "cleanToBodyweightTypical" DOUBLE PRECISION,
    "snatchToBodyweightMin" DOUBLE PRECISION,
    "snatchToBodyweightTypical" DOUBLE PRECISION,
    "deficitThresholdBelow" DOUBLE PRECISION,
    "deficitThresholdFarBelow" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowsKpiStandard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsTestingRecord" (
    "id" TEXT NOT NULL,
    "throwsProfileId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "testDate" TEXT NOT NULL,
    "testType" TEXT NOT NULL DEFAULT 'FULL_BATTERY',
    "competitionMark" DOUBLE PRECISION,
    "heavyImplMark" DOUBLE PRECISION,
    "heavyImplKg" DOUBLE PRECISION,
    "lightImplMark" DOUBLE PRECISION,
    "lightImplKg" DOUBLE PRECISION,
    "squatKg" DOUBLE PRECISION,
    "benchKg" DOUBLE PRECISION,
    "snatchKg" DOUBLE PRECISION,
    "cleanKg" DOUBLE PRECISION,
    "ohpKg" DOUBLE PRECISION,
    "rdlKg" DOUBLE PRECISION,
    "bodyWeightKg" DOUBLE PRECISION,
    "distanceBandAtTest" TEXT,
    "deficitPrimaryAtTest" TEXT,
    "deficitSecondaryAtTest" TEXT,
    "overPoweredAtTest" BOOLEAN,
    "enteredBy" TEXT NOT NULL DEFAULT 'COACH',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowsTestingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsCompetitionResult" (
    "id" TEXT NOT NULL,
    "throwsProfileId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "competitionName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'B',
    "result" DOUBLE PRECISION,
    "wind" DOUBLE PRECISION,
    "placing" INTEGER,
    "attempts" TEXT,
    "competitionLevel" TEXT,
    "conditions" TEXT,
    "inSportsForm" BOOLEAN,
    "sessionsSinceProgramChange" INTEGER,
    "selfFeelingOnDay" INTEGER,
    "weekInBlock" INTEGER,
    "resultBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowsCompetitionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThrowsInjury" (
    "id" TEXT NOT NULL,
    "throwsProfileId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "injuryDate" TEXT NOT NULL,
    "returnToThrowDate" TEXT,
    "fullReturnDate" TEXT,
    "bodyPart" TEXT NOT NULL,
    "side" TEXT,
    "severity" TEXT NOT NULL,
    "type" TEXT,
    "throwsBanned" BOOLEAN NOT NULL DEFAULT false,
    "heavyBanned" BOOLEAN NOT NULL DEFAULT false,
    "strengthBanned" BOOLEAN NOT NULL DEFAULT false,
    "modifiedLoad" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "treatmentPlan" TEXT,
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "recoveredDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThrowsInjury_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrillVideo" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT,
    "coachId" TEXT,
    "title" TEXT NOT NULL,
    "drillType" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "trimStart" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trimEnd" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "notes" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrillVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseLibrary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscleGroup" TEXT NOT NULL,
    "equipment" TEXT,
    "target" TEXT,
    "synergists" TEXT,
    "stabilizers" TEXT,
    "preparation" TEXT,
    "execution" TEXT,
    "tips" TEXT,
    "force" TEXT,
    "mechanics" TEXT,
    "utility" TEXT,
    "videoUrl" TEXT,
    "videoEmbed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingProgram" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "coachId" TEXT,
    "event" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TEXT NOT NULL,
    "targetDate" TEXT NOT NULL,
    "goalDistance" DOUBLE PRECISION NOT NULL,
    "startingPr" DOUBLE PRECISION NOT NULL,
    "daysPerWeek" INTEGER NOT NULL DEFAULT 4,
    "sessionsPerDay" INTEGER NOT NULL DEFAULT 1,
    "includeLift" BOOLEAN NOT NULL DEFAULT true,
    "adaptationGroup" INTEGER,
    "sessionsToForm" INTEGER,
    "recommendedMethod" TEXT,
    "currentPhaseId" TEXT,
    "currentWeekNumber" INTEGER NOT NULL DEFAULT 1,
    "currentComplexNum" INTEGER NOT NULL DEFAULT 1,
    "generationConfig" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramPhase" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "phaseOrder" INTEGER NOT NULL,
    "startWeek" INTEGER NOT NULL,
    "endWeek" INTEGER NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "throwsPerWeekTarget" INTEGER NOT NULL,
    "strengthDaysTarget" INTEGER NOT NULL,
    "cePercent" DOUBLE PRECISION NOT NULL,
    "sdPercent" DOUBLE PRECISION NOT NULL,
    "spPercent" DOUBLE PRECISION NOT NULL,
    "gpPercent" DOUBLE PRECISION NOT NULL,
    "lightPercent" DOUBLE PRECISION NOT NULL,
    "compPercent" DOUBLE PRECISION NOT NULL,
    "heavyPercent" DOUBLE PRECISION NOT NULL,
    "exerciseComplex" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramSession" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "dayType" TEXT NOT NULL,
    "scheduledDate" TEXT,
    "sessionType" TEXT NOT NULL,
    "focusLabel" TEXT NOT NULL,
    "throwsPrescription" TEXT NOT NULL,
    "strengthPrescription" TEXT,
    "warmupPrescription" TEXT,
    "totalThrowsTarget" INTEGER NOT NULL,
    "estimatedDuration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "completedAt" TIMESTAMP(3),
    "wasModified" BOOLEAN NOT NULL DEFAULT false,
    "actualPrescription" TEXT,
    "modificationNotes" TEXT,
    "actualThrows" INTEGER,
    "selfFeeling" TEXT,
    "rpe" INTEGER,
    "bestMark" DOUBLE PRECISION,
    "sessionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramThrowResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "throwNumber" INTEGER NOT NULL,
    "implement" TEXT NOT NULL,
    "distance" DOUBLE PRECISION,
    "drillType" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramThrowResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramLiftResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,
    "weight" DOUBLE PRECISION,
    "rpe" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramLiftResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionBestMark" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "implement" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "drillType" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionBestMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentInventory" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "implements" TEXT NOT NULL,
    "hasCage" BOOLEAN NOT NULL DEFAULT true,
    "hasRing" BOOLEAN NOT NULL DEFAULT true,
    "hasFieldAccess" BOOLEAN NOT NULL DEFAULT true,
    "hasGym" BOOLEAN NOT NULL DEFAULT true,
    "gymEquipment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptationCheckpoint" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "checkDate" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "complexNumber" INTEGER NOT NULL,
    "recentMarks" TEXT NOT NULL,
    "markTrend" TEXT NOT NULL,
    "averageMark" DOUBLE PRECISION,
    "peakMark" DOUBLE PRECISION,
    "markSlope" DOUBLE PRECISION,
    "avgReadiness" DOUBLE PRECISION,
    "avgSoreness" DOUBLE PRECISION,
    "strengthTrend" TEXT,
    "recommendation" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptationCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT NOT NULL DEFAULT 'deficit-finder',
    "event" TEXT,
    "gender" TEXT,
    "deficitResult" JSONB,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "convertedToUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "CoachProfile_userId_key" ON "CoachProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachProfile_stripeCustomerId_key" ON "CoachProfile"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachProfile_stripeSubscriptionId_key" ON "CoachProfile"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "CoachProfile_userId_idx" ON "CoachProfile"("userId");

-- CreateIndex
CREATE INDEX "CoachProfile_plan_idx" ON "CoachProfile"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteProfile_userId_key" ON "AthleteProfile"("userId");

-- CreateIndex
CREATE INDEX "AthleteProfile_coachId_idx" ON "AthleteProfile"("coachId");

-- CreateIndex
CREATE INDEX "AthleteProfile_userId_idx" ON "AthleteProfile"("userId");

-- CreateIndex
CREATE INDEX "Exercise_coachId_idx" ON "Exercise"("coachId");

-- CreateIndex
CREATE INDEX "Exercise_category_idx" ON "Exercise"("category");

-- CreateIndex
CREATE INDEX "Exercise_event_idx" ON "Exercise"("event");

-- CreateIndex
CREATE INDEX "Exercise_isGlobal_idx" ON "Exercise"("isGlobal");

-- CreateIndex
CREATE INDEX "WorkoutPlan_coachId_idx" ON "WorkoutPlan"("coachId");

-- CreateIndex
CREATE INDEX "WorkoutPlan_event_idx" ON "WorkoutPlan"("event");

-- CreateIndex
CREATE INDEX "WorkoutBlock_planId_idx" ON "WorkoutBlock"("planId");

-- CreateIndex
CREATE INDEX "WorkoutBlock_order_idx" ON "WorkoutBlock"("order");

-- CreateIndex
CREATE INDEX "BlockExercise_blockId_idx" ON "BlockExercise"("blockId");

-- CreateIndex
CREATE INDEX "BlockExercise_exerciseId_idx" ON "BlockExercise"("exerciseId");

-- CreateIndex
CREATE INDEX "BlockExercise_order_idx" ON "BlockExercise"("order");

-- CreateIndex
CREATE INDEX "TrainingSession_athleteId_idx" ON "TrainingSession"("athleteId");

-- CreateIndex
CREATE INDEX "TrainingSession_planId_idx" ON "TrainingSession"("planId");

-- CreateIndex
CREATE INDEX "TrainingSession_scheduledDate_idx" ON "TrainingSession"("scheduledDate");

-- CreateIndex
CREATE INDEX "TrainingSession_status_idx" ON "TrainingSession"("status");

-- CreateIndex
CREATE INDEX "TrainingSession_athleteId_scheduledDate_idx" ON "TrainingSession"("athleteId", "scheduledDate");

-- CreateIndex
CREATE INDEX "SessionLog_sessionId_idx" ON "SessionLog"("sessionId");

-- CreateIndex
CREATE INDEX "SessionLog_athleteId_idx" ON "SessionLog"("athleteId");

-- CreateIndex
CREATE INDEX "SessionLog_completedAt_idx" ON "SessionLog"("completedAt");

-- CreateIndex
CREATE INDEX "ThrowLog_athleteId_idx" ON "ThrowLog"("athleteId");

-- CreateIndex
CREATE INDEX "ThrowLog_athleteId_event_idx" ON "ThrowLog"("athleteId", "event");

-- CreateIndex
CREATE INDEX "ThrowLog_athleteId_date_idx" ON "ThrowLog"("athleteId", "date");

-- CreateIndex
CREATE INDEX "ThrowLog_event_idx" ON "ThrowLog"("event");

-- CreateIndex
CREATE INDEX "ThrowLog_date_idx" ON "ThrowLog"("date");

-- CreateIndex
CREATE INDEX "ThrowLog_isPersonalBest_idx" ON "ThrowLog"("isPersonalBest");

-- CreateIndex
CREATE INDEX "BondarchukAssessment_athleteId_idx" ON "BondarchukAssessment"("athleteId");

-- CreateIndex
CREATE INDEX "BondarchukAssessment_completedAt_idx" ON "BondarchukAssessment"("completedAt");

-- CreateIndex
CREATE INDEX "Drill_coachId_idx" ON "Drill"("coachId");

-- CreateIndex
CREATE INDEX "Drill_event_idx" ON "Drill"("event");

-- CreateIndex
CREATE INDEX "Drill_category_idx" ON "Drill"("category");

-- CreateIndex
CREATE INDEX "ReadinessCheckIn_athleteId_idx" ON "ReadinessCheckIn"("athleteId");

-- CreateIndex
CREATE INDEX "ReadinessCheckIn_date_idx" ON "ReadinessCheckIn"("date");

-- CreateIndex
CREATE INDEX "ReadinessCheckIn_athleteId_date_idx" ON "ReadinessCheckIn"("athleteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessCheckIn_athleteId_date_key" ON "ReadinessCheckIn"("athleteId", "date");

-- CreateIndex
CREATE INDEX "Questionnaire_coachId_idx" ON "Questionnaire"("coachId");

-- CreateIndex
CREATE INDEX "Questionnaire_type_idx" ON "Questionnaire"("type");

-- CreateIndex
CREATE INDEX "Questionnaire_status_idx" ON "Questionnaire"("status");

-- CreateIndex
CREATE INDEX "Questionnaire_isTemplate_idx" ON "Questionnaire"("isTemplate");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_questionnaireId_idx" ON "QuestionnaireResponse"("questionnaireId");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_athleteId_idx" ON "QuestionnaireResponse"("athleteId");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_completedAt_idx" ON "QuestionnaireResponse"("completedAt");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_assignmentId_idx" ON "QuestionnaireResponse"("assignmentId");

-- CreateIndex
CREATE INDEX "QuestionnaireAssignment_athleteId_idx" ON "QuestionnaireAssignment"("athleteId");

-- CreateIndex
CREATE INDEX "QuestionnaireAssignment_questionnaireId_idx" ON "QuestionnaireAssignment"("questionnaireId");

-- CreateIndex
CREATE INDEX "QuestionnaireAssignment_scheduleId_idx" ON "QuestionnaireAssignment"("scheduleId");

-- CreateIndex
CREATE INDEX "QuestionnaireAssignment_dueDate_idx" ON "QuestionnaireAssignment"("dueDate");

-- CreateIndex
CREATE INDEX "QuestionnaireAssignment_athleteId_completedAt_idx" ON "QuestionnaireAssignment"("athleteId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireAssignment_questionnaireId_athleteId_instanceD_key" ON "QuestionnaireAssignment"("questionnaireId", "athleteId", "instanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringSchedule_questionnaireId_key" ON "RecurringSchedule"("questionnaireId");

-- CreateIndex
CREATE INDEX "RecurringSchedule_isActive_idx" ON "RecurringSchedule"("isActive");

-- CreateIndex
CREATE INDEX "RecurringSchedule_nextRunAt_idx" ON "RecurringSchedule"("nextRunAt");

-- CreateIndex
CREATE INDEX "Goal_athleteId_idx" ON "Goal"("athleteId");

-- CreateIndex
CREATE INDEX "Goal_status_idx" ON "Goal"("status");

-- CreateIndex
CREATE INDEX "Goal_athleteId_status_idx" ON "Goal"("athleteId", "status");

-- CreateIndex
CREATE INDEX "Achievement_athleteId_idx" ON "Achievement"("athleteId");

-- CreateIndex
CREATE INDEX "Achievement_type_idx" ON "Achievement"("type");

-- CreateIndex
CREATE INDEX "Achievement_earnedAt_idx" ON "Achievement"("earnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_athleteId_badgeKey_key" ON "Achievement"("athleteId", "badgeKey");

-- CreateIndex
CREATE INDEX "VideoUpload_coachId_idx" ON "VideoUpload"("coachId");

-- CreateIndex
CREATE INDEX "VideoUpload_athleteId_idx" ON "VideoUpload"("athleteId");

-- CreateIndex
CREATE INDEX "VideoUpload_event_idx" ON "VideoUpload"("event");

-- CreateIndex
CREATE INDEX "VideoUpload_category_idx" ON "VideoUpload"("category");

-- CreateIndex
CREATE INDEX "VideoUpload_createdAt_idx" ON "VideoUpload"("createdAt");

-- CreateIndex
CREATE INDEX "FrameAnnotation_videoId_timestamp_idx" ON "FrameAnnotation"("videoId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "FrameAnnotation_videoId_timestamp_source_key" ON "FrameAnnotation"("videoId", "timestamp", "source");

-- CreateIndex
CREATE INDEX "Team_coachId_idx" ON "Team"("coachId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "TeamMember_athleteId_idx" ON "TeamMember"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_athleteId_key" ON "TeamMember"("teamId", "athleteId");

-- CreateIndex
CREATE INDEX "Notification_coachId_read_idx" ON "Notification"("coachId", "read");

-- CreateIndex
CREATE INDEX "Notification_coachId_createdAt_idx" ON "Notification"("coachId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_coachId_idx" ON "Invitation"("coachId");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_token_idx" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_status_idx" ON "Invitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "VoiceNote_sessionId_idx" ON "VoiceNote"("sessionId");

-- CreateIndex
CREATE INDEX "VoiceNote_coachId_idx" ON "VoiceNote"("coachId");

-- CreateIndex
CREATE INDEX "VoiceNote_athleteId_idx" ON "VoiceNote"("athleteId");

-- CreateIndex
CREATE INDEX "ActivityLog_coachId_createdAt_idx" ON "ActivityLog"("coachId", "createdAt");

-- CreateIndex
CREATE INDEX "BodyMeasurement_athleteId_date_idx" ON "BodyMeasurement"("athleteId", "date");

-- CreateIndex
CREATE INDEX "Injury_athleteId_injuryDate_idx" ON "Injury"("athleteId", "injuryDate");

-- CreateIndex
CREATE INDEX "RiskAssessment_athleteId_assessmentDate_idx" ON "RiskAssessment"("athleteId", "assessmentDate");

-- CreateIndex
CREATE INDEX "MobilityAssessment_athleteId_assessmentDate_idx" ON "MobilityAssessment"("athleteId", "assessmentDate");

-- CreateIndex
CREATE INDEX "AthleteGoal_athleteId_status_idx" ON "AthleteGoal"("athleteId", "status");

-- CreateIndex
CREATE INDEX "ThrowsSession_coachId_idx" ON "ThrowsSession"("coachId");

-- CreateIndex
CREATE INDEX "ThrowsBlock_sessionId_position_idx" ON "ThrowsBlock"("sessionId", "position");

-- CreateIndex
CREATE INDEX "ThrowsAssignment_athleteId_assignedDate_idx" ON "ThrowsAssignment"("athleteId", "assignedDate");

-- CreateIndex
CREATE INDEX "ThrowsAssignment_sessionId_idx" ON "ThrowsAssignment"("sessionId");

-- CreateIndex
CREATE INDEX "ThrowsBlockLog_assignmentId_idx" ON "ThrowsBlockLog"("assignmentId");

-- CreateIndex
CREATE INDEX "ThrowsBlockLog_blockId_idx" ON "ThrowsBlockLog"("blockId");

-- CreateIndex
CREATE INDEX "PracticeSession_coachId_date_idx" ON "PracticeSession"("coachId", "date");

-- CreateIndex
CREATE INDEX "PracticeAttempt_sessionId_idx" ON "PracticeAttempt"("sessionId");

-- CreateIndex
CREATE INDEX "PracticeAttempt_athleteId_event_idx" ON "PracticeAttempt"("athleteId", "event");

-- CreateIndex
CREATE INDEX "ThrowsPR_athleteId_event_idx" ON "ThrowsPR"("athleteId", "event");

-- CreateIndex
CREATE UNIQUE INDEX "ThrowsPR_athleteId_event_implement_key" ON "ThrowsPR"("athleteId", "event", "implement");

-- CreateIndex
CREATE INDEX "ThrowsDrillPR_athleteId_idx" ON "ThrowsDrillPR"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "ThrowsDrillPR_athleteId_event_drillType_implement_key" ON "ThrowsDrillPR"("athleteId", "event", "drillType", "implement");

-- CreateIndex
CREATE INDEX "ThrowsCheckIn_athleteId_date_idx" ON "ThrowsCheckIn"("athleteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ThrowsCheckIn_athleteId_date_key" ON "ThrowsCheckIn"("athleteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ThrowsTyping_athleteId_key" ON "ThrowsTyping"("athleteId");

-- CreateIndex
CREATE INDEX "ThrowsComplex_athleteId_endDate_idx" ON "ThrowsComplex"("athleteId", "endDate");

-- CreateIndex
CREATE INDEX "ThrowsCompetition_athleteId_date_idx" ON "ThrowsCompetition"("athleteId", "date");

-- CreateIndex
CREATE INDEX "AthleteThrowsSession_athleteId_date_idx" ON "AthleteThrowsSession"("athleteId", "date");

-- CreateIndex
CREATE INDEX "AthleteDrillLog_sessionId_idx" ON "AthleteDrillLog"("sessionId");

-- CreateIndex
CREATE INDEX "ThrowAnalysis_coachId_idx" ON "ThrowAnalysis"("coachId");

-- CreateIndex
CREATE INDEX "ThrowAnalysis_athleteId_idx" ON "ThrowAnalysis"("athleteId");

-- CreateIndex
CREATE INDEX "ThrowAnalysis_event_idx" ON "ThrowAnalysis"("event");

-- CreateIndex
CREATE INDEX "AnalysisVideo_coachId_idx" ON "AnalysisVideo"("coachId");

-- CreateIndex
CREATE INDEX "AnalysisVideo_athleteId_idx" ON "AnalysisVideo"("athleteId");

-- CreateIndex
CREATE INDEX "AnalysisVideo_reviewStatus_idx" ON "AnalysisVideo"("reviewStatus");

-- CreateIndex
CREATE INDEX "AnalysisVideo_eventType_idx" ON "AnalysisVideo"("eventType");

-- CreateIndex
CREATE INDEX "VideoAnnotation_videoId_frameStart_idx" ON "VideoAnnotation"("videoId", "frameStart");

-- CreateIndex
CREATE INDEX "VideoAnnotation_coachId_idx" ON "VideoAnnotation"("coachId");

-- CreateIndex
CREATE INDEX "VideoAnnotation_athleteId_idx" ON "VideoAnnotation"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "ThrowsProfile_athleteId_key" ON "ThrowsProfile"("athleteId");

-- CreateIndex
CREATE INDEX "ThrowsProfile_enrolledBy_idx" ON "ThrowsProfile"("enrolledBy");

-- CreateIndex
CREATE INDEX "ThrowsProfile_status_idx" ON "ThrowsProfile"("status");

-- CreateIndex
CREATE INDEX "ThrowsKpiStandard_event_gender_idx" ON "ThrowsKpiStandard"("event", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "ThrowsKpiStandard_event_gender_distanceBand_key" ON "ThrowsKpiStandard"("event", "gender", "distanceBand");

-- CreateIndex
CREATE INDEX "ThrowsTestingRecord_throwsProfileId_idx" ON "ThrowsTestingRecord"("throwsProfileId");

-- CreateIndex
CREATE INDEX "ThrowsTestingRecord_athleteId_testDate_idx" ON "ThrowsTestingRecord"("athleteId", "testDate");

-- CreateIndex
CREATE INDEX "ThrowsCompetitionResult_throwsProfileId_idx" ON "ThrowsCompetitionResult"("throwsProfileId");

-- CreateIndex
CREATE INDEX "ThrowsCompetitionResult_athleteId_date_idx" ON "ThrowsCompetitionResult"("athleteId", "date");

-- CreateIndex
CREATE INDEX "ThrowsInjury_throwsProfileId_idx" ON "ThrowsInjury"("throwsProfileId");

-- CreateIndex
CREATE INDEX "ThrowsInjury_athleteId_injuryDate_idx" ON "ThrowsInjury"("athleteId", "injuryDate");

-- CreateIndex
CREATE INDEX "DrillVideo_athleteId_createdAt_idx" ON "DrillVideo"("athleteId", "createdAt");

-- CreateIndex
CREATE INDEX "DrillVideo_coachId_idx" ON "DrillVideo"("coachId");

-- CreateIndex
CREATE INDEX "DrillVideo_drillType_idx" ON "DrillVideo"("drillType");

-- CreateIndex
CREATE INDEX "DrillVideo_event_idx" ON "DrillVideo"("event");

-- CreateIndex
CREATE INDEX "ExerciseLibrary_muscleGroup_idx" ON "ExerciseLibrary"("muscleGroup");

-- CreateIndex
CREATE INDEX "ExerciseLibrary_name_idx" ON "ExerciseLibrary"("name");

-- CreateIndex
CREATE INDEX "TrainingProgram_athleteId_status_idx" ON "TrainingProgram"("athleteId", "status");

-- CreateIndex
CREATE INDEX "TrainingProgram_coachId_idx" ON "TrainingProgram"("coachId");

-- CreateIndex
CREATE INDEX "ProgramPhase_programId_phaseOrder_idx" ON "ProgramPhase"("programId", "phaseOrder");

-- CreateIndex
CREATE INDEX "ProgramSession_programId_weekNumber_dayOfWeek_idx" ON "ProgramSession"("programId", "weekNumber", "dayOfWeek");

-- CreateIndex
CREATE INDEX "ProgramSession_scheduledDate_idx" ON "ProgramSession"("scheduledDate");

-- CreateIndex
CREATE INDEX "ProgramSession_phaseId_idx" ON "ProgramSession"("phaseId");

-- CreateIndex
CREATE INDEX "ProgramThrowResult_sessionId_idx" ON "ProgramThrowResult"("sessionId");

-- CreateIndex
CREATE INDEX "ProgramLiftResult_sessionId_idx" ON "ProgramLiftResult"("sessionId");

-- CreateIndex
CREATE INDEX "SessionBestMark_sessionId_idx" ON "SessionBestMark"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionBestMark_sessionId_implement_key" ON "SessionBestMark"("sessionId", "implement");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentInventory_athleteId_key" ON "EquipmentInventory"("athleteId");

-- CreateIndex
CREATE INDEX "AdaptationCheckpoint_programId_checkDate_idx" ON "AdaptationCheckpoint"("programId", "checkDate");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- AddForeignKey
ALTER TABLE "CoachProfile" ADD CONSTRAINT "CoachProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteProfile" ADD CONSTRAINT "AthleteProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteProfile" ADD CONSTRAINT "AthleteProfile_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutBlock" ADD CONSTRAINT "WorkoutBlock_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WorkoutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockExercise" ADD CONSTRAINT "BlockExercise_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "WorkoutBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockExercise" ADD CONSTRAINT "BlockExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WorkoutPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionLog" ADD CONSTRAINT "SessionLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionLog" ADD CONSTRAINT "SessionLog_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowLog" ADD CONSTRAINT "ThrowLog_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowLog" ADD CONSTRAINT "ThrowLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BondarchukAssessment" ADD CONSTRAINT "BondarchukAssessment_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drill" ADD CONSTRAINT "Drill_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessCheckIn" ADD CONSTRAINT "ReadinessCheckIn_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireAssignment" ADD CONSTRAINT "QuestionnaireAssignment_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireAssignment" ADD CONSTRAINT "QuestionnaireAssignment_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireAssignment" ADD CONSTRAINT "QuestionnaireAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "RecurringSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSchedule" ADD CONSTRAINT "RecurringSchedule_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoUpload" ADD CONSTRAINT "VideoUpload_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoUpload" ADD CONSTRAINT "VideoUpload_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameAnnotation" ADD CONSTRAINT "FrameAnnotation_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceNote" ADD CONSTRAINT "VoiceNote_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceNote" ADD CONSTRAINT "VoiceNote_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceNote" ADD CONSTRAINT "VoiceNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyMeasurement" ADD CONSTRAINT "BodyMeasurement_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Injury" ADD CONSTRAINT "Injury_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityAssessment" ADD CONSTRAINT "MobilityAssessment_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteGoal" ADD CONSTRAINT "AthleteGoal_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsSession" ADD CONSTRAINT "ThrowsSession_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsBlock" ADD CONSTRAINT "ThrowsBlock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ThrowsSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsAssignment" ADD CONSTRAINT "ThrowsAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ThrowsSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsAssignment" ADD CONSTRAINT "ThrowsAssignment_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsBlockLog" ADD CONSTRAINT "ThrowsBlockLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ThrowsAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsBlockLog" ADD CONSTRAINT "ThrowsBlockLog_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ThrowsBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PracticeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsPR" ADD CONSTRAINT "ThrowsPR_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsDrillPR" ADD CONSTRAINT "ThrowsDrillPR_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsCheckIn" ADD CONSTRAINT "ThrowsCheckIn_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsTyping" ADD CONSTRAINT "ThrowsTyping_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsComplex" ADD CONSTRAINT "ThrowsComplex_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsCompetition" ADD CONSTRAINT "ThrowsCompetition_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteThrowsSession" ADD CONSTRAINT "AthleteThrowsSession_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteDrillLog" ADD CONSTRAINT "AthleteDrillLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AthleteThrowsSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowAnalysis" ADD CONSTRAINT "ThrowAnalysis_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowAnalysis" ADD CONSTRAINT "ThrowAnalysis_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisVideo" ADD CONSTRAINT "AnalysisVideo_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisVideo" ADD CONSTRAINT "AnalysisVideo_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAnnotation" ADD CONSTRAINT "VideoAnnotation_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "AnalysisVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAnnotation" ADD CONSTRAINT "VideoAnnotation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoAnnotation" ADD CONSTRAINT "VideoAnnotation_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsProfile" ADD CONSTRAINT "ThrowsProfile_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsProfile" ADD CONSTRAINT "ThrowsProfile_enrolledBy_fkey" FOREIGN KEY ("enrolledBy") REFERENCES "CoachProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsTestingRecord" ADD CONSTRAINT "ThrowsTestingRecord_throwsProfileId_fkey" FOREIGN KEY ("throwsProfileId") REFERENCES "ThrowsProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsTestingRecord" ADD CONSTRAINT "ThrowsTestingRecord_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsCompetitionResult" ADD CONSTRAINT "ThrowsCompetitionResult_throwsProfileId_fkey" FOREIGN KEY ("throwsProfileId") REFERENCES "ThrowsProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsCompetitionResult" ADD CONSTRAINT "ThrowsCompetitionResult_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsInjury" ADD CONSTRAINT "ThrowsInjury_throwsProfileId_fkey" FOREIGN KEY ("throwsProfileId") REFERENCES "ThrowsProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThrowsInjury" ADD CONSTRAINT "ThrowsInjury_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillVideo" ADD CONSTRAINT "DrillVideo_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrillVideo" ADD CONSTRAINT "DrillVideo_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgram" ADD CONSTRAINT "TrainingProgram_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgram" ADD CONSTRAINT "TrainingProgram_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramPhase" ADD CONSTRAINT "ProgramPhase_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramSession" ADD CONSTRAINT "ProgramSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramSession" ADD CONSTRAINT "ProgramSession_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProgramPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramThrowResult" ADD CONSTRAINT "ProgramThrowResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProgramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramLiftResult" ADD CONSTRAINT "ProgramLiftResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProgramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBestMark" ADD CONSTRAINT "SessionBestMark_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProgramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentInventory" ADD CONSTRAINT "EquipmentInventory_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptationCheckpoint" ADD CONSTRAINT "AdaptationCheckpoint_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

