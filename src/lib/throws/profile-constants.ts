// ── Athlete Profile & Bondarchuk Typing Constants ─────────────────────
// Data constants for the Profile page, Typing system, Check-ins,
// Annual Volume tracking, and Competition Readiness module.

import type { EventCode, GenderCode } from "./constants";

// ── Self-Feeling Scale (Bondarchuk Vol IV) ────────────────────────────

export const SELF_FEELING_SCALE = [
  { value: 1, label: "Very Poor", desc: "CNS inhibition likely", perfExpect: "-5 to -8%" },
  { value: 2, label: "Below Avg", desc: "Partial readiness", perfExpect: "-2 to -5%" },
  { value: 3, label: "Average", desc: "Normal biological noise", perfExpect: "±3-5%" },
  { value: 4, label: "Good", desc: "Excitatory dominance", perfExpect: "+1 to +2%" },
  { value: 5, label: "Excellent", desc: "Peak readiness", perfExpect: "At/near PR" },
] as const;

// ── Sleep Quality Scale ──────────────────────────────────────────────

export const SLEEP_QUALITY_SCALE = [
  { value: 1, label: "Terrible", desc: "Frequent waking, restless" },
  { value: 2, label: "Poor", desc: "Light/broken sleep" },
  { value: 3, label: "Average", desc: "Some tossing, decent rest" },
  { value: 4, label: "Good", desc: "Solid, mostly uninterrupted" },
  { value: 5, label: "Excellent", desc: "Deep, woke refreshed" },
] as const;

// ── Energy Level Scale ───────────────────────────────────────────────

export const ENERGY_SCALE = [
  { value: 1, label: "Exhausted" },
  { value: 2, label: "Very Low" },
  { value: 3, label: "Low" },
  { value: 4, label: "Below Avg" },
  { value: 5, label: "Average" },
  { value: 6, label: "Above Avg" },
  { value: 7, label: "Good" },
  { value: 8, label: "High" },
  { value: 9, label: "Very High" },
  { value: 10, label: "Peak" },
] as const;

// ── Soreness Level Descriptions ──────────────────────────────────────

export const SORENESS_LABELS: Record<number, string> = {
  0: "None",
  1: "Barely noticeable",
  2: "Mild",
  3: "Moderate",
  4: "Uncomfortable",
  5: "Painful",
  6: "Very painful",
  7: "Severe",
  8: "Very severe",
  9: "Nearly unbearable",
  10: "Worst possible",
};

// ── Soreness Zones ────────────────────────────────────────────────────

export const SORENESS_ZONES = [
  { key: "shoulder", label: "Shoulder" },
  { key: "back", label: "Back" },
  { key: "hip", label: "Hip" },
  { key: "knee", label: "Knee" },
  { key: "elbow", label: "Elbow" },
  { key: "wrist", label: "Wrist" },
  { key: "general", label: "General" },
] as const;

export type SorenessZone = (typeof SORENESS_ZONES)[number]["key"];

// ── Adaptation Thresholds ─────────────────────────────────────────────

export const ADAPTATION_THRESHOLDS = {
  group1: { maxSessions: 12, label: "Fast Adapter" },
  group2: { maxSessions: 22, label: "Moderate Adapter" },
  group3: { maxSessions: 999, label: "Slow Adapter" },
} as const;

// ── Annual Volume Targets (Volume IV Tables 6.22-6.33) ────────────────

export interface VolumeTarget {
  competition: number;
  lighter: number;
  heavier: number;
  analogous: number;
  total: number;
}

export const ANNUAL_VOLUME_TARGETS: Record<EventCode, Record<string, VolumeTarget>> = {
  HT: {
    low: { competition: 1200, lighter: 1600, heavier: 1000, analogous: 1000, total: 4800 },
    avg: { competition: 1700, lighter: 1700, heavier: 1700, analogous: 2000, total: 7100 },
    high: { competition: 2600, lighter: 1950, heavier: 1500, analogous: 2500, total: 8550 },
  },
  SP: {
    low: { competition: 1500, lighter: 1500, heavier: 1000, analogous: 4000, total: 8000 },
    avg: { competition: 2500, lighter: 2300, heavier: 2200, analogous: 6500, total: 13500 },
    high: { competition: 3300, lighter: 2000, heavier: 2300, analogous: 7550, total: 15150 },
  },
  DT: {
    low: { competition: 2000, lighter: 2500, heavier: 1500, analogous: 0, total: 6000 },
    avg: { competition: 4000, lighter: 4000, heavier: 3000, analogous: 0, total: 11000 },
    high: { competition: 6000, lighter: 5000, heavier: 5000, analogous: 0, total: 16000 },
  },
  JT: {
    low: { competition: 2000, lighter: 3000, heavier: 1000, analogous: 1500, total: 7500 },
    avg: { competition: 4000, lighter: 2500, heavier: 1700, analogous: 3000, total: 11200 },
    high: { competition: 6000, lighter: 3500, heavier: 2500, analogous: 4000, total: 16000 },
  },
};

// ── Qualification Thresholds ──────────────────────────────────────────

export const QUALIFICATION_THRESHOLDS: Record<
  EventCode,
  Record<GenderCode, { low: [number, number]; avg: [number, number]; high: [number, number] }>
> = {
  HT: {
    M: { low: [0, 55], avg: [55, 65], high: [65, 100] },
    F: { low: [0, 50], avg: [50, 58], high: [58, 100] },
  },
  SP: {
    M: { low: [0, 16], avg: [16, 19], high: [19, 100] },
    F: { low: [0, 14], avg: [14, 17], high: [17, 100] },
  },
  DT: {
    M: { low: [0, 50], avg: [50, 60], high: [60, 100] },
    F: { low: [0, 45], avg: [45, 55], high: [55, 100] },
  },
  JT: {
    M: { low: [0, 60], avg: [60, 72], high: [72, 100] },
    F: { low: [0, 48], avg: [48, 58], high: [58, 100] },
  },
};

export function getQualification(event: EventCode, gender: GenderCode, pr: number): "low" | "avg" | "high" {
  const thresholds = QUALIFICATION_THRESHOLDS[event]?.[gender];
  if (!thresholds) return "low";
  if (pr >= thresholds.high[0]) return "high";
  if (pr >= thresholds.avg[0]) return "avg";
  return "low";
}

// ── Bondarchuk Typing Quiz Definitions ────────────────────────────────

export interface QuizOption {
  value: string;
  label: string;
  score: Record<string, number>;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
}

export const ADAPTATION_SPEED_QUIZ: QuizQuestion[] = [
  {
    id: "as1",
    question: "When your coach changes your training program, how quickly do you usually start seeing results in competition marks?",
    options: [
      { value: "fast", label: "Within 1-2 weeks (6-8 sessions)", score: { g1: 3, g2: 1, g3: 0 } },
      { value: "moderate", label: "3-4 weeks (12-16 sessions)", score: { g1: 1, g2: 3, g3: 1 } },
      { value: "slow", label: "6+ weeks (24+ sessions)", score: { g1: 0, g2: 1, g3: 3 } },
      { value: "unsure", label: "I'm not sure / I haven't tracked this", score: { g1: 1, g2: 2, g3: 1 } },
    ],
  },
  {
    id: "as2",
    question: "Have you ever had a long stretch where training felt like it was going nowhere, then suddenly broke through to a new level?",
    options: [
      { value: "never", label: "No — gains come in quick bursts then plateau", score: { g1: 3, g2: 1, g3: 0 } },
      { value: "sometimes", label: "Gains come steadily over time", score: { g1: 1, g2: 3, g3: 1 } },
      { value: "yes", label: "Yes — long flat periods then sudden breakthroughs", score: { g1: 0, g2: 1, g3: 3 } },
    ],
  },
  {
    id: "as3",
    question: "When you take a 1-2 week break from throwing and come back, what happens?",
    options: [
      { value: "immediate", label: "I throw well almost immediately", score: { g1: 3, g2: 1, g3: 0 } },
      { value: "few_sessions", label: "Takes a few sessions to feel normal", score: { g1: 1, g2: 3, g3: 1 } },
      { value: "long", label: "Takes 2+ weeks to get back to where I was", score: { g1: 0, g2: 1, g3: 3 } },
    ],
  },
  {
    id: "as4",
    question: "How often has your coach changed your exercise selection in a typical training month?",
    options: [
      { value: "frequent", label: "Every week or two", score: { g1: 0, g2: 0, g3: 0 } },
      { value: "monthly", label: "Every 3-4 weeks", score: { g1: 0, g2: 0, g3: 0 } },
      { value: "rarely", label: "Rarely — same exercises for months", score: { g1: 0, g2: 0, g3: 0 } },
    ],
  },
  {
    id: "as5",
    question: "During those program changes, what happened to your competition performance?",
    options: [
      { value: "improved_quick", label: "Improved quickly after the change", score: { g1: 3, g2: 1, g3: 0 } },
      { value: "no_change", label: "Stayed about the same", score: { g1: 1, g2: 2, g3: 1 } },
      { value: "got_worse", label: "Got worse and took a long time to recover", score: { g1: 0, g2: 0, g3: 3 } },
      { value: "never_recovered", label: "Performance dropped and never fully came back before the next change", score: { g1: 0, g2: 0, g3: 4 } },
    ],
  },
];

export const TRANSFER_TYPE_QUIZ: QuizQuestion[] = [
  {
    id: "tt1",
    question: "Think about your best competition throws in practice. When did they usually happen?",
    options: [
      { value: "after_heavy", label: "After doing heavy implements first", score: { heavy: 3, comp: 0, balanced: 1 } },
      { value: "comp_only", label: "On days when I only threw competition weight", score: { heavy: 0, comp: 3, balanced: 1 } },
      { value: "no_pattern", label: "No clear pattern", score: { heavy: 1, comp: 1, balanced: 2 } },
    ],
  },
  {
    id: "tt2",
    question: "After throwing heavy implements (heavier than competition), does your competition throw feel different?",
    options: [
      { value: "much_easier", label: "Yes — competition weight feels much lighter/easier", score: { heavy: 3, comp: 0, balanced: 1 } },
      { value: "slightly", label: "Slightly easier", score: { heavy: 2, comp: 0, balanced: 2 } },
      { value: "no_diff", label: "No noticeable difference", score: { heavy: 0, comp: 2, balanced: 2 } },
      { value: "worse", label: "Actually feels worse — timing is off", score: { heavy: 0, comp: 3, balanced: 0 } },
    ],
  },
  {
    id: "tt3",
    question: "In your experience, what type of training week produces your best competition marks?",
    options: [
      { value: "heavy_week", label: "Weeks with lots of heavy implement work", score: { heavy: 3, comp: 0, balanced: 1 } },
      { value: "comp_week", label: "Weeks with high volume at competition weight", score: { heavy: 0, comp: 3, balanced: 1 } },
      { value: "mixed", label: "A good mix of both", score: { heavy: 1, comp: 1, balanced: 3 } },
      { value: "unsure", label: "I haven't noticed a pattern", score: { heavy: 1, comp: 1, balanced: 1 } },
    ],
  },
  {
    id: "tt4",
    question: "Do you tend to throw your best marks early in a session or later?",
    options: [
      { value: "early", label: "Early — first few throws are often my best", score: { heavy: 0, comp: 2, balanced: 1 } },
      { value: "middle", label: "After warming up — around throw 8-15", score: { heavy: 1, comp: 1, balanced: 2 } },
      { value: "late", label: "Late — I need lots of reps to find my best throw", score: { heavy: 2, comp: 0, balanced: 1 } },
    ],
  },
];

export const SELF_FEELING_QUIZ: QuizQuestion[] = [
  {
    id: "sf1",
    question: "After a training session, can you usually predict within 5% what your best throw was before checking the tape?",
    options: [
      { value: "always", label: "Yes, almost always", score: { accurate: 3, moderate: 1, poor: 0 } },
      { value: "sometimes", label: "About half the time", score: { accurate: 1, moderate: 3, poor: 1 } },
      { value: "rarely", label: "Rarely — I am often surprised by the tape", score: { accurate: 0, moderate: 1, poor: 3 } },
    ],
  },
  {
    id: "sf2",
    question: "How often do you feel terrible but throw well, or feel great but throw poorly?",
    options: [
      { value: "rare", label: "Rarely — my feelings match my throws", score: { accurate: 3, moderate: 1, poor: 0 } },
      { value: "sometimes", label: "Sometimes one or the other", score: { accurate: 1, moderate: 3, poor: 1 } },
      { value: "frequently", label: "Frequently — there's little connection", score: { accurate: 0, moderate: 1, poor: 3 } },
    ],
  },
  {
    id: "sf3",
    question: "Can you tell during a throw whether it will be a good mark before the implement lands?",
    options: [
      { value: "yes", label: "Yes — I know before it lands", score: { accurate: 3, moderate: 0, poor: 0 } },
      { value: "sometimes", label: "Sometimes on really good or really bad ones", score: { accurate: 1, moderate: 3, poor: 0 } },
      { value: "no", label: "No — I have to wait and see", score: { accurate: 0, moderate: 1, poor: 3 } },
    ],
  },
];

export const LIGHT_IMPL_QUIZ: QuizQuestion[] = [
  {
    id: "li1",
    question: "When you throw a lighter implement, how does it feel?",
    options: [
      { value: "bad", label: "Awkward / bad / timing feels off", score: { normal: 3, tolerant: 0 } },
      { value: "fine", label: "Fine — just faster", score: { normal: 0, tolerant: 3 } },
      { value: "great", label: "Actually feels great — I love light days", score: { normal: 0, tolerant: 3 } },
    ],
  },
  {
    id: "li2",
    question: "After a session focused on light implements, how are your competition marks the next training day?",
    options: [
      { value: "worse", label: "Worse than usual", score: { normal: 3, tolerant: 0 } },
      { value: "same", label: "About the same", score: { normal: 1, tolerant: 2 } },
      { value: "better", label: "Better than usual", score: { normal: 0, tolerant: 3 } },
    ],
  },
  {
    id: "li3",
    question: "Do light implements ever mess up your technique when you go back to competition weight?",
    options: [
      { value: "yes", label: "Yes — release angle changes, timing shifts", score: { normal: 3, tolerant: 0 } },
      { value: "slight", label: "Slightly — takes a few throws to readjust", score: { normal: 2, tolerant: 1 } },
      { value: "no", label: "No — I transition smoothly", score: { normal: 0, tolerant: 3 } },
    ],
  },
];

export const RECOVERY_QUIZ: QuizQuestion[] = [
  {
    id: "rp1",
    question: "How many days after a hard throwing session before you feel ready to throw hard again?",
    options: [
      { value: "1", label: "Next day — I recover fast", score: { fast: 3, standard: 1, slow: 0 } },
      { value: "2", label: "2 days", score: { fast: 1, standard: 3, slow: 0 } },
      { value: "3plus", label: "3 or more days", score: { fast: 0, standard: 1, slow: 3 } },
    ],
  },
  {
    id: "rp2",
    question: "After a competition, how many days before you are back to normal training?",
    options: [
      { value: "1-2", label: "1-2 days", score: { fast: 3, standard: 1, slow: 0 } },
      { value: "3-4", label: "3-4 days", score: { fast: 1, standard: 3, slow: 0 } },
      { value: "5plus", label: "5 or more days", score: { fast: 0, standard: 1, slow: 3 } },
    ],
  },
  {
    id: "rp3",
    question: "What weekly throwing schedule works best for you?",
    options: [
      { value: "5", label: "5 throwing days per week", score: { fast: 3, standard: 0, slow: 0 } },
      { value: "4", label: "4 throwing days per week", score: { fast: 1, standard: 3, slow: 0 } },
      { value: "3", label: "3 or fewer throwing days", score: { fast: 0, standard: 1, slow: 3 } },
    ],
  },
  {
    id: "rp4",
    question: "How does your performance change across a hard training week (Mon-Fri)?",
    options: [
      { value: "consistent", label: "Stays fairly consistent all week", score: { fast: 3, standard: 1, slow: 0 } },
      { value: "slight_drop", label: "Slight drop by Thursday/Friday", score: { fast: 1, standard: 3, slow: 1 } },
      { value: "big_drop", label: "Significant drop — I need the weekend badly", score: { fast: 0, standard: 1, slow: 3 } },
    ],
  },
];

export const TYPING_QUIZZES = {
  adaptationSpeed: { title: "Adaptation Speed", questions: ADAPTATION_SPEED_QUIZ },
  transferType: { title: "Transfer Type", questions: TRANSFER_TYPE_QUIZ },
  selfFeeling: { title: "Self-Feeling Accuracy", questions: SELF_FEELING_QUIZ },
  lightImpl: { title: "Light Implement Response", questions: LIGHT_IMPL_QUIZ },
  recovery: { title: "Recovery Profile", questions: RECOVERY_QUIZ },
} as const;

export type TypingQuizId = keyof typeof TYPING_QUIZZES;
