// Block type metadata: labels, categories, icons, default configs
import type { BlockType, FormBlock } from "./types";

// ─── Block Categories ─────────────────────────────────────────────────────

export type BlockCategory =
  | "text"
  | "numeric"
  | "scale"
  | "choice"
  | "date"
  | "advanced"
  | "media"
  | "layout";

export interface BlockMeta {
  type: BlockType;
  label: string;
  description: string;
  category: BlockCategory;
  icon: string; // SVG path data for a 24x24 viewBox
  isInput: boolean; // collects answers
  supportsScoring: boolean;
  supportsConditionalLogic: boolean;
}

// ─── SVG Icon Paths (24x24 viewBox) ──────────────────────────────────────

const ICONS = {
  text: "M4 7V4h16v3M9 20h6M12 4v16",
  longText: "M4 6h16M4 10h16M4 14h10",
  email: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  number: "M4 4h4l2 16M12 4h4l2 16M2 10h20M2 14h20",
  slider: "M4 12h16M8 8v8M16 8v8",
  distance: "M2 12h20M12 2v20M7 7l5 5-5 5M17 7l-5 5 5 5",
  duration: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
  scale: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  rpe: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  likert: "M4 6h4v12H4zM10 6h4v12h-4zM16 6h4v12h-4z",
  choice: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 16a4 4 0 100-8 4 4 0 000 8z",
  multiChoice: "M3 5h2v2H3zM3 11h2v2H3zM3 17h2v2H3zM9 5h12M9 11h12M9 17h12",
  yesNo: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  dropdown: "M6 9l6 6 6-6",
  date: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  ranking: "M4 6h16M4 12h16M4 18h16M8 6v0M8 12v0M8 18v0",
  matrix: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  bodyMap: "M12 2a3 3 0 100 6 3 3 0 000-6zM12 8c-3 0-5 2-5 5v3h2v6h6v-6h2v-3c0-3-2-5-5-5z",
  implement: "M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7l3-7z",
  video: "M23 7l-7 5 7 5V7zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z",
  photo: "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a5 5 0 100-10 5 5 0 000 10z",
  welcome: "M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3",
  thankYou: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  section: "M4 6h16M4 12h8",
};

// ─── Block Registry ───────────────────────────────────────────────────────

export const BLOCK_REGISTRY: Record<BlockType, BlockMeta> = {
  // Text
  short_text: {
    type: "short_text",
    label: "Short Text",
    description: "Single-line text answer",
    category: "text",
    icon: ICONS.text,
    isInput: true,
    supportsScoring: false,
    supportsConditionalLogic: true,
  },
  long_text: {
    type: "long_text",
    label: "Long Text",
    description: "Multi-line paragraph answer",
    category: "text",
    icon: ICONS.longText,
    isInput: true,
    supportsScoring: false,
    supportsConditionalLogic: false,
  },
  email: {
    type: "email",
    label: "Email",
    description: "Email address with validation",
    category: "text",
    icon: ICONS.email,
    isInput: true,
    supportsScoring: false,
    supportsConditionalLogic: true,
  },
  // Numeric
  number: {
    type: "number",
    label: "Number",
    description: "Numeric input with optional range",
    category: "numeric",
    icon: ICONS.number,
    isInput: true,
    supportsScoring: true,
    supportsConditionalLogic: true,
  },
  slider: {
    type: "slider",
    label: "Slider",
    description: "Drag to select a value in range",
    category: "numeric",
    icon: ICONS.slider,
    isInput: true,
    supportsScoring: true,
    supportsConditionalLogic: true,
  },
  distance: {
    type: "distance",
    label: "Distance",
    description: "Throw distance in meters",
    category: "numeric",
    icon: ICONS.distance,
    isInput: true,
    supportsScoring: false,
    supportsConditionalLogic: true,
  },
  duration: {
    type: "duration",
    label: "Duration",
    description: "Time input (mm:ss)",
    category: "numeric",
    icon: ICONS.duration,
    isInput: true,
    supportsScoring: false,
    supportsConditionalLogic: true,
  },
  // Scales
  scale_1_5: {
    type: "scale_1_5",
    label: "Scale (1-5)",
    description: "Rate on a 1 to 5 scale",
    category: "scale",
    icon: ICONS.scale,
    isInput: true,
    supportsScoring: true,
    supportsConditionalLogic: true,
  },
  scale_1_10: {
    type: "scale_1_10",
    label: "Scale (1-10)",
    description: "Rate on a 1 to 10 scale",
    category: "scale",
    icon: ICONS.scale,
    isInput: true,
    supportsScoring: true,
    supportsConditionalLogic: true,
  },
  rpe: {
    type: "rpe",
    label: "RPE (1-10)",
    description: "Rate of perceived exertion",
    category: "scale",
    icon: ICONS.rpe,
    isInput: true,
    supportsScoring: true,
    supportsConditionalLogic: true,
  },
  likert: {
    type: "likert",
    label: "Likert Scale",
    description: "Agreement scale (Disagree to Agree)",
    category: "scale",
    icon: ICONS.likert,
    isInput: true,
    supportsScoring: true,
    supportsConditionalLogic: true,
  },
  // Choice
  single_choice: {
    type: "single_choice",
    label: "Single Choice",
    description: "Pick one option from a list",
    category: "choice",
    icon: ICONS.choice,
    isInput: true,
    supportsScoring: true,
    supportsConditionalLogic: true,
  },
  multiple_choice: {
    type: "multiple_choice",
    label: "Multiple Choice",
    description: "Select multiple options",
    category: "choice",
    icon: ICONS.multiChoice,
    isInput: true,
    supportsScoring: true,
    supportsConditionalLogic: true,
  },
  yes_no: {
    type: "yes_no",
    label: "Yes / No",
    description: "Simple yes or no question",
    category: "choice",
    icon: ICONS.yesNo,
    isInput: true,
    supportsScoring: true,
    supportsConditionalLogic: true,
  },
  dropdown: {
    type: "dropdown",
    label: "Dropdown",
    description: "Select from a dropdown list",
    category: "choice",
    icon: ICONS.dropdown,
    isInput: true,
    supportsScoring: true,
    supportsConditionalLogic: true,
  },
  // Date
  date: {
    type: "date",
    label: "Date",
    description: "Pick a date",
    category: "date",
    icon: ICONS.date,
    isInput: true,
    supportsScoring: false,
    supportsConditionalLogic: true,
  },
  // Advanced
  ranking: {
    type: "ranking",
    label: "Ranking",
    description: "Drag to rank items in order",
    category: "advanced",
    icon: ICONS.ranking,
    isInput: true,
    supportsScoring: false,
    supportsConditionalLogic: false,
  },
  matrix: {
    type: "matrix",
    label: "Matrix / Grid",
    description: "Grid of sub-questions",
    category: "advanced",
    icon: ICONS.matrix,
    isInput: true,
    supportsScoring: true,
    supportsConditionalLogic: false,
  },
  body_map: {
    type: "body_map",
    label: "Body Map",
    description: "Tap body regions for soreness",
    category: "advanced",
    icon: ICONS.bodyMap,
    isInput: true,
    supportsScoring: false,
    supportsConditionalLogic: true,
  },
  implement_select: {
    type: "implement_select",
    label: "Implement Select",
    description: "Standard throwing implement weights",
    category: "advanced",
    icon: ICONS.implement,
    isInput: true,
    supportsScoring: false,
    supportsConditionalLogic: true,
  },
  // Media
  video_upload: {
    type: "video_upload",
    label: "Video Upload",
    description: "Upload a throw video",
    category: "media",
    icon: ICONS.video,
    isInput: true,
    supportsScoring: false,
    supportsConditionalLogic: false,
  },
  photo_upload: {
    type: "photo_upload",
    label: "Photo Upload",
    description: "Upload an image",
    category: "media",
    icon: ICONS.photo,
    isInput: true,
    supportsScoring: false,
    supportsConditionalLogic: false,
  },
  // Layout
  welcome_screen: {
    type: "welcome_screen",
    label: "Welcome Screen",
    description: "Introductory screen",
    category: "layout",
    icon: ICONS.welcome,
    isInput: false,
    supportsScoring: false,
    supportsConditionalLogic: false,
  },
  thank_you_screen: {
    type: "thank_you_screen",
    label: "Thank You Screen",
    description: "Completion screen",
    category: "layout",
    icon: ICONS.thankYou,
    isInput: false,
    supportsScoring: false,
    supportsConditionalLogic: false,
  },
  section_header: {
    type: "section_header",
    label: "Section Header",
    description: "Group divider with title",
    category: "layout",
    icon: ICONS.section,
    isInput: false,
    supportsScoring: false,
    supportsConditionalLogic: false,
  },
};

// ─── Category Labels ──────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  text: "Text",
  numeric: "Numbers",
  scale: "Scales & Ratings",
  choice: "Choice",
  date: "Date & Time",
  advanced: "Throws-Specific",
  media: "Media",
  layout: "Layout",
};

export const CATEGORY_ORDER: BlockCategory[] = [
  "choice",
  "text",
  "scale",
  "numeric",
  "advanced",
  "date",
  "media",
  "layout",
];

// ─── Block Defaults ───────────────────────────────────────────────────────

let _blockIdCounter = 0;
export function generateBlockId(): string {
  _blockIdCounter++;
  return `blk_${Date.now()}_${_blockIdCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

export function generateOptionId(): string {
  return `opt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultBlock(type: BlockType, order: number): FormBlock {
  const base = {
    id: generateBlockId(),
    type,
    label: "",
    required: false,
    order,
  };

  switch (type) {
    case "short_text":
      return { ...base, type: "short_text", placeholder: "" };
    case "long_text":
      return { ...base, type: "long_text", placeholder: "", rows: 3 };
    case "email":
      return { ...base, type: "email", placeholder: "name@example.com" };
    case "number":
      return { ...base, type: "number", placeholder: "" };
    case "slider":
      return { ...base, type: "slider", min: 0, max: 100, step: 1, showValue: true };
    case "distance":
      return { ...base, type: "distance", unit: "meters" };
    case "duration":
      return { ...base, type: "duration", format: "mm:ss" };
    case "scale_1_5":
      return { ...base, type: "scale_1_5" };
    case "scale_1_10":
      return { ...base, type: "scale_1_10" };
    case "rpe":
      return { ...base, type: "rpe", showLabels: true, showDescription: true };
    case "likert":
      return {
        ...base,
        type: "likert",
        scale: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"],
      };
    case "single_choice":
      return {
        ...base,
        type: "single_choice",
        options: [
          { id: generateOptionId(), label: "Option 1", value: "option_1" },
          { id: generateOptionId(), label: "Option 2", value: "option_2" },
        ],
      };
    case "multiple_choice":
      return {
        ...base,
        type: "multiple_choice",
        options: [
          { id: generateOptionId(), label: "Option 1", value: "option_1" },
          { id: generateOptionId(), label: "Option 2", value: "option_2" },
        ],
      };
    case "dropdown":
      return {
        ...base,
        type: "dropdown",
        options: [
          { id: generateOptionId(), label: "Option 1", value: "option_1" },
          { id: generateOptionId(), label: "Option 2", value: "option_2" },
        ],
        searchable: false,
      };
    case "yes_no":
      return { ...base, type: "yes_no" };
    case "date":
      return { ...base, type: "date" };
    case "ranking":
      return {
        ...base,
        type: "ranking",
        items: [
          { id: generateOptionId(), label: "Item 1" },
          { id: generateOptionId(), label: "Item 2" },
          { id: generateOptionId(), label: "Item 3" },
        ],
      };
    case "matrix":
      return {
        ...base,
        type: "matrix",
        rows: [
          { id: generateOptionId(), label: "Row 1" },
          { id: generateOptionId(), label: "Row 2" },
        ],
        columns: [
          { id: generateOptionId(), label: "1", value: "1" },
          { id: generateOptionId(), label: "2", value: "2" },
          { id: generateOptionId(), label: "3", value: "3" },
          { id: generateOptionId(), label: "4", value: "4" },
          { id: generateOptionId(), label: "5", value: "5" },
        ],
        inputType: "radio",
      };
    case "body_map":
      return { ...base, type: "body_map", allowMultiple: true, severityScale: false };
    case "implement_select":
      return { ...base, type: "implement_select" };
    case "video_upload":
      return { ...base, type: "video_upload", maxSizeMb: 100 };
    case "photo_upload":
      return { ...base, type: "photo_upload", maxSizeMb: 10 };
    case "welcome_screen":
      return {
        ...base,
        type: "welcome_screen",
        required: false,
        title: "Welcome",
        subtitle: "",
        buttonText: "Get Started",
      };
    case "thank_you_screen":
      return {
        ...base,
        type: "thank_you_screen",
        required: false,
        title: "Thank You!",
        subtitle: "Your responses have been recorded.",
        buttonText: "Done",
      };
    case "section_header":
      return {
        ...base,
        type: "section_header",
        required: false,
        title: "Section",
        subtitle: "",
      };
  }
}
