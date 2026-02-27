// ─── Form Validation ───────────────────────────────────────────────────────
// Server-side and client-side block + answer validation

import type { FormBlock, BlockType } from "./types";
import { BLOCK_TYPES } from "./types";

// ─── Validate a single answer against its block ────────────────────────────

export interface ValidationError {
  blockId: string;
  message: string;
}

export function validateAnswer(
  block: FormBlock,
  answer: unknown
): string | null {
  // Layout blocks never have answers
  if (
    block.type === "welcome_screen" ||
    block.type === "thank_you_screen" ||
    block.type === "section_header"
  ) {
    return null;
  }

  // Required check
  if (block.required) {
    if (answer === undefined || answer === null || answer === "") {
      return "This field is required";
    }
    if (Array.isArray(answer) && answer.length === 0) {
      return "This field is required";
    }
  }

  // If not required and empty, skip further validation
  if (answer === undefined || answer === null || answer === "") {
    return null;
  }

  switch (block.type) {
    case "short_text": {
      if (typeof answer !== "string") return "Must be text";
      if (block.maxLength && answer.length > block.maxLength) {
        return `Maximum ${block.maxLength} characters`;
      }
      return null;
    }

    case "long_text": {
      if (typeof answer !== "string") return "Must be text";
      if (block.maxLength && answer.length > block.maxLength) {
        return `Maximum ${block.maxLength} characters`;
      }
      return null;
    }

    case "email": {
      if (typeof answer !== "string") return "Must be text";
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(answer)) return "Must be a valid email address";
      return null;
    }

    case "number": {
      const num = Number(answer);
      if (isNaN(num)) return "Must be a number";
      if (block.min !== undefined && num < block.min) {
        return `Minimum value is ${block.min}`;
      }
      if (block.max !== undefined && num > block.max) {
        return `Maximum value is ${block.max}`;
      }
      return null;
    }

    case "slider": {
      const num = Number(answer);
      if (isNaN(num)) return "Must be a number";
      if (num < block.min || num > block.max) {
        return `Must be between ${block.min} and ${block.max}`;
      }
      return null;
    }

    case "distance": {
      const num = Number(answer);
      if (isNaN(num) || num < 0) return "Must be a positive number";
      return null;
    }

    case "duration": {
      if (typeof answer !== "string") return "Must be a duration string";
      const pattern =
        block.format === "mm:ss"
          ? /^\d{1,3}:\d{2}$/
          : /^\d{1,2}:\d{2}:\d{2}$/;
      if (!pattern.test(answer)) return `Must be in ${block.format} format`;
      return null;
    }

    case "scale_1_5": {
      const num = Number(answer);
      if (isNaN(num) || num < 1 || num > 5 || !Number.isInteger(num)) {
        return "Must be a whole number between 1 and 5";
      }
      return null;
    }

    case "scale_1_10": {
      const num = Number(answer);
      if (isNaN(num) || num < 1 || num > 10 || !Number.isInteger(num)) {
        return "Must be a whole number between 1 and 10";
      }
      return null;
    }

    case "rpe": {
      const num = Number(answer);
      if (isNaN(num) || num < 1 || num > 10 || !Number.isInteger(num)) {
        return "Must be a whole number between 1 and 10";
      }
      return null;
    }

    case "likert": {
      if (typeof answer !== "string") return "Must select an option";
      if (!block.scale.includes(answer)) return "Invalid selection";
      return null;
    }

    case "single_choice": {
      if (typeof answer !== "string") return "Must select an option";
      const validValues = block.options.map((o) => o.value);
      if (!block.allowOther && !validValues.includes(answer)) {
        return "Invalid selection";
      }
      return null;
    }

    case "multiple_choice": {
      if (!Array.isArray(answer)) return "Must select options";
      if (block.minSelections && answer.length < block.minSelections) {
        return `Select at least ${block.minSelections}`;
      }
      if (block.maxSelections && answer.length > block.maxSelections) {
        return `Select at most ${block.maxSelections}`;
      }
      return null;
    }

    case "dropdown": {
      if (typeof answer !== "string") return "Must select an option";
      const validValues = block.options.map((o) => o.value);
      if (!block.allowOther && !validValues.includes(answer)) {
        return "Invalid selection";
      }
      return null;
    }

    case "yes_no": {
      const val = String(answer).toLowerCase();
      if (val !== "yes" && val !== "no") return "Must be Yes or No";
      return null;
    }

    case "date": {
      if (typeof answer !== "string") return "Must be a date";
      const dateVal = new Date(answer);
      if (isNaN(dateVal.getTime())) return "Invalid date";
      if (block.minDate && dateVal < new Date(block.minDate)) {
        return `Date must be after ${block.minDate}`;
      }
      if (block.maxDate && dateVal > new Date(block.maxDate)) {
        return `Date must be before ${block.maxDate}`;
      }
      return null;
    }

    case "ranking": {
      if (!Array.isArray(answer)) return "Must provide a ranking";
      if (answer.length !== block.items.length) {
        return "Must rank all items";
      }
      return null;
    }

    case "matrix": {
      if (typeof answer !== "object" || answer === null || Array.isArray(answer)) {
        return "Must provide answers for all rows";
      }
      if (block.required) {
        const answeredRows = Object.keys(answer as Record<string, unknown>);
        if (answeredRows.length < block.rows.length) {
          return "Must answer all rows";
        }
      }
      return null;
    }

    case "body_map": {
      if (!Array.isArray(answer)) return "Must select body regions";
      if (block.required && answer.length === 0) {
        return "Select at least one region";
      }
      return null;
    }

    case "implement_select": {
      if (block.allowMultiple) {
        if (!Array.isArray(answer)) return "Must select implements";
      } else {
        if (typeof answer !== "number" && typeof answer !== "string") {
          return "Must select an implement";
        }
      }
      return null;
    }

    case "video_upload":
    case "photo_upload": {
      // Just check that something was provided
      if (typeof answer !== "string" || answer.trim() === "") {
        return block.required ? "Upload required" : null;
      }
      return null;
    }

    default:
      return null;
  }
}

// ─── Validate all answers for a form ───────────────────────────────────────

export function validateAllAnswers(
  blocks: FormBlock[],
  answers: Record<string, unknown>,
  visibleBlockIds: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const visibleSet = new Set(visibleBlockIds);

  for (const block of blocks) {
    // Only validate visible blocks
    if (!visibleSet.has(block.id)) continue;

    const error = validateAnswer(block, answers[block.id]);
    if (error) {
      errors.push({ blockId: block.id, message: error });
    }
  }

  return errors;
}

// ─── Validate block configuration (for the builder) ────────────────────────

export function validateBlockConfig(block: FormBlock): string[] {
  const errors: string[] = [];

  if (!block.label || block.label.trim() === "") {
    errors.push("Label is required");
  }

  if (!BLOCK_TYPES.includes(block.type as BlockType)) {
    errors.push(`Invalid block type: ${block.type}`);
  }

  // Type-specific validation
  switch (block.type) {
    case "single_choice":
    case "multiple_choice":
    case "dropdown":
      if (!block.options || block.options.length < 2) {
        errors.push("At least 2 options required");
      }
      break;

    case "slider":
      if (block.min >= block.max) {
        errors.push("Min must be less than max");
      }
      if (block.step <= 0) {
        errors.push("Step must be positive");
      }
      break;

    case "likert":
      if (!block.scale || block.scale.length < 2) {
        errors.push("At least 2 scale items required");
      }
      break;

    case "ranking":
      if (!block.items || block.items.length < 2) {
        errors.push("At least 2 items required for ranking");
      }
      break;

    case "matrix":
      if (!block.rows || block.rows.length < 1) {
        errors.push("At least 1 row required");
      }
      if (!block.columns || block.columns.length < 2) {
        errors.push("At least 2 columns required");
      }
      break;
  }

  return errors;
}

// ─── Validate entire form structure ────────────────────────────────────────

export function validateFormStructure(
  blocks: FormBlock[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (blocks.length === 0) {
    errors.push("Form must have at least one block");
  }

  // Check for duplicate IDs
  const ids = blocks.map((b) => b.id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    errors.push("Duplicate block IDs found");
  }

  // Validate each block
  for (const block of blocks) {
    const blockErrors = validateBlockConfig(block);
    for (const err of blockErrors) {
      errors.push(`Block "${block.label || block.id}": ${err}`);
    }
  }

  // Check welcome/thank-you screen placement
  const welcomeIdx = blocks.findIndex((b) => b.type === "welcome_screen");
  if (welcomeIdx > 0) {
    errors.push("Welcome screen must be the first block");
  }

  const thankYouIdx = blocks.findIndex((b) => b.type === "thank_you_screen");
  if (thankYouIdx !== -1 && thankYouIdx !== blocks.length - 1) {
    errors.push("Thank you screen must be the last block");
  }

  return { valid: errors.length === 0, errors };
}
