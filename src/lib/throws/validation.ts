// ── Bondarchuk Session Validation Engine ────────────────────────────
// 7-rule validation pipeline from Volume IV research findings.
// Every session passes through these checks before it can be assigned.
//
// RULE 1: Heavy → Light ONLY (light → heavy FORBIDDEN)
// RULE 2: What you want to improve goes first (Ukhtomsky Dominant Principle)
// RULE 3: Strength blocks between throw blocks
// RULE 4: 15-20% weight differential (>20% creates separate adaptation zones)
// RULE 5: Minimum throw counts (SP/DT/JT: 12, HT: 8)
// RULE 6: Intensity cap (≤15% at 95-100%)
// RULE 7: No mixed light + heavy same session (separate days)

import type { ThrowEvent } from "./constants";
import { MIN_THROWS, COMPETITION_WEIGHTS, EVENT_CODE_MAP } from "./constants";

// ── Block config types ──────────────────────────────────────────────

export interface ThrowingBlockConfig {
  event: ThrowEvent;
  implementWeight: string;
  implementWeightKg: number;
  throwCount: number;
  intensityMin: number;
  intensityMax: number;
  maxEffortThrows: number;
  techniqueFocus?: string;
  notes?: string;
}

export interface StrengthExercise {
  name: string;
  sets: number;
  reps: number;
  percentage?: number;
  classification: string;
}

export interface StrengthBlockConfig {
  exercises: StrengthExercise[];
}

export interface WarmupCooldownConfig {
  duration: number;
  drills: string[];
}

export interface NotesBlockConfig {
  text: string;
  coachOnly: boolean;
}

export interface SessionBlock {
  id: string;
  blockType: string;
  position: number;
  config: ThrowingBlockConfig | StrengthBlockConfig | WarmupCooldownConfig | NotesBlockConfig;
}

// ── Validation result types ─────────────────────────────────────────

export type Severity = "CRITICAL" | "WARNING" | "INFO";

export interface ValidationIssue {
  rule: number;
  check: number; // backward compat alias for rule
  severity: Severity;
  title: string;
  message: string;
  autoFixable: boolean;
  blockIndices?: number[];
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  canAssign: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// ── Helper: extract throwing blocks ─────────────────────────────────

function getThrowingBlocks(blocks: SessionBlock[]): { block: SessionBlock; index: number; config: ThrowingBlockConfig }[] {
  return blocks
    .map((block, index) => ({ block, index, config: block.config as ThrowingBlockConfig }))
    .filter(({ block }) => block.blockType === "THROWING");
}

// ── Helper: get comp weight for an event ────────────────────────────

function getCompWeight(event: ThrowEvent): number {
  const code = EVENT_CODE_MAP[event];
  // Default to male comp weight for validation purposes
  return COMPETITION_WEIGHTS[code]?.M ?? 7.26;
}

// ── RULE 1: Heavy → Light ONLY (CRITICAL) ───────────────────────────
// Vol IV p.114-117: Natural athletes using light→heavy ALL DECREASED 2-4m.
// Correct: 9kg → 8kg → 7.26kg (descending weight)
// WRONG: 6kg → 7.26kg → 8kg (ascending weight)

function checkRule1_ImplementSequence(blocks: SessionBlock[]): ValidationIssue[] {
  const throwingBlocks = getThrowingBlocks(blocks);
  if (throwingBlocks.length < 2) return [];

  const issues: ValidationIssue[] = [];

  for (let i = 1; i < throwingBlocks.length; i++) {
    const prev = throwingBlocks[i - 1].config;
    const curr = throwingBlocks[i].config;

    // Only compare blocks of the same event
    if (prev.event !== curr.event) continue;

    if (curr.implementWeightKg > prev.implementWeightKg) {
      issues.push({
        rule: 1,
        check: 1,
        severity: "CRITICAL",
        title: "Light-to-Heavy Sequence (FORBIDDEN)",
        message: `Light-to-heavy sequencing detected: ${prev.implementWeight} → ${curr.implementWeight}. Volume IV p.114-117: natural athletes using light→heavy ALL DECREASED 2-4 meters. Reorder to heavy → light.`,
        autoFixable: true,
        blockIndices: [throwingBlocks[i - 1].index, throwingBlocks[i].index],
      });
    }
  }

  return issues;
}

// ── RULE 2: What You Want to Improve Goes First (INFO) ──────────────
// 1st throwing block gets 3-4x faster adaptation (Ukhtomsky Dominant Principle).
// Later implements FEED the first.

function checkRule2_PriorityFirst(blocks: SessionBlock[]): ValidationIssue[] {
  const throwingBlocks = getThrowingBlocks(blocks);
  if (throwingBlocks.length < 2) return [];

  // Check if competition weight is not in the first throwing block
  const first = throwingBlocks[0].config;
  const compWeight = getCompWeight(first.event);

  // If the first block is NOT competition weight, that's intentional — but inform
  const hasCompLater = throwingBlocks.slice(1).some(
    (tb) => tb.config.event === first.event && tb.config.implementWeightKg === compWeight
  );

  if (hasCompLater && first.implementWeightKg !== compWeight) {
    return [{
      rule: 2,
      check: 2,
      severity: "INFO",
      title: "Priority Placement Note",
      message: `Competition weight (${compWeight}kg) appears later in the session. The 1st throwing block gets 3-4x faster adaptation (Ukhtomsky Dominant Principle). Consider whether the priority implement is placed first.`,
      autoFixable: false,
      blockIndices: [throwingBlocks[0].index],
    }];
  }

  return [];
}

// ── RULE 3: Strength Blocks Between Throw Blocks (WARNING) ──────────
// Vol IV p.113: "Between two throwing parts of a complex training session,
// a strength part should be programmed."

function checkRule3_StrengthBetweenThrows(blocks: SessionBlock[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i].blockType === "THROWING" && blocks[i - 1].blockType === "THROWING") {
      issues.push({
        rule: 3,
        check: 3,
        severity: "WARNING",
        title: "Missing Strength Block",
        message: `Vol IV p.113: A strength block should be programmed between throwing blocks for passive activation transfer. Structure: Throw → Strength → Throw → Strength.`,
        autoFixable: false,
        blockIndices: [i - 1, i],
      });
    }
  }

  return issues;
}

// ── RULE 4: 15-20% Weight Differential (WARNING/INFO) ───────────────
// Vol IV p.85-88: Implements differing by >20% create separate adaptation zones.

function checkRule4_WeightDifferential(blocks: SessionBlock[]): ValidationIssue[] {
  const throwingBlocks = getThrowingBlocks(blocks);
  if (throwingBlocks.length < 2) return [];

  const issues: ValidationIssue[] = [];

  const byEvent = new Map<string, typeof throwingBlocks>();
  for (const tb of throwingBlocks) {
    const key = tb.config.event;
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key)!.push(tb);
  }

  for (const [, eventBlocks] of byEvent) {
    for (let i = 1; i < eventBlocks.length; i++) {
      const prev = eventBlocks[i - 1].config.implementWeightKg;
      const curr = eventBlocks[i].config.implementWeightKg;
      const diff = Math.abs(prev - curr) / Math.max(prev, curr);

      if (diff > 0.20) {
        issues.push({
          rule: 4,
          check: 4,
          severity: "WARNING",
          title: "Excessive Weight Differential",
          message: `Vol IV p.85-88: ${eventBlocks[i - 1].config.implementWeight} → ${eventBlocks[i].config.implementWeight} differs by ${Math.round(diff * 100)}% (>${"20%"}). Implements differing by >20% create separate adaptation zones.`,
          autoFixable: false,
          blockIndices: [eventBlocks[i - 1].index, eventBlocks[i].index],
        });
      } else if (diff > 0.15) {
        issues.push({
          rule: 4,
          check: 4,
          severity: "INFO",
          title: "Weight Differential Note",
          message: `${eventBlocks[i - 1].config.implementWeight} → ${eventBlocks[i].config.implementWeight} is at the upper limit of optimal transfer range (15-20%).`,
          autoFixable: false,
          blockIndices: [eventBlocks[i - 1].index, eventBlocks[i].index],
        });
      }
    }
  }

  return issues;
}

// ── RULE 5: Minimum Throw Counts (WARNING) ──────────────────────────
// SP/DT/JT: 12 throws minimum per session
// HT: 8 throws minimum per session

function checkRule5_MinimumThrows(blocks: SessionBlock[]): ValidationIssue[] {
  const throwingBlocks = getThrowingBlocks(blocks);
  if (throwingBlocks.length === 0) return [];

  const issues: ValidationIssue[] = [];

  const byEvent = new Map<ThrowEvent, number>();
  for (const tb of throwingBlocks) {
    const event = tb.config.event;
    byEvent.set(event, (byEvent.get(event) || 0) + tb.config.throwCount);
  }

  for (const [event, count] of byEvent) {
    const min = MIN_THROWS[event];
    if (count < min) {
      issues.push({
        rule: 5,
        check: 5,
        severity: "WARNING",
        title: "Below Minimum Volume",
        message: `Only ${count} throws for ${event.replace(/_/g, " ").toLowerCase()}. Minimum recommended: ${min} throws per session.`,
        autoFixable: false,
      });
    }
  }

  return issues;
}

// ── RULE 6: Intensity Cap (WARNING) ─────────────────────────────────
// ≤15% of exercises should be at 95-100% intensity.

function checkRule6_IntensityCap(blocks: SessionBlock[]): ValidationIssue[] {
  const throwingBlocks = getThrowingBlocks(blocks);
  if (throwingBlocks.length === 0) return [];

  const totalThrows = throwingBlocks.reduce((sum, b) => sum + b.config.throwCount, 0);
  const maxEffortTotal = throwingBlocks.reduce((sum, b) => sum + (b.config.maxEffortThrows || 0), 0);

  if (totalThrows === 0) return [];

  const maxEffortPercent = (maxEffortTotal / totalThrows) * 100;

  if (maxEffortPercent > 15) {
    return [{
      rule: 6,
      check: 6,
      severity: "WARNING",
      title: "Intensity Cap Exceeded",
      message: `${maxEffortTotal} of ${totalThrows} throws (${Math.round(maxEffortPercent)}%) are at max effort. Vol IV recommends ≤15% of throws at 95-100% intensity.`,
      autoFixable: false,
    }];
  }

  return [];
}

// ── RULE 7: No Mixed Light + Heavy Same Session (WARNING) ───────────
// Light and heavy implements should be on SEPARATE days.

function checkRule7_MixedLightHeavy(blocks: SessionBlock[]): ValidationIssue[] {
  const throwingBlocks = getThrowingBlocks(blocks);
  if (throwingBlocks.length < 2) return [];

  const issues: ValidationIssue[] = [];

  // Group by event
  const byEvent = new Map<string, typeof throwingBlocks>();
  for (const tb of throwingBlocks) {
    const key = tb.config.event;
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key)!.push(tb);
  }

  for (const [eventKey, eventBlocks] of byEvent) {
    if (eventBlocks.length < 2) continue;

    const event = eventBlocks[0].config.event;
    const compWeight = getCompWeight(event);

    const hasLight = eventBlocks.some((b) => b.config.implementWeightKg < compWeight);
    const hasHeavy = eventBlocks.some((b) => b.config.implementWeightKg > compWeight);

    if (hasLight && hasHeavy) {
      issues.push({
        rule: 7,
        check: 7,
        severity: "WARNING",
        title: "Mixed Light + Heavy Session",
        message: `Session mixes light and heavy implements for ${eventKey.replace(/_/g, " ").toLowerCase()}. Light and heavy implements should be on separate days for optimal adaptation.`,
        autoFixable: false,
        blockIndices: eventBlocks.map((b) => b.index),
      });
    }
  }

  return issues;
}

// ── Main validation function ────────────────────────────────────────

export function validateSession(blocks: SessionBlock[]): ValidationResult {
  const allIssues: ValidationIssue[] = [
    ...checkRule1_ImplementSequence(blocks),
    ...checkRule2_PriorityFirst(blocks),
    ...checkRule3_StrengthBetweenThrows(blocks),
    ...checkRule4_WeightDifferential(blocks),
    ...checkRule5_MinimumThrows(blocks),
    ...checkRule6_IntensityCap(blocks),
    ...checkRule7_MixedLightHeavy(blocks),
  ];

  const errors = allIssues.filter((i) => i.severity === "CRITICAL");
  const warnings = allIssues.filter((i) => i.severity === "WARNING");
  const hasCritical = errors.length > 0;

  return {
    valid: !hasCritical,
    issues: allIssues,
    canAssign: !hasCritical,
    errors,
    warnings,
  };
}

// ── Convenience: validate with event context (Vol IV naming) ────────

export function validateVolIV(
  blocks: SessionBlock[],
  _event?: ThrowEvent
): { errors: ValidationIssue[]; warnings: ValidationIssue[]; isValid: boolean } {
  const result = validateSession(blocks);
  return {
    errors: result.errors,
    warnings: result.warnings,
    isValid: result.valid,
  };
}

// ── Auto-fix: Reorder throwing blocks heavy → light ─────────────────

export function autoFixSequence(blocks: SessionBlock[]): SessionBlock[] {
  const result = [...blocks];
  const throwingIndices: number[] = [];

  for (let i = 0; i < result.length; i++) {
    if (result[i].blockType === "THROWING") {
      throwingIndices.push(i);
    }
  }

  // Group consecutive throwing blocks and sort each group heavy → light
  const groups: number[][] = [];
  let currentGroup: number[] = [];

  for (const idx of throwingIndices) {
    if (currentGroup.length === 0 || idx === currentGroup[currentGroup.length - 1] + 1 || idx === currentGroup[currentGroup.length - 1] + 2) {
      currentGroup.push(idx);
    } else {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [idx];
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  for (const group of groups) {
    const blocksCopy = group.map((i) => result[i]);
    blocksCopy.sort((a, b) => {
      const aW = (a.config as ThrowingBlockConfig).implementWeightKg;
      const bW = (b.config as ThrowingBlockConfig).implementWeightKg;
      return bW - aW; // heavy first
    });
    group.forEach((originalIdx, sortedIdx) => {
      result[originalIdx] = { ...blocksCopy[sortedIdx], position: originalIdx };
    });
  }

  return result;
}
