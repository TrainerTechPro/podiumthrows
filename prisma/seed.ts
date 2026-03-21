import { PrismaClient, AchievementType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── HELPERS ────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

function randomBetween(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── MAIN SEED ──────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding database...\n");

  // Clean existing data
  await prisma.eventGroupMember.deleteMany();
  await prisma.eventGroup.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.questionnaireResponse.deleteMany();
  await prisma.questionnaire.deleteMany();
  await prisma.readinessCheckIn.deleteMany();
  await prisma.bondarchukAssessment.deleteMany();
  await prisma.drill.deleteMany();
  await prisma.throwLog.deleteMany();
  await prisma.sessionLog.deleteMany();
  await prisma.trainingSession.deleteMany();
  await prisma.blockExercise.deleteMany();
  await prisma.workoutBlock.deleteMany();
  await prisma.workoutPlan.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.videoUpload.deleteMany();
  await prisma.athleteProfile.deleteMany();
  await prisma.coachProfile.deleteMany();
  await prisma.user.deleteMany();

  console.log("  ✓ Cleared existing data\n");

  // ─── 1. USERS ───────────────────────────────────────────────────────────

  const coachPassword = await bcrypt.hash("coach123", 12);
  const athletePassword = await bcrypt.hash("athlete123", 12);

  const coachUser = await prisma.user.create({
    data: {
      email: "coach@example.com",
      passwordHash: coachPassword,
      role: "COACH",
    },
  });

  const coachProfile = await prisma.coachProfile.create({
    data: {
      userId: coachUser.id,
      firstName: "Marcus",
      lastName: "Petrov",
      bio: "Former Olympic hammer thrower. 20+ years coaching Division I athletes. Bondarchuk methodology specialist.",
      organization: "University of Oregon Track & Field",
      plan: "PRO",
    },
  });

  console.log("  ✓ Coach created: coach@example.com / coach123\n");

  // ─── 2. ATHLETES ────────────────────────────────────────────────────────

  const athleteConfigs = [
    {
      email: "athlete1@example.com",
      firstName: "Jordan",
      lastName: "Mitchell",
      events: ["SHOT_PUT" as const],
      gender: "MALE" as const,
      dob: new Date("2001-03-15"),
      heightCm: 193,
      weightKg: 118,
    },
    {
      email: "athlete2@example.com",
      firstName: "Anika",
      lastName: "Osei",
      events: ["DISCUS" as const],
      gender: "FEMALE" as const,
      dob: new Date("2002-07-22"),
      heightCm: 178,
      weightKg: 82,
    },
    {
      email: "athlete3@example.com",
      firstName: "Dmitri",
      lastName: "Volkov",
      events: ["HAMMER" as const],
      gender: "MALE" as const,
      dob: new Date("2000-11-08"),
      heightCm: 188,
      weightKg: 105,
    },
    {
      email: "athlete4@example.com",
      firstName: "Elena",
      lastName: "Nakamura",
      events: ["JAVELIN" as const],
      gender: "FEMALE" as const,
      dob: new Date("2003-01-30"),
      heightCm: 175,
      weightKg: 72,
    },
  ];

  const athleteProfiles = [];

  for (const config of athleteConfigs) {
    const user = await prisma.user.create({
      data: {
        email: config.email,
        passwordHash: athletePassword,
        role: "ATHLETE",
      },
    });

    const profile = await prisma.athleteProfile.create({
      data: {
        userId: user.id,
        coachId: coachProfile.id,
        firstName: config.firstName,
        lastName: config.lastName,
        events: config.events,
        gender: config.gender,
        dateOfBirth: config.dob,
        heightCm: config.heightCm,
        weightKg: config.weightKg,
        currentStreak: randomInt(3, 12),
        longestStreak: randomInt(14, 30),
        lastActivityDate: daysAgo(0),
      },
    });

    athleteProfiles.push(profile);
    console.log(`  ✓ Athlete created: ${config.email} / athlete123`);
  }
  console.log();

  // ─── 3. EXERCISES ───────────────────────────────────────────────────────

  // Correlation coefficients by event — Bondarchuk Transfer of Training methodology
  // Higher = more transfer to competition throw. CE exercises are near 1.0.
  type CorrelationMap = Record<string, { correlation: number }>;
  type ExerciseEntry = {
    name: string;
    category: "CE" | "SDE" | "SPE" | "GPE";
    event: "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN" | null;
    implementWeight: number | null;
    equipment: string | null;
    defaultSets: number | null;
    defaultReps: string | null;
    isGlobal: boolean;
    correlationData?: CorrelationMap;
  };

  const exerciseData: ExerciseEntry[] = [
    // ─── Competition Exercises (CE) ─────────────────────────────────
    {
      name: "Full Shot Put (Competition)",
      category: "CE",
      event: "SHOT_PUT",
      implementWeight: 7.26,
      equipment: "implement",
      defaultSets: 8,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { SHOT_PUT: { correlation: 1.0 } },
    },
    {
      name: "Full Discus Throw (Competition)",
      category: "CE",
      event: "DISCUS",
      implementWeight: 2.0,
      equipment: "implement",
      defaultSets: 8,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { DISCUS: { correlation: 1.0 } },
    },
    {
      name: "Full Hammer Throw (Competition)",
      category: "CE",
      event: "HAMMER",
      implementWeight: 7.26,
      equipment: "implement",
      defaultSets: 8,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { HAMMER: { correlation: 1.0 } },
    },
    {
      name: "Full Javelin Throw (Competition)",
      category: "CE",
      event: "JAVELIN",
      implementWeight: 0.8,
      equipment: "implement",
      defaultSets: 8,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { JAVELIN: { correlation: 1.0 } },
    },
    // CE — Overweight implements
    {
      name: "Heavy Shot Put (8kg)",
      category: "CE",
      event: "SHOT_PUT",
      implementWeight: 8.0,
      equipment: "implement",
      defaultSets: 6,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { SHOT_PUT: { correlation: 0.92 } },
    },
    {
      name: "Heavy Shot Put (9kg)",
      category: "CE",
      event: "SHOT_PUT",
      implementWeight: 9.0,
      equipment: "implement",
      defaultSets: 6,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { SHOT_PUT: { correlation: 0.85 } },
    },
    {
      name: "Heavy Hammer (8kg)",
      category: "CE",
      event: "HAMMER",
      implementWeight: 8.0,
      equipment: "implement",
      defaultSets: 5,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { HAMMER: { correlation: 0.91 } },
    },
    {
      name: "Heavy Hammer (9kg)",
      category: "CE",
      event: "HAMMER",
      implementWeight: 9.0,
      equipment: "implement",
      defaultSets: 5,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { HAMMER: { correlation: 0.84 } },
    },
    // CE — Underweight implements
    {
      name: "Light Shot Put (6kg)",
      category: "CE",
      event: "SHOT_PUT",
      implementWeight: 6.0,
      equipment: "implement",
      defaultSets: 6,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { SHOT_PUT: { correlation: 0.88 } },
    },
    {
      name: "Light Discus (1.5kg)",
      category: "CE",
      event: "DISCUS",
      implementWeight: 1.5,
      equipment: "implement",
      defaultSets: 6,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { DISCUS: { correlation: 0.9 } },
    },
    {
      name: "Light Hammer (6kg)",
      category: "CE",
      event: "HAMMER",
      implementWeight: 6.0,
      equipment: "implement",
      defaultSets: 5,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { HAMMER: { correlation: 0.87 } },
    },
    {
      name: "Light Javelin (700g)",
      category: "CE",
      event: "JAVELIN",
      implementWeight: 0.7,
      equipment: "implement",
      defaultSets: 6,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { JAVELIN: { correlation: 0.89 } },
    },

    // ─── Special Developmental (SDE) ────────────────────────────────
    {
      name: "Standing Throw — Shot Put",
      category: "SDE",
      event: "SHOT_PUT",
      implementWeight: 7.26,
      equipment: "implement",
      defaultSets: 6,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { SHOT_PUT: { correlation: 0.82 } },
    },
    {
      name: "Half Turns — Discus",
      category: "SDE",
      event: "DISCUS",
      implementWeight: 2.0,
      equipment: "implement",
      defaultSets: 6,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { DISCUS: { correlation: 0.79 } },
    },
    {
      name: "3-Turn Hammer",
      category: "SDE",
      event: "HAMMER",
      implementWeight: 7.26,
      equipment: "implement",
      defaultSets: 5,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { HAMMER: { correlation: 0.81 } },
    },
    {
      name: "3-Step Javelin",
      category: "SDE",
      event: "JAVELIN",
      implementWeight: 0.8,
      equipment: "implement",
      defaultSets: 6,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { JAVELIN: { correlation: 0.83 } },
    },
    {
      name: "Power Position Shot Put",
      category: "SDE",
      event: "SHOT_PUT",
      implementWeight: 7.26,
      equipment: "implement",
      defaultSets: 6,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { SHOT_PUT: { correlation: 0.78 } },
    },
    {
      name: "South African Drill — Discus",
      category: "SDE",
      event: "DISCUS",
      implementWeight: 2.0,
      equipment: "implement",
      defaultSets: 5,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { DISCUS: { correlation: 0.76 } },
    },
    {
      name: "2-Turn Hammer",
      category: "SDE",
      event: "HAMMER",
      implementWeight: 7.26,
      equipment: "implement",
      defaultSets: 5,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { HAMMER: { correlation: 0.77 } },
    },

    // ─── Special Preparatory (SPE) ──────────────────────────────────
    {
      name: "Rotational Medicine Ball Throw",
      category: "SPE",
      event: null,
      implementWeight: null,
      equipment: "medicine ball",
      defaultSets: 4,
      defaultReps: "6",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.62 },
        DISCUS: { correlation: 0.65 },
        HAMMER: { correlation: 0.58 },
        JAVELIN: { correlation: 0.45 },
      },
    },
    {
      name: "Overhead Shot Backward",
      category: "SPE",
      event: "SHOT_PUT",
      implementWeight: 7.26,
      equipment: "implement",
      defaultSets: 5,
      defaultReps: "1",
      isGlobal: true,
      correlationData: { SHOT_PUT: { correlation: 0.71 } },
    },
    {
      name: "Hammer Winds (no release)",
      category: "SPE",
      event: "HAMMER",
      implementWeight: 7.26,
      equipment: "implement",
      defaultSets: 4,
      defaultReps: "6",
      isGlobal: true,
      correlationData: { HAMMER: { correlation: 0.68 } },
    },
    {
      name: "Javelin Run-up Drills",
      category: "SPE",
      event: "JAVELIN",
      implementWeight: null,
      equipment: null,
      defaultSets: 4,
      defaultReps: "6",
      isGlobal: true,
      correlationData: { JAVELIN: { correlation: 0.72 } },
    },
    {
      name: "Glide Drills — Shot Put",
      category: "SPE",
      event: "SHOT_PUT",
      implementWeight: null,
      equipment: null,
      defaultSets: 4,
      defaultReps: "6",
      isGlobal: true,
      correlationData: { SHOT_PUT: { correlation: 0.69 } },
    },
    {
      name: "Kettle Bell Rotational Throw",
      category: "SPE",
      event: null,
      implementWeight: null,
      equipment: "kettlebell",
      defaultSets: 4,
      defaultReps: "5",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.55 },
        DISCUS: { correlation: 0.6 },
        HAMMER: { correlation: 0.52 },
        JAVELIN: { correlation: 0.38 },
      },
    },
    {
      name: "Approach Run Drills — Javelin",
      category: "SPE",
      event: "JAVELIN",
      implementWeight: null,
      equipment: null,
      defaultSets: 4,
      defaultReps: "6",
      isGlobal: true,
      correlationData: { JAVELIN: { correlation: 0.7 } },
    },

    // ─── General Preparatory (GPE) ──────────────────────────────────
    {
      name: "Back Squat",
      category: "GPE",
      event: null,
      implementWeight: null,
      equipment: "barbell",
      defaultSets: 4,
      defaultReps: "5",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.58 },
        DISCUS: { correlation: 0.52 },
        HAMMER: { correlation: 0.55 },
        JAVELIN: { correlation: 0.42 },
      },
    },
    {
      name: "Power Clean",
      category: "GPE",
      event: null,
      implementWeight: null,
      equipment: "barbell",
      defaultSets: 5,
      defaultReps: "3",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.65 },
        DISCUS: { correlation: 0.6 },
        HAMMER: { correlation: 0.62 },
        JAVELIN: { correlation: 0.55 },
      },
    },
    {
      name: "Bench Press",
      category: "GPE",
      event: null,
      implementWeight: null,
      equipment: "barbell",
      defaultSets: 4,
      defaultReps: "5",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.48 },
        DISCUS: { correlation: 0.35 },
        HAMMER: { correlation: 0.3 },
        JAVELIN: { correlation: 0.4 },
      },
    },
    {
      name: "Romanian Deadlift",
      category: "GPE",
      event: null,
      implementWeight: null,
      equipment: "barbell",
      defaultSets: 3,
      defaultReps: "8",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.42 },
        DISCUS: { correlation: 0.45 },
        HAMMER: { correlation: 0.48 },
        JAVELIN: { correlation: 0.5 },
      },
    },
    {
      name: "Weighted Box Jump",
      category: "GPE",
      event: null,
      implementWeight: null,
      equipment: "bodyweight",
      defaultSets: 4,
      defaultReps: "5",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.52 },
        DISCUS: { correlation: 0.48 },
        HAMMER: { correlation: 0.45 },
        JAVELIN: { correlation: 0.5 },
      },
    },
    {
      name: "Barbell Snatch",
      category: "GPE",
      event: null,
      implementWeight: null,
      equipment: "barbell",
      defaultSets: 5,
      defaultReps: "2",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.6 },
        DISCUS: { correlation: 0.58 },
        HAMMER: { correlation: 0.55 },
        JAVELIN: { correlation: 0.52 },
      },
    },
    {
      name: "Front Squat",
      category: "GPE",
      event: null,
      implementWeight: null,
      equipment: "barbell",
      defaultSets: 4,
      defaultReps: "3",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.55 },
        DISCUS: { correlation: 0.5 },
        HAMMER: { correlation: 0.52 },
        JAVELIN: { correlation: 0.4 },
      },
    },
    {
      name: "Incline Dumbbell Press",
      category: "GPE",
      event: null,
      implementWeight: null,
      equipment: "dumbbell",
      defaultSets: 3,
      defaultReps: "10",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.38 },
        DISCUS: { correlation: 0.3 },
        HAMMER: { correlation: 0.25 },
        JAVELIN: { correlation: 0.35 },
      },
    },
    {
      name: "Overhead Press",
      category: "GPE",
      event: null,
      implementWeight: null,
      equipment: "barbell",
      defaultSets: 4,
      defaultReps: "5",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.5 },
        DISCUS: { correlation: 0.38 },
        HAMMER: { correlation: 0.32 },
        JAVELIN: { correlation: 0.45 },
      },
    },
    {
      name: "Hip Thrust",
      category: "GPE",
      event: null,
      implementWeight: null,
      equipment: "barbell",
      defaultSets: 3,
      defaultReps: "8",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.4 },
        DISCUS: { correlation: 0.42 },
        HAMMER: { correlation: 0.45 },
        JAVELIN: { correlation: 0.38 },
      },
    },
    {
      name: "Bulgarian Split Squat",
      category: "GPE",
      event: null,
      implementWeight: null,
      equipment: "dumbbell",
      defaultSets: 3,
      defaultReps: "8",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.35 },
        DISCUS: { correlation: 0.38 },
        HAMMER: { correlation: 0.4 },
        JAVELIN: { correlation: 0.42 },
      },
    },
    {
      name: "Snatch Pull",
      category: "GPE",
      event: null,
      implementWeight: null,
      equipment: "barbell",
      defaultSets: 4,
      defaultReps: "3",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.55 },
        DISCUS: { correlation: 0.52 },
        HAMMER: { correlation: 0.5 },
        JAVELIN: { correlation: 0.48 },
      },
    },
    {
      name: "Plank Hold",
      category: "GPE",
      event: null,
      implementWeight: null,
      equipment: "bodyweight",
      defaultSets: 3,
      defaultReps: "60s",
      isGlobal: true,
      correlationData: {
        SHOT_PUT: { correlation: 0.2 },
        DISCUS: { correlation: 0.22 },
        HAMMER: { correlation: 0.18 },
        JAVELIN: { correlation: 0.25 },
      },
    },
  ];

  const exercises = [];
  for (const ex of exerciseData) {
    const exercise = await prisma.exercise.create({
      data: {
        coachId: coachProfile.id,
        name: ex.name,
        category: ex.category,
        event: ex.event,
        implementWeight: ex.implementWeight,
        equipment: ex.equipment,
        defaultSets: ex.defaultSets,
        defaultReps: ex.defaultReps,
        isGlobal: ex.isGlobal,
        correlationData: ex.correlationData ?? undefined,
      },
    });
    exercises.push(exercise);
  }
  console.log(`  ✓ ${exercises.length} exercises created\n`);

  // ─── 3b. GLOBAL DRILLS ─────────────────────────────────────────────────

  const drillData: Array<{
    name: string;
    description: string;
    event: "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN" | null;
    category: "CE" | "SDE" | "SPE" | "GPE";
    implementKg: number | null;
    difficulty: string;
    cues: string[];
    athleteTypes: Array<"EXPLOSIVE" | "SPEED_STRENGTH" | "STRENGTH_SPEED" | "STRENGTH">;
  }> = [
    // Shot Put drills
    {
      name: "Standing Throw (Power Position)",
      description:
        "Shot put from power position with full hip extension. Develops the critical last phase of the throw.",
      event: "SHOT_PUT",
      category: "SDE",
      implementKg: 7.26,
      difficulty: "beginner",
      cues: [
        "Tall finish",
        "Drive through the ball",
        "Thumb down at release",
        "Hips through before arm",
      ],
      athleteTypes: ["EXPLOSIVE", "SPEED_STRENGTH", "STRENGTH_SPEED", "STRENGTH"],
    },
    {
      name: "Glide to Power Position",
      description:
        "Half-glide stopping at power position before throwing. Reinforces timing and sequencing.",
      event: "SHOT_PUT",
      category: "SDE",
      implementKg: 7.26,
      difficulty: "intermediate",
      cues: [
        "Low and long glide",
        "Land in power position",
        "Pause and feel balance",
        "Drive and release",
      ],
      athleteTypes: ["SPEED_STRENGTH", "STRENGTH_SPEED", "STRENGTH"],
    },
    {
      name: "Shot Put Wheel Drill",
      description:
        "Continuous rotational drill for rotational shot putters. Develops feel for rotational momentum transfer.",
      event: "SHOT_PUT",
      category: "SDE",
      implementKg: 7.26,
      difficulty: "advanced",
      cues: ["Stay over the left", "Sweep don't jump", "Keep shot close to neck", "Long left side"],
      athleteTypes: ["EXPLOSIVE", "SPEED_STRENGTH"],
    },
    {
      name: "Overhead Back Toss",
      description:
        "Two-hand overhead backward toss for power development. Full extension chain from legs through upper body.",
      event: "SHOT_PUT",
      category: "SPE",
      implementKg: 7.26,
      difficulty: "beginner",
      cues: ["Deep squat start", "Full hip extension", "Arms follow body", "Throw up and back"],
      athleteTypes: ["EXPLOSIVE", "SPEED_STRENGTH", "STRENGTH_SPEED", "STRENGTH"],
    },

    // Discus drills
    {
      name: "South African Drill",
      description:
        "180° turn drill for discus. Develops the critical hip-shoulder separation at the front of the ring.",
      event: "DISCUS",
      category: "SDE",
      implementKg: 2.0,
      difficulty: "intermediate",
      cues: ["Left foot pivot", "Right hip leads", "Long right arm", "Stay level"],
      athleteTypes: ["EXPLOSIVE", "SPEED_STRENGTH", "STRENGTH_SPEED"],
    },
    {
      name: "Bowling Drill",
      description:
        "Low release point drill emphasizing proper hand position and spin. Throw discus low and flat.",
      event: "DISCUS",
      category: "SPE",
      implementKg: 2.0,
      difficulty: "beginner",
      cues: ["Index finger last", "Flat and level", "Roll off fingers", "Keep palm down"],
      athleteTypes: ["EXPLOSIVE", "SPEED_STRENGTH", "STRENGTH_SPEED", "STRENGTH"],
    },
    {
      name: "Standing Discus Throw",
      description:
        "Discus throw from standing position facing 90° to target. Develops hip lead and long arm path.",
      event: "DISCUS",
      category: "SDE",
      implementKg: 2.0,
      difficulty: "beginner",
      cues: ["Wide power position", "Hip before arm", "Long sweep", "High finish"],
      athleteTypes: ["EXPLOSIVE", "SPEED_STRENGTH", "STRENGTH_SPEED", "STRENGTH"],
    },
    {
      name: "Half Turn to Full",
      description:
        "Begin with half turn, add momentum progressively to full throw. Technical bridge drill.",
      event: "DISCUS",
      category: "SDE",
      implementKg: 2.0,
      difficulty: "intermediate",
      cues: ["Controlled entry", "Build speed across ring", "Stay grounded", "Left block at front"],
      athleteTypes: ["SPEED_STRENGTH", "STRENGTH_SPEED"],
    },

    // Hammer drills
    {
      name: "Winds Only",
      description:
        "Hammer wind practice with no turns. Develops entry speed, rhythm, and hammer plane control.",
      event: "HAMMER",
      category: "SPE",
      implementKg: 7.26,
      difficulty: "beginner",
      cues: [
        "Push-pull rhythm",
        "High and low points consistent",
        "Relax arms",
        "Counter the hammer",
      ],
      athleteTypes: ["EXPLOSIVE", "SPEED_STRENGTH", "STRENGTH_SPEED", "STRENGTH"],
    },
    {
      name: "Single Turn Release",
      description: "One full turn with release. Focus on heel-toe footwork and maintaining orbit.",
      event: "HAMMER",
      category: "SDE",
      implementKg: 7.26,
      difficulty: "beginner",
      cues: ["Right foot catches left", "Long left side", "Stay behind the hammer", "Quick feet"],
      athleteTypes: ["EXPLOSIVE", "SPEED_STRENGTH", "STRENGTH_SPEED", "STRENGTH"],
    },
    {
      name: "Three-Turn Build-Up",
      description:
        "Progressive three-turn throw. Each turn should accelerate. Focus on building radius and speed.",
      event: "HAMMER",
      category: "SDE",
      implementKg: 7.26,
      difficulty: "intermediate",
      cues: [
        "Accelerate each turn",
        "Longer radius each turn",
        "Low point moves right to left",
        "Explosive finish",
      ],
      athleteTypes: ["SPEED_STRENGTH", "STRENGTH_SPEED", "STRENGTH"],
    },
    {
      name: "Hammer Seated Throws",
      description:
        "Throw hammer from seated position on bench. Isolates upper body contribution and timing.",
      event: "HAMMER",
      category: "SPE",
      implementKg: 7.26,
      difficulty: "intermediate",
      cues: [
        "Wide base on bench",
        "Two winds then release",
        "Trunk rotation only",
        "Feel the orbit",
      ],
      athleteTypes: ["EXPLOSIVE", "SPEED_STRENGTH"],
    },

    // Javelin drills
    {
      name: "Standing Javelin Throw",
      description:
        "Throw from standing position with block step. Develops arm path, block, and release angle.",
      event: "JAVELIN",
      category: "SDE",
      implementKg: 0.8,
      difficulty: "beginner",
      cues: ["Elbow high", "Throw through the tip", "Block with left side", "Palm up at release"],
      athleteTypes: ["EXPLOSIVE", "SPEED_STRENGTH", "STRENGTH_SPEED", "STRENGTH"],
    },
    {
      name: "3-Step Approach Throw",
      description:
        "Short approach throw to develop rhythm and connection between run-up and delivery.",
      event: "JAVELIN",
      category: "SDE",
      implementKg: 0.8,
      difficulty: "intermediate",
      cues: ["Cross-step drives hips", "Stay tall through cross", "Block hard", "Tip leads"],
      athleteTypes: ["EXPLOSIVE", "SPEED_STRENGTH", "STRENGTH_SPEED"],
    },
    {
      name: "Javelin Ball Throws",
      description:
        "Use weighted ball (600-800g) to develop throwing speed and arm path. Higher volume than javelin.",
      event: "JAVELIN",
      category: "SPE",
      implementKg: null,
      difficulty: "beginner",
      cues: ["Same arm path as javelin", "High elbow", "Full body rotation", "Release at peak"],
      athleteTypes: ["EXPLOSIVE", "SPEED_STRENGTH", "STRENGTH_SPEED", "STRENGTH"],
    },
    {
      name: "Withdrawal Run-Through",
      description:
        "Full approach run without release. Develops withdrawal timing and running mechanics with javelin.",
      event: "JAVELIN",
      category: "SPE",
      implementKg: 0.8,
      difficulty: "intermediate",
      cues: ["Smooth withdrawal", "Hips stay forward", "Javelin stays close", "Maintain speed"],
      athleteTypes: ["SPEED_STRENGTH", "STRENGTH_SPEED"],
    },

    // Cross-event / general
    {
      name: "Medicine Ball Rotational Slam",
      description:
        "Explosive rotational medicine ball slam. Develops rotational power for all throwing events.",
      event: null,
      category: "SPE",
      implementKg: null,
      difficulty: "beginner",
      cues: [
        "Load the hips",
        "Rotate through core",
        "Slam down and through",
        "Full extension at release",
      ],
      athleteTypes: ["EXPLOSIVE", "SPEED_STRENGTH", "STRENGTH_SPEED", "STRENGTH"],
    },
    {
      name: "Single Leg Box Bounds",
      description:
        "Plyometric bounding on and off boxes. Develops single-leg power critical for ring/runway events.",
      event: null,
      category: "GPE",
      implementKg: null,
      difficulty: "intermediate",
      cues: ["Drive knee up", "Land soft", "Quick ground contact", "Arm drive"],
      athleteTypes: ["EXPLOSIVE", "SPEED_STRENGTH"],
    },
  ];

  for (const drill of drillData) {
    await prisma.drill.create({
      data: {
        coachId: null, // Global drills
        name: drill.name,
        description: drill.description,
        event: drill.event,
        category: drill.category,
        implementKg: drill.implementKg,
        difficulty: drill.difficulty,
        cues: drill.cues,
        athleteTypes: drill.athleteTypes,
        isGlobal: true,
      },
    });
  }
  console.log(`  ✓ ${drillData.length} global drills created\n`);

  // ─── 4. WORKOUT PLANS ──────────────────────────────────────────────────

  const planConfigs = [
    {
      name: "Shot Put — Heavy Day",
      event: "SHOT_PUT" as const,
      blocks: [
        {
          name: "Throwing Block 1 — Heavy Implements",
          blockType: "throwing",
          order: 1,
          restSeconds: 180,
          exercises: [
            { name: "Heavy Shot Put (9kg)", sets: 6, reps: "1", implementKg: 9.0 },
            { name: "Heavy Shot Put (8kg)", sets: 6, reps: "1", implementKg: 8.0 },
          ],
        },
        {
          name: "Strength Block",
          blockType: "strength",
          order: 2,
          restSeconds: 120,
          exercises: [
            { name: "Back Squat", sets: 4, reps: "3", weight: "85%" },
            { name: "Bench Press", sets: 4, reps: "5", weight: "80%" },
          ],
        },
        {
          name: "Throwing Block 2 — Competition Weight",
          blockType: "throwing",
          order: 3,
          restSeconds: 180,
          exercises: [
            { name: "Full Shot Put (Competition)", sets: 8, reps: "1", implementKg: 7.26 },
          ],
        },
      ],
    },
    {
      name: "Hammer — Technical Day",
      event: "HAMMER" as const,
      blocks: [
        {
          name: "Throwing Block 1 — Heavy",
          blockType: "throwing",
          order: 1,
          restSeconds: 180,
          exercises: [
            { name: "Heavy Hammer (9kg)", sets: 5, reps: "1", implementKg: 9.0 },
            { name: "Heavy Hammer (8kg)", sets: 5, reps: "1", implementKg: 8.0 },
          ],
        },
        {
          name: "Strength Block",
          blockType: "strength",
          order: 2,
          restSeconds: 120,
          exercises: [
            { name: "Power Clean", sets: 5, reps: "2", weight: "80%" },
            { name: "Front Squat", sets: 4, reps: "3", weight: "82%" },
          ],
        },
        {
          name: "Throwing Block 2 — Competition",
          blockType: "throwing",
          order: 3,
          restSeconds: 180,
          exercises: [
            { name: "Full Hammer Throw (Competition)", sets: 8, reps: "1", implementKg: 7.26 },
            { name: "3-Turn Hammer", sets: 4, reps: "1", implementKg: 7.26 },
          ],
        },
      ],
    },
    {
      name: "General Strength Session",
      event: null,
      blocks: [
        {
          name: "Primary Lifts",
          blockType: "strength",
          order: 1,
          restSeconds: 180,
          exercises: [
            { name: "Back Squat", sets: 5, reps: "5", weight: "80%" },
            { name: "Power Clean", sets: 5, reps: "3", weight: "75%" },
          ],
        },
        {
          name: "Accessory Work",
          blockType: "strength",
          order: 2,
          restSeconds: 90,
          exercises: [
            { name: "Romanian Deadlift", sets: 3, reps: "8", weight: "70%" },
            { name: "Incline Dumbbell Press", sets: 3, reps: "10", weight: "60%" },
            { name: "Weighted Box Jump", sets: 4, reps: "5" },
          ],
        },
      ],
    },
  ];

  const workoutPlans = [];
  for (const planConfig of planConfigs) {
    const plan = await prisma.workoutPlan.create({
      data: {
        coachId: coachProfile.id,
        name: planConfig.name,
        event: planConfig.event,
        isTemplate: true,
      },
    });

    for (const blockConfig of planConfig.blocks) {
      const block = await prisma.workoutBlock.create({
        data: {
          planId: plan.id,
          name: blockConfig.name,
          order: blockConfig.order,
          blockType: blockConfig.blockType,
          restSeconds: blockConfig.restSeconds,
        },
      });

      for (let i = 0; i < blockConfig.exercises.length; i++) {
        const exConfig = blockConfig.exercises[i];
        const exercise = exercises.find((e) => e.name === exConfig.name);
        if (exercise) {
          await prisma.blockExercise.create({
            data: {
              blockId: block.id,
              exerciseId: exercise.id,
              order: i + 1,
              sets: exConfig.sets,
              reps: exConfig.reps,
              weight: "weight" in exConfig ? (exConfig as { weight: string }).weight : undefined,
              implementKg:
                "implementKg" in exConfig
                  ? (exConfig as { implementKg: number }).implementKg
                  : undefined,
            },
          });
        }
      }
    }

    workoutPlans.push(plan);
  }
  console.log(`  ✓ ${workoutPlans.length} workout plans created\n`);

  // ─── 5. TRAINING SESSIONS & LOGS ────────────────────────────────────────

  // Throw distance ranges by event, gender, and quality
  const throwRanges: Record<
    string,
    {
      min: number;
      max: number;
      compWeight: number;
      overWeight: number;
      underWeight: number;
      overMin: number;
      overMax: number;
      underMin: number;
      underMax: number;
    }
  > = {
    SHOT_PUT_MALE: {
      min: 16.0,
      max: 19.5,
      compWeight: 7.26,
      overWeight: 9.0,
      underWeight: 6.0,
      overMin: 13.5,
      overMax: 16.5,
      underMin: 17.5,
      underMax: 21.0,
    },
    DISCUS_FEMALE: {
      min: 48.0,
      max: 58.0,
      compWeight: 1.0,
      overWeight: 1.25,
      underWeight: 0.75,
      overMin: 42.0,
      overMax: 52.0,
      underMin: 52.0,
      underMax: 62.0,
    },
    HAMMER_MALE: {
      min: 60.0,
      max: 72.0,
      compWeight: 7.26,
      overWeight: 9.0,
      underWeight: 6.0,
      overMin: 52.0,
      overMax: 63.0,
      underMin: 64.0,
      underMax: 75.0,
    },
    JAVELIN_FEMALE: {
      min: 48.0,
      max: 58.0,
      compWeight: 0.6,
      overWeight: 0.7,
      underWeight: 0.5,
      overMin: 42.0,
      overMax: 52.0,
      underMin: 52.0,
      underMax: 62.0,
    },
  };

  for (let aIdx = 0; aIdx < athleteProfiles.length; aIdx++) {
    const athlete = athleteProfiles[aIdx];
    const config = athleteConfigs[aIdx];
    const event = config.events[0];
    const gender = config.gender;
    const rangeKey = `${event}_${gender}`;
    const range = throwRanges[rangeKey];

    // Assign plans: event-specific athletes get matching plan + general strength
    const applicablePlans = workoutPlans.filter((p) => p.event === event || p.event === null);

    // Create 10 training sessions over the past 21 days
    for (let s = 0; s < 10; s++) {
      const dayOffset = Math.floor(s * 2) + randomInt(0, 1);
      const isCompleted = s < 8; // First 8 completed, last 2 scheduled
      const plan = applicablePlans[s % applicablePlans.length];

      const session = await prisma.trainingSession.create({
        data: {
          planId: plan.id,
          athleteId: athlete.id,
          scheduledDate: daysAgo(21 - dayOffset),
          completedDate: isCompleted ? daysAgo(21 - dayOffset) : null,
          status: isCompleted ? "COMPLETED" : "SCHEDULED",
          rpe: isCompleted ? randomBetween(6.0, 9.0, 1) : null,
          notes: isCompleted
            ? pick([
                "Good session overall",
                "Felt strong today",
                "Technical focus, distances were down",
                "Great power output",
                "Recovery session, kept volume low",
                null,
              ])
            : null,
        },
      });

      // Add session logs for completed sessions
      if (isCompleted) {
        // Log 3-5 exercises per session
        const sessionExercises = [
          {
            name: `Full ${event.replace("_", " ")} (Competition)`,
            sets: randomInt(6, 10),
            reps: 1,
            weight: range.compWeight,
            distance: randomBetween(range.min, range.max),
          },
          {
            name: "Back Squat",
            sets: randomInt(3, 5),
            reps: randomInt(3, 5),
            weight: randomBetween(100, 180, 0),
          },
          {
            name: "Power Clean",
            sets: randomInt(3, 5),
            reps: randomInt(2, 3),
            weight: randomBetween(80, 130, 0),
          },
        ];

        if (s % 2 === 0) {
          sessionExercises.push({
            name: "Bench Press",
            sets: randomInt(3, 4),
            reps: randomInt(5, 8),
            weight: randomBetween(70, 120, 0),
            distance: 0,
          });
        }

        for (const ex of sessionExercises) {
          await prisma.sessionLog.create({
            data: {
              sessionId: session.id,
              athleteId: athlete.id,
              exerciseName: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              weight: ex.weight,
              distance: (ex.distance ?? 0) > 0 ? ex.distance : null,
              rpe: randomBetween(6.0, 9.5, 1),
              completedAt: session.completedDate!,
            },
          });
        }
      }
    }

    console.log(`  ✓ 10 training sessions for ${config.firstName} ${config.lastName}`);

    // ─── 6. THROW LOGS (varied implements) ─────────────────────────────

    // Track best per implement weight for proper PR detection
    const bestByImplement: Record<number, number> = {};

    // Competition weight throws (7-10)
    const compThrowCount = randomInt(7, 10);
    for (let t = 0; t < compThrowCount; t++) {
      const dayOffset = randomInt(1, 20);
      const dist = randomBetween(range.min, range.max);
      const prev = bestByImplement[range.compWeight] ?? 0;
      const isPB = dist > prev;
      if (isPB) bestByImplement[range.compWeight] = dist;

      await prisma.throwLog.create({
        data: {
          athleteId: athlete.id,
          event,
          implementWeight: range.compWeight,
          distance: dist,
          date: daysAgo(dayOffset),
          isPersonalBest: isPB && t > 2,
          isCompetition: t % 4 === 0,
          rpe: randomBetween(7.0, 9.5, 1),
          attemptNumber: (t % 6) + 1,
          notes: pick([
            "Smooth release",
            "Good hip rotation",
            "Block was late",
            "Excellent timing",
            "Need to work on left side",
            null,
            null,
          ]),
        },
      });
    }

    // Overweight implement throws (3-5)
    const overThrowCount = randomInt(3, 5);
    for (let t = 0; t < overThrowCount; t++) {
      const dayOffset = randomInt(1, 18);
      const dist = randomBetween(range.overMin, range.overMax);
      const prev = bestByImplement[range.overWeight] ?? 0;
      const isPB = dist > prev;
      if (isPB) bestByImplement[range.overWeight] = dist;

      await prisma.throwLog.create({
        data: {
          athleteId: athlete.id,
          event,
          implementWeight: range.overWeight,
          distance: dist,
          date: daysAgo(dayOffset),
          isPersonalBest: isPB && t > 0,
          isCompetition: false,
          rpe: randomBetween(8.0, 9.5, 1),
          attemptNumber: (t % 4) + 1,
          notes: pick(["Heavy implement work", "Good power output", "Felt strong", null]),
        },
      });
    }

    // Underweight implement throws (3-5)
    const underThrowCount = randomInt(3, 5);
    for (let t = 0; t < underThrowCount; t++) {
      const dayOffset = randomInt(1, 18);
      const dist = randomBetween(range.underMin, range.underMax);
      const prev = bestByImplement[range.underWeight] ?? 0;
      const isPB = dist > prev;
      if (isPB) bestByImplement[range.underWeight] = dist;

      await prisma.throwLog.create({
        data: {
          athleteId: athlete.id,
          event,
          implementWeight: range.underWeight,
          distance: dist,
          date: daysAgo(dayOffset),
          isPersonalBest: isPB && t > 0,
          isCompetition: false,
          rpe: randomBetween(6.5, 8.5, 1),
          attemptNumber: (t % 4) + 1,
          notes: pick(["Speed work", "Quick release", "Good velocity", null]),
        },
      });
    }

    const totalThrows = compThrowCount + overThrowCount + underThrowCount;
    console.log(
      `  ✓ ${totalThrows} throw logs for ${config.firstName} (comp: ${compThrowCount}, over: ${overThrowCount}, under: ${underThrowCount})`
    );
  }
  console.log();

  // ─── 7. READINESS CHECK-INS (14 days per athlete) ─────────────────────

  for (let aIdx = 0; aIdx < athleteProfiles.length; aIdx++) {
    const athlete = athleteProfiles[aIdx];
    const config = athleteConfigs[aIdx];

    for (let day = 0; day < 14; day++) {
      const sleep = randomInt(5, 9);
      const sleepHours = randomBetween(5.5, 9.5, 1);
      const soreness = randomInt(2, 8);
      const stress = randomInt(2, 7);
      const energy = randomInt(4, 9);
      const overall = parseFloat(
        ((sleep + (10 - soreness) + (10 - stress) + energy) / 4).toFixed(1)
      );

      await prisma.readinessCheckIn.create({
        data: {
          athleteId: athlete.id,
          date: daysAgo(day),
          overallScore: Math.min(10, Math.max(1, overall)),
          sleepQuality: sleep,
          sleepHours,
          soreness,
          sorenessArea:
            soreness > 5 ? pick(["lower back", "shoulders", "knees", "hips", "hamstrings"]) : null,
          stressLevel: stress,
          energyMood: energy,
          hydration: pick(["POOR", "ADEQUATE", "GOOD"]),
          injuryStatus: soreness > 7 ? "MONITORING" : "NONE",
          injuryNotes: soreness > 7 ? "Elevated soreness, monitoring closely" : null,
          notes: day === 0 ? "Ready for heavy session" : null,
        },
      });
    }
    console.log(`  ✓ 14 readiness check-ins for ${config.firstName}`);
  }
  console.log();

  // ─── 8. BONDARCHUK ASSESSMENTS ────────────────────────────────────────

  const athleteTypes: Array<"EXPLOSIVE" | "SPEED_STRENGTH" | "STRENGTH_SPEED" | "STRENGTH"> = [
    "SPEED_STRENGTH",
    "EXPLOSIVE",
    "STRENGTH_SPEED",
    "EXPLOSIVE",
  ];

  for (let aIdx = 0; aIdx < athleteProfiles.length; aIdx++) {
    const athlete = athleteProfiles[aIdx];
    const config = athleteConfigs[aIdx];

    await prisma.bondarchukAssessment.create({
      data: {
        athleteId: athlete.id,
        athleteType: athleteTypes[aIdx],
        results: {
          testDate: daysAgo(30).toISOString(),
          exercises: [
            { name: "Full Throw", correlation: randomBetween(0.85, 0.98) },
            { name: "Standing Throw", correlation: randomBetween(0.7, 0.92) },
            { name: "Back Squat", correlation: randomBetween(0.4, 0.75) },
            { name: "Power Clean", correlation: randomBetween(0.5, 0.82) },
            { name: "Bench Press", correlation: randomBetween(0.2, 0.55) },
          ],
          recommendation: `Athlete classified as ${athleteTypes[aIdx]}. Focus on ${
            athleteTypes[aIdx] === "EXPLOSIVE"
              ? "high-velocity training with competition implements"
              : athleteTypes[aIdx] === "SPEED_STRENGTH"
                ? "balanced approach with slight emphasis on speed work"
                : "strength development with progressive speed integration"
          }.`,
        },
        notes: `Initial assessment. ${config.firstName} shows ${athleteTypes[aIdx].toLowerCase().replace("_", "-")} profile.`,
        completedAt: daysAgo(30),
      },
    });
    console.log(`  ✓ Bondarchuk assessment for ${config.firstName}: ${athleteTypes[aIdx]}`);
  }
  console.log();

  // ─── 9. GOALS ─────────────────────────────────────────────────────────

  const goalTemplates = [
    { title: "Season PR", unit: "meters", status: "ACTIVE" as const },
    { title: "Squat Max", unit: "kg", status: "ACTIVE" as const },
    { title: "Competition Qualifying", unit: "meters", status: "ACTIVE" as const },
    { title: "Training Consistency", unit: "sessions", status: "COMPLETED" as const },
  ];

  const goalRanges: Record<string, { target: number; current: number }[]> = {
    SHOT_PUT_MALE: [
      { target: 19.5, current: 18.2 },
      { target: 200, current: 185 },
      { target: 18.0, current: 18.2 },
      { target: 20, current: 20 },
    ],
    DISCUS_FEMALE: [
      { target: 58.0, current: 54.3 },
      { target: 130, current: 118 },
      { target: 52.0, current: 54.3 },
      { target: 20, current: 20 },
    ],
    HAMMER_MALE: [
      { target: 72.0, current: 68.5 },
      { target: 180, current: 165 },
      { target: 65.0, current: 68.5 },
      { target: 20, current: 20 },
    ],
    JAVELIN_FEMALE: [
      { target: 58.0, current: 53.7 },
      { target: 95, current: 85 },
      { target: 52.0, current: 53.7 },
      { target: 20, current: 20 },
    ],
  };

  for (let aIdx = 0; aIdx < athleteProfiles.length; aIdx++) {
    const athlete = athleteProfiles[aIdx];
    const config = athleteConfigs[aIdx];
    const event = config.events[0];
    const rangeKey = `${event}_${config.gender}`;
    const ranges = goalRanges[rangeKey];

    // Create 3 goals per athlete (skip the 4th for some)
    const goalCount = aIdx < 2 ? 3 : 2;
    for (let g = 0; g < goalCount; g++) {
      const template = goalTemplates[g];
      const range = ranges[g];

      await prisma.goal.create({
        data: {
          athleteId: athlete.id,
          title: `${template.title} — ${event.replace("_", " ")}`,
          targetValue: range.target,
          currentValue: range.current,
          unit: template.unit,
          event: g < 3 ? event : null,
          deadline: g < 3 ? new Date("2026-06-15") : null,
          status: template.status,
        },
      });
    }
    console.log(`  ✓ ${goalCount} goals for ${config.firstName}`);
  }
  console.log();

  // ─── 10. ACHIEVEMENTS ─────────────────────────────────────────────────

  for (let aIdx = 0; aIdx < athleteProfiles.length; aIdx++) {
    const athlete = athleteProfiles[aIdx];
    const config = athleteConfigs[aIdx];
    const event = config.events[0];

    const achievements: Array<{
      type: AchievementType;
      title: string;
      description: string;
      earnedAt: Date;
    }> = [
      {
        type: "PERSONAL_BEST",
        title: `New ${event.replace("_", " ")} PR!`,
        description: "Set a new personal record in training.",
        earnedAt: daysAgo(randomInt(3, 15)),
      },
      {
        type: "STREAK",
        title: "7-Day Training Streak",
        description: "Completed training for 7 consecutive days.",
        earnedAt: daysAgo(randomInt(5, 20)),
      },
      {
        type: "TRAINING",
        title: "First Assessment Complete",
        description: "Completed the Bondarchuk athlete type assessment.",
        earnedAt: daysAgo(30),
      },
    ];

    if (aIdx === 0) {
      achievements.push({
        type: "MILESTONE",
        title: "50 Training Sessions",
        description: "Logged 50 total training sessions.",
        earnedAt: daysAgo(2),
      });
    }

    for (const ach of achievements) {
      await prisma.achievement.create({
        data: {
          athleteId: athlete.id,
          type: ach.type,
          title: ach.title,
          description: ach.description,
          earnedAt: ach.earnedAt,
        },
      });
    }
    console.log(`  ✓ ${achievements.length} achievements for ${config.firstName}`);
  }
  console.log();

  // ─── 11. QUESTIONNAIRE ────────────────────────────────────────────────

  const questionnaire = await prisma.questionnaire.create({
    data: {
      coachId: coachProfile.id,
      title: "Weekly Athlete Check-In",
      type: "CHECK_IN",
      questions: [
        {
          id: "q1",
          text: "How is your body feeling this week?",
          type: "scale",
          options: { min: 1, max: 10 },
          required: true,
        },
        { id: "q2", text: "Any new aches or pains?", type: "text", required: false },
        {
          id: "q3",
          text: "How confident are you in your technique right now?",
          type: "scale",
          options: { min: 1, max: 10 },
          required: true,
        },
        { id: "q4", text: "What's your top priority for next week?", type: "text", required: true },
      ],
      isActive: true,
    },
  });

  // Create responses for first 2 athletes
  for (let aIdx = 0; aIdx < 2; aIdx++) {
    const athlete = athleteProfiles[aIdx];
    await prisma.questionnaireResponse.create({
      data: {
        questionnaireId: questionnaire.id,
        athleteId: athlete.id,
        answers: [
          {
            questionId: "q1",
            questionText: "How is your body feeling this week?",
            answer: randomInt(6, 9),
          },
          {
            questionId: "q2",
            questionText: "Any new aches or pains?",
            answer: pick([
              "No, feeling good",
              "Slight tightness in right shoulder",
              "Minor knee soreness after heavy squats",
            ]),
          },
          {
            questionId: "q3",
            questionText: "How confident are you in your technique right now?",
            answer: randomInt(6, 9),
          },
          {
            questionId: "q4",
            questionText: "What's your top priority for next week?",
            answer: pick([
              "Improve release angle",
              "Hit 3 sessions minimum",
              "Work on footwork in the ring",
            ]),
          },
        ],
        completedAt: daysAgo(2),
      },
    });
  }
  console.log("  ✓ 1 questionnaire + 2 responses created\n");

  // ─── 12. EVENT GROUP ─────────────────────────────────────────────────

  const group = await prisma.eventGroup.create({
    data: {
      coachId: coachProfile.id,
      name: "Oregon Throws Squad",
      description: "All varsity throwers for the 2025-2026 season.",
    },
  });

  for (const athlete of athleteProfiles) {
    await prisma.eventGroupMember.create({
      data: {
        groupId: group.id,
        athleteId: athlete.id,
      },
    });
  }
  console.log("  ✓ Event Group 'Oregon Throws Squad' with 4 members\n");

  // ─── 13. INVITATION ──────────────────────────────────────────────────

  await prisma.invitation.create({
    data: {
      coachId: coachProfile.id,
      email: "newathlete@example.com",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("  ✓ 1 pending invitation created\n");

  console.log("🏆 Seed complete! Database is ready.\n");
  console.log("  Test accounts:");
  console.log("    Coach:     coach@example.com / coach123");
  console.log("    Athlete 1: athlete1@example.com / athlete123");
  console.log("    Athlete 2: athlete2@example.com / athlete123");
  console.log("    Athlete 3: athlete3@example.com / athlete123");
  console.log("    Athlete 4: athlete4@example.com / athlete123\n");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
