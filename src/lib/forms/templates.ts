/**
 * Built-in form templates for Podium Throws.
 * Each template is a complete FormTemplateDefinition ready to load into the builder.
 */

import type {
  FormTemplateDefinition,
  FormBlock,
  ConditionalRule,
  ScoringConfig,
} from "./types";

// ─── Helper to generate block IDs ──────────────────────────────────────────

let _counter = 0;
function bid(prefix: string): string {
  _counter++;
  return `tpl_${prefix}_${_counter}`;
}

// Reset counter between templates
function resetIds() {
  _counter = 0;
}

// ─── 1. PAR-Q Health Screening ──────────────────────────────────────────────

function buildPARQ(): FormTemplateDefinition {
  resetIds();

  const q1 = bid("parq");
  const q2 = bid("parq");
  const q3 = bid("parq");
  const q4 = bid("parq");
  const q5 = bid("parq");
  const q6 = bid("parq");
  const q7 = bid("parq");
  const followup = bid("parq");

  const blocks: FormBlock[] = [
    {
      id: q1,
      type: "yes_no",
      label: "Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?",
      required: true,
      order: 0,
    },
    {
      id: q2,
      type: "yes_no",
      label: "Do you feel pain in your chest when you do physical activity?",
      required: true,
      order: 1,
    },
    {
      id: q3,
      type: "yes_no",
      label: "In the past month, have you had chest pain when you were not doing physical activity?",
      required: true,
      order: 2,
    },
    {
      id: q4,
      type: "yes_no",
      label: "Do you lose your balance because of dizziness or do you ever lose consciousness?",
      required: true,
      order: 3,
    },
    {
      id: q5,
      type: "yes_no",
      label: "Do you have a bone or joint problem that could be made worse by a change in your physical activity?",
      required: true,
      order: 4,
    },
    {
      id: q6,
      type: "yes_no",
      label: "Is your doctor currently prescribing drugs for your blood pressure or heart condition?",
      required: true,
      order: 5,
    },
    {
      id: q7,
      type: "yes_no",
      label: "Do you know of any other reason why you should not do physical activity?",
      required: true,
      order: 6,
    },
    {
      id: followup,
      type: "long_text",
      label: "Please describe any health conditions or concerns in detail:",
      required: false,
      order: 7,
      placeholder: "Describe your condition(s)...",
      rows: 4,
    },
  ];

  // Show followup if ANY question is answered "yes"
  const conditionalLogic: ConditionalRule[] = [
    {
      id: "rule_parq_followup",
      targetBlockId: followup,
      action: "show",
      conditions: [
        [{ blockId: q1, operator: "is", value: true }],
        [{ blockId: q2, operator: "is", value: true }],
        [{ blockId: q3, operator: "is", value: true }],
        [{ blockId: q4, operator: "is", value: true }],
        [{ blockId: q5, operator: "is", value: true }],
        [{ blockId: q6, operator: "is", value: true }],
        [{ blockId: q7, operator: "is", value: true }],
      ],
    },
  ];

  return {
    key: "parq_health_screening",
    name: "PAR-Q Health Screening",
    description: "Standard 7-question health screening with conditional follow-ups for flagged conditions.",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    type: "ONBOARDING",
    displayMode: "ONE_PER_PAGE",
    blocks,
    scoringEnabled: false,
    conditionalLogic,
  };
}

// ─── 2. Daily Readiness Check-in ────────────────────────────────────────────

function buildDailyReadiness(): FormTemplateDefinition {
  resetIds();

  const sleepHours = bid("ready");
  const sleepQuality = bid("ready");
  const soreness = bid("ready");
  const stress = bid("ready");
  const energy = bid("ready");
  const hydration = bid("ready");
  const injury = bid("ready");
  const notes = bid("ready");

  const blocks: FormBlock[] = [
    {
      id: sleepHours,
      type: "number",
      label: "Hours of Sleep",
      description: "How many hours did you sleep last night?",
      required: true,
      order: 0,
      min: 0,
      max: 24,
      unit: "hours",
    },
    {
      id: sleepQuality,
      type: "scale_1_5",
      label: "Sleep Quality",
      description: "How would you rate your sleep quality?",
      required: true,
      order: 1,
      lowLabel: "Very poor",
      highLabel: "Excellent",
    },
    {
      id: soreness,
      type: "body_map",
      label: "Muscle Soreness",
      description: "Tap any areas where you feel soreness or pain.",
      required: false,
      order: 2,
      allowMultiple: true,
      severityScale: true,
    },
    {
      id: stress,
      type: "scale_1_5",
      label: "Stress Level",
      description: "How stressed are you feeling today?",
      required: true,
      order: 3,
      lowLabel: "Very low",
      highLabel: "Very high",
    },
    {
      id: energy,
      type: "scale_1_5",
      label: "Energy Level",
      description: "How energized do you feel right now?",
      required: true,
      order: 4,
      lowLabel: "Exhausted",
      highLabel: "Full energy",
    },
    {
      id: hydration,
      type: "single_choice",
      label: "Hydration Status",
      description: "How well hydrated do you feel?",
      required: true,
      order: 5,
      options: [
        { id: "h1", label: "Dehydrated", value: "dehydrated" },
        { id: "h2", label: "Slightly dehydrated", value: "slightly_dehydrated" },
        { id: "h3", label: "Well hydrated", value: "well_hydrated" },
        { id: "h4", label: "Very well hydrated", value: "very_well_hydrated" },
      ],
    },
    {
      id: injury,
      type: "yes_no",
      label: "Any New Injury or Pain?",
      description: "Are you experiencing any new injury or pain since your last check-in?",
      required: true,
      order: 6,
    },
    {
      id: notes,
      type: "long_text",
      label: "Additional Notes",
      description: "Anything else your coach should know?",
      required: false,
      order: 7,
      placeholder: "Optional notes...",
      rows: 3,
    },
  ];

  const scoringRules: ScoringConfig = {
    rules: [
      { blockId: sleepQuality, maxPoints: 5 },
      { blockId: stress, maxPoints: 5, invertScale: true },
      { blockId: energy, maxPoints: 5 },
    ],
    composite: {
      name: "Readiness Score",
      formula: "average",
    },
  };

  return {
    key: "daily_readiness",
    name: "Daily Readiness Check-in",
    description: "Track sleep, soreness, stress, energy, and hydration with a composite readiness score.",
    icon: "M22 12h-4l-3 9L9 3l-3 9H2",
    type: "READINESS",
    displayMode: "ONE_PER_PAGE",
    blocks,
    scoringEnabled: true,
    scoringRules,
    suggestedRecurrence: {
      frequency: "DAILY",
      assignToAll: true,
    },
  };
}

// ─── 3. Competition Prep ────────────────────────────────────────────────────

function buildCompetitionPrep(): FormTemplateDefinition {
  resetIds();

  const blocks: FormBlock[] = [
    {
      id: bid("comp"),
      type: "single_choice",
      label: "Event",
      required: true,
      order: 0,
      options: [
        { id: "sp", label: "Shot Put", value: "shot_put" },
        { id: "disc", label: "Discus", value: "discus" },
        { id: "ham", label: "Hammer", value: "hammer" },
        { id: "jav", label: "Javelin", value: "javelin" },
      ],
    },
    {
      id: bid("comp"),
      type: "distance",
      label: "Target Distance",
      description: "What distance are you aiming for?",
      required: true,
      order: 1,
      unit: "meters",
    },
    {
      id: bid("comp"),
      type: "implement_select",
      label: "Competition Implement",
      description: "Which implement will you be using?",
      required: true,
      order: 2,
      event: "SHOT_PUT",
      gender: "MALE",
    },
    {
      id: bid("comp"),
      type: "likert",
      label: "Mental Readiness",
      description: "How mentally prepared do you feel for this competition?",
      required: true,
      order: 3,
      scale: [
        "Not at all prepared",
        "Slightly prepared",
        "Moderately prepared",
        "Well prepared",
        "Extremely prepared",
      ],
    },
    {
      id: bid("comp"),
      type: "long_text",
      label: "Warm-up Plan",
      description: "Describe your planned warm-up routine.",
      required: false,
      order: 4,
      placeholder: "Warm-up details...",
      rows: 4,
    },
    {
      id: bid("comp"),
      type: "ranking",
      label: "Technique Focus Priority",
      description: "Rank these technique cues in order of priority for this competition.",
      required: false,
      order: 5,
      items: [
        { id: "r1", label: "Power position" },
        { id: "r2", label: "Release angle" },
        { id: "r3", label: "Left side block" },
        { id: "r4", label: "Hip drive" },
        { id: "r5", label: "Acceleration through ring" },
      ],
    },
    {
      id: bid("comp"),
      type: "short_text",
      label: "Personal Mantra",
      description: "What is your go-to mental cue or mantra for competition?",
      required: false,
      order: 6,
      placeholder: "e.g., 'Fast and tall'",
    },
  ];

  return {
    key: "competition_prep",
    name: "Competition Prep",
    description: "Pre-competition questionnaire covering event details, mental readiness, warm-up plans, and technique priorities.",
    icon: "M6 9l6-6 6 6M6 15l6 6 6-6",
    type: "COMPETITION",
    displayMode: "ONE_PER_PAGE",
    blocks,
    scoringEnabled: false,
  };
}

// ─── 4. Injury Status Report ────────────────────────────────────────────────

function buildInjuryReport(): FormTemplateDefinition {
  resetIds();

  const bodyMapId = bid("inj");
  const painLevel = bid("inj");
  const limitations = bid("inj");
  const photo = bid("inj");
  const notes = bid("inj");
  const warning = bid("inj");

  const blocks: FormBlock[] = [
    {
      id: bodyMapId,
      type: "body_map",
      label: "Injury Location",
      description: "Tap the area(s) where you are experiencing pain or injury.",
      required: true,
      order: 0,
      allowMultiple: true,
      severityScale: true,
    },
    {
      id: painLevel,
      type: "slider",
      label: "Pain Level",
      description: "Rate your current pain level.",
      required: true,
      order: 1,
      min: 0,
      max: 10,
      step: 1,
    },
    {
      id: warning,
      type: "section_header",
      label: "Immediate attention may be needed",
      title: "Immediate attention may be needed",
      subtitle: "Your pain level is 7 or higher. Please contact your athletic trainer immediately.",
      required: false as const,
      order: 2,
    },
    {
      id: limitations,
      type: "multiple_choice",
      label: "Current Limitations",
      description: "Select all activities affected by this injury.",
      required: true,
      order: 3,
      options: [
        { id: "lim1", label: "Throwing", value: "throwing" },
        { id: "lim2", label: "Running", value: "running" },
        { id: "lim3", label: "Lifting (upper body)", value: "lifting_upper" },
        { id: "lim4", label: "Lifting (lower body)", value: "lifting_lower" },
        { id: "lim5", label: "Daily activities", value: "daily" },
        { id: "lim6", label: "None — can train normally", value: "none" },
      ],
    },
    {
      id: photo,
      type: "photo_upload",
      label: "Photo of Injury (optional)",
      description: "Upload a photo if applicable.",
      required: false,
      order: 4,
      prompt: "Take or upload a photo of the injury",
    },
    {
      id: notes,
      type: "long_text",
      label: "Description & Notes",
      description: "Describe the injury, how it happened, and any relevant details.",
      required: true,
      order: 5,
      placeholder: "When did this happen? What were you doing?",
      rows: 5,
    },
  ];

  // Show warning section when pain > 7
  const conditionalLogic: ConditionalRule[] = [
    {
      id: "rule_pain_warning",
      targetBlockId: warning,
      action: "show",
      conditions: [
        [{ blockId: painLevel, operator: "greater_than", value: 6 }],
      ],
    },
  ];

  return {
    key: "injury_status",
    name: "Injury Status Report",
    description: "Comprehensive injury reporting with body map, pain scale, photo upload, and conditional warnings.",
    icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4M12 16h.01",
    type: "INJURY",
    displayMode: "ALL_AT_ONCE",
    blocks,
    scoringEnabled: false,
    conditionalLogic,
  };
}

// ─── 5. Post-Session Feedback ───────────────────────────────────────────────

function buildPostSession(): FormTemplateDefinition {
  resetIds();

  const blocks: FormBlock[] = [
    {
      id: bid("post"),
      type: "rpe",
      label: "Session RPE",
      description: "Rate your perceived exertion for today's session.",
      required: true,
      order: 0,
    },
    {
      id: bid("post"),
      type: "distance",
      label: "Best Throw Distance",
      description: "What was your best throw today?",
      required: false,
      order: 1,
      unit: "meters",
    },
    {
      id: bid("post"),
      type: "implement_select",
      label: "Primary Implement Used",
      required: false,
      order: 2,
      event: "SHOT_PUT",
      gender: "MALE",
    },
    {
      id: bid("post"),
      type: "single_choice",
      label: "Session Type",
      required: true,
      order: 3,
      options: [
        { id: "st1", label: "Full throws session", value: "full_throws" },
        { id: "st2", label: "Technical drills only", value: "drills" },
        { id: "st3", label: "Strength training", value: "strength" },
        { id: "st4", label: "Combined (throws + strength)", value: "combined" },
        { id: "st5", label: "Competition", value: "competition" },
      ],
    },
    {
      id: bid("post"),
      type: "scale_1_5",
      label: "Technique Execution",
      description: "How well did you execute your technique today?",
      required: true,
      order: 4,
      lowLabel: "Poor",
      highLabel: "Excellent",
    },
    {
      id: bid("post"),
      type: "long_text",
      label: "Technical Focus & Notes",
      description: "What technique cues were you working on? Any breakthroughs or struggles?",
      required: false,
      order: 5,
      placeholder: "Today I focused on...",
      rows: 4,
    },
    {
      id: bid("post"),
      type: "video_upload",
      label: "Session Video",
      description: "Upload a video from today's session for coach review.",
      required: false,
      order: 6,
      prompt: "Upload a video from today's session",
    },
  ];

  return {
    key: "post_session",
    name: "Post-Session Feedback",
    description: "Capture RPE, throw distances, implements, technique notes, and session video after training.",
    icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
    type: "CHECK_IN",
    displayMode: "ALL_AT_ONCE",
    blocks,
    scoringEnabled: false,
    suggestedRecurrence: {
      frequency: "SPECIFIC_DAYS",
      specificDays: [1, 2, 3, 4, 5], // Weekdays
      assignToAll: true,
    },
  };
}

// ─── 6. Athlete Onboarding ──────────────────────────────────────────────────

function buildAthleteOnboarding(): FormTemplateDefinition {
  resetIds();

  const blocks: FormBlock[] = [
    {
      id: bid("onb"),
      type: "section_header",
      label: "Personal Information",
      title: "Personal Information",
      subtitle: "Let's start with some basic info about you.",
      required: false as const,
      order: 0,
    },
    {
      id: bid("onb"),
      type: "email",
      label: "Email Address",
      required: true,
      order: 1,
      placeholder: "your.email@example.com",
    },
    {
      id: bid("onb"),
      type: "single_choice",
      label: "Primary Event",
      required: true,
      order: 2,
      options: [
        { id: "ev1", label: "Shot Put", value: "shot_put" },
        { id: "ev2", label: "Discus", value: "discus" },
        { id: "ev3", label: "Hammer", value: "hammer" },
        { id: "ev4", label: "Javelin", value: "javelin" },
      ],
    },
    {
      id: bid("onb"),
      type: "multiple_choice",
      label: "Secondary Events",
      description: "Select any other events you compete in.",
      required: false,
      order: 3,
      options: [
        { id: "se1", label: "Shot Put", value: "shot_put" },
        { id: "se2", label: "Discus", value: "discus" },
        { id: "se3", label: "Hammer", value: "hammer" },
        { id: "se4", label: "Javelin", value: "javelin" },
        { id: "se5", label: "Weight Throw (indoor)", value: "weight_throw" },
      ],
    },
    {
      id: bid("onb"),
      type: "section_header",
      label: "Training History",
      title: "Training History",
      subtitle: "Help us understand your background.",
      required: false as const,
      order: 4,
    },
    {
      id: bid("onb"),
      type: "number",
      label: "Years of Throwing Experience",
      required: true,
      order: 5,
      min: 0,
      max: 40,
      unit: "years",
    },
    {
      id: bid("onb"),
      type: "single_choice",
      label: "Competition Level",
      required: true,
      order: 6,
      options: [
        { id: "cl1", label: "High School", value: "high_school" },
        { id: "cl2", label: "College (D3/NAIA)", value: "college_d3" },
        { id: "cl3", label: "College (D1/D2)", value: "college_d1" },
        { id: "cl4", label: "Post-Collegiate", value: "post_collegiate" },
        { id: "cl5", label: "Professional/Elite", value: "professional" },
      ],
    },
    {
      id: bid("onb"),
      type: "distance",
      label: "Personal Best (Primary Event)",
      description: "What is your all-time personal best?",
      required: true,
      order: 7,
      unit: "meters",
    },
    {
      id: bid("onb"),
      type: "section_header",
      label: "Health & Availability",
      title: "Health & Availability",
      required: false as const,
      order: 8,
    },
    {
      id: bid("onb"),
      type: "yes_no",
      label: "Do you have any current injuries?",
      required: true,
      order: 9,
    },
    {
      id: bid("onb"),
      type: "body_map",
      label: "Injury Location(s)",
      description: "Mark any current injury areas.",
      required: false,
      order: 10,
      allowMultiple: true,
      severityScale: true,
    },
    {
      id: bid("onb"),
      type: "long_text",
      label: "Injury History",
      description: "Describe any significant past injuries related to throwing.",
      required: false,
      order: 11,
      placeholder: "List any significant injuries...",
      rows: 4,
    },
    {
      id: bid("onb"),
      type: "long_text",
      label: "Goals",
      description: "What are your throwing goals for this season?",
      required: true,
      order: 12,
      placeholder: "I want to achieve...",
      rows: 3,
    },
    {
      id: bid("onb"),
      type: "multiple_choice",
      label: "Training Availability",
      description: "Which days are you typically available to train?",
      required: true,
      order: 13,
      options: [
        { id: "d1", label: "Monday", value: "monday" },
        { id: "d2", label: "Tuesday", value: "tuesday" },
        { id: "d3", label: "Wednesday", value: "wednesday" },
        { id: "d4", label: "Thursday", value: "thursday" },
        { id: "d5", label: "Friday", value: "friday" },
        { id: "d6", label: "Saturday", value: "saturday" },
        { id: "d7", label: "Sunday", value: "sunday" },
      ],
    },
  ];

  return {
    key: "athlete_onboarding",
    name: "Athlete Onboarding",
    description: "Comprehensive intake form for new athletes: events, training history, PBs, injury history, goals, and availability.",
    icon: "M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 3a4 4 0 100 8 4 4 0 000-8zM20 8v6M23 11h-6",
    type: "ONBOARDING",
    displayMode: "SECTIONED",
    blocks,
    scoringEnabled: false,
  };
}

// ─── Export all templates ────────────────────────────────────────────────────

export const FORM_TEMPLATES: FormTemplateDefinition[] = [
  buildPARQ(),
  buildDailyReadiness(),
  buildCompetitionPrep(),
  buildInjuryReport(),
  buildPostSession(),
  buildAthleteOnboarding(),
];

export function getTemplateByKey(key: string): FormTemplateDefinition | undefined {
  return FORM_TEMPLATES.find((t) => t.key === key);
}
