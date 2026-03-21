// ─── Form Builder Type System ─────────────────────────────────────────────
// All types for the advanced form builder: blocks, conditional logic, scoring

// ─── Block Types ──────────────────────────────────────────────────────────

export const BLOCK_TYPES = [
  // Text inputs
  "short_text",
  "long_text",
  "email",
  // Numeric
  "number",
  "slider",
  "distance",
  "duration",
  // Scales
  "scale_1_5",
  "scale_1_10",
  "rpe",
  "likert",
  // Choice
  "single_choice",
  "multiple_choice",
  "yes_no",
  "dropdown",
  // Date
  "date",
  // Advanced
  "ranking",
  "matrix",
  "body_map",
  "implement_select",
  // Media
  "video_upload",
  "photo_upload",
  // Layout (non-question)
  "welcome_screen",
  "thank_you_screen",
  "section_header",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

// Which block types are "input" blocks (collect answers)
export const INPUT_BLOCK_TYPES: BlockType[] = BLOCK_TYPES.filter(
  (t) => t !== "welcome_screen" && t !== "thank_you_screen" && t !== "section_header"
);

export const LAYOUT_BLOCK_TYPES: BlockType[] = [
  "welcome_screen",
  "thank_you_screen",
  "section_header",
];

// ─── Display Modes ────────────────────────────────────────────────────────

export type FormDisplayMode = "ALL_AT_ONCE" | "ONE_PER_PAGE" | "SECTIONED";

// ─── Recurrence ───────────────────────────────────────────────────────────

export type RecurrenceFrequency = "DAILY" | "SPECIFIC_DAYS" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export type AssignmentSource = "MANUAL" | "RECURRING";

// ─── Base Block ───────────────────────────────────────────────────────────

export interface FormBlockBase {
  id: string;
  type: BlockType;
  label: string; // supports merge tags: {{block:id}}
  description?: string;
  required: boolean;
  sectionId?: string;
  order: number;
}

// ─── Specific Block Types ─────────────────────────────────────────────────

export interface ShortTextBlock extends FormBlockBase {
  type: "short_text";
  placeholder?: string;
  maxLength?: number;
}

export interface LongTextBlock extends FormBlockBase {
  type: "long_text";
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}

export interface EmailBlock extends FormBlockBase {
  type: "email";
  placeholder?: string;
}

export interface NumberBlock extends FormBlockBase {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
}

export interface SliderBlock extends FormBlockBase {
  type: "slider";
  min: number;
  max: number;
  step: number;
  minLabel?: string;
  maxLabel?: string;
  showValue?: boolean;
}

export interface DistanceBlock extends FormBlockBase {
  type: "distance";
  unit: "meters" | "feet";
  placeholder?: string;
}

export interface DurationBlock extends FormBlockBase {
  type: "duration";
  format: "mm:ss" | "hh:mm:ss";
}

export interface ScaleBlock extends FormBlockBase {
  type: "scale_1_5" | "scale_1_10";
  lowLabel?: string;
  highLabel?: string;
}

export interface RPEBlock extends FormBlockBase {
  type: "rpe";
  showLabels?: boolean;
  showDescription?: boolean;
}

export interface LikertBlock extends FormBlockBase {
  type: "likert";
  scale: string[];
}

export interface ChoiceOption {
  id: string;
  label: string;
  value: string;
}

export interface SingleChoiceBlock extends FormBlockBase {
  type: "single_choice";
  options: ChoiceOption[];
  allowOther?: boolean;
  randomize?: boolean;
}

export interface MultipleChoiceBlock extends FormBlockBase {
  type: "multiple_choice";
  options: ChoiceOption[];
  allowOther?: boolean;
  minSelections?: number;
  maxSelections?: number;
  randomize?: boolean;
}

export interface DropdownBlock extends FormBlockBase {
  type: "dropdown";
  options: ChoiceOption[];
  allowOther?: boolean;
  searchable?: boolean;
}

export interface YesNoBlock extends FormBlockBase {
  type: "yes_no";
}

export interface DateBlock extends FormBlockBase {
  type: "date";
  minDate?: string;
  maxDate?: string;
  includeTime?: boolean;
}

export interface RankingBlock extends FormBlockBase {
  type: "ranking";
  items: Array<{ id: string; label: string }>;
}

export interface MatrixRow {
  id: string;
  label: string;
}

export interface MatrixColumn {
  id: string;
  label: string;
  value: string;
}

export interface MatrixBlock extends FormBlockBase {
  type: "matrix";
  rows: MatrixRow[];
  columns: MatrixColumn[];
  inputType: "radio" | "checkbox" | "scale";
}

export interface BodyMapBlock extends FormBlockBase {
  type: "body_map";
  allowMultiple: boolean;
  severityScale?: boolean; // if true, rate each selected region 1-5
}

export interface ImplementSelectBlock extends FormBlockBase {
  type: "implement_select";
  event?: "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";
  gender?: "MALE" | "FEMALE";
  allowMultiple?: boolean;
}

export interface VideoUploadBlock extends FormBlockBase {
  type: "video_upload";
  maxSizeMb?: number;
  prompt?: string;
}

export interface PhotoUploadBlock extends FormBlockBase {
  type: "photo_upload";
  maxSizeMb?: number;
  prompt?: string;
}

export interface WelcomeScreenBlock extends FormBlockBase {
  type: "welcome_screen";
  title: string;
  subtitle?: string;
  buttonText?: string;
  imageUrl?: string;
  required: false;
}

export interface ThankYouScreenBlock extends FormBlockBase {
  type: "thank_you_screen";
  title: string;
  subtitle?: string;
  buttonText?: string;
  redirectUrl?: string;
  required: false;
}

export interface SectionHeaderBlock extends FormBlockBase {
  type: "section_header";
  title: string;
  subtitle?: string;
  required: false;
}

// ─── Union Type ───────────────────────────────────────────────────────────

export type FormBlock =
  | ShortTextBlock
  | LongTextBlock
  | EmailBlock
  | NumberBlock
  | SliderBlock
  | DistanceBlock
  | DurationBlock
  | ScaleBlock
  | RPEBlock
  | LikertBlock
  | SingleChoiceBlock
  | MultipleChoiceBlock
  | DropdownBlock
  | YesNoBlock
  | DateBlock
  | RankingBlock
  | MatrixBlock
  | BodyMapBlock
  | ImplementSelectBlock
  | VideoUploadBlock
  | PhotoUploadBlock
  | WelcomeScreenBlock
  | ThankYouScreenBlock
  | SectionHeaderBlock;

// ─── Conditional Logic ────────────────────────────────────────────────────

export type ConditionOperator =
  | "is"
  | "is_not"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "greater_equal"
  | "less_equal"
  | "is_empty"
  | "is_not_empty";

export interface Condition {
  blockId: string;
  operator: ConditionOperator;
  value: unknown;
}

// AND within a group, OR between groups
export type ConditionGroup = Condition[];
export type ConditionMatrix = ConditionGroup[];

export type ConditionalAction = "show" | "hide" | "jump_to" | "skip";

export interface ConditionalRule {
  id: string;
  targetBlockId: string;
  action: ConditionalAction;
  conditions: ConditionMatrix;
  jumpToBlockId?: string;
}

// ─── Scoring ──────────────────────────────────────────────────────────────

export interface BlockScoringRule {
  blockId: string;
  maxPoints: number;
  scoringMap?: Record<string, number>; // answer value -> points
  invertScale?: boolean; // e.g., soreness: 10 = bad = low score
}

export interface CompositeScoringRule {
  name: string;
  formula: "average" | "weighted_average" | "sum";
  blockWeights?: Record<string, number>;
}

export interface ScoringConfig {
  rules: BlockScoringRule[];
  composite?: CompositeScoringRule;
}

// ─── Answers ──────────────────────────────────────────────────────────────

export interface BlockAnswer {
  blockId: string;
  blockLabel: string;
  blockType: BlockType;
  answer: unknown;
  score?: number;
}

// ─── Welcome / Thank You screens ──────────────────────────────────────────

export interface WelcomeConfig {
  title: string;
  subtitle?: string;
  buttonText?: string;
  imageUrl?: string;
}

export interface ThankYouConfig {
  title: string;
  subtitle?: string;
  buttonText?: string;
  redirectUrl?: string;
}

// ─── Recurring Schedule (matches Prisma model) ───────────────────────────

export interface RecurringScheduleConfig {
  frequency: RecurrenceFrequency;
  specificDays?: number[]; // 0=Sun ... 6=Sat
  timeOfDay?: string; // "08:00"
  athleteIds: string[];
  groupIds: string[];
  assignToAll: boolean;
  startDate: string;
  endDate?: string;
}

// ─── Form Template ────────────────────────────────────────────────────────

export type QuestionnaireType =
  | "ONBOARDING"
  | "ASSESSMENT"
  | "CHECK_IN"
  | "READINESS"
  | "COMPETITION"
  | "INJURY"
  | "CUSTOM";

export interface FormTemplateDefinition {
  key: string;
  name: string;
  description: string;
  icon: string; // SVG path or emoji
  type: QuestionnaireType;
  displayMode: FormDisplayMode;
  blocks: FormBlock[];
  scoringEnabled: boolean;
  scoringRules?: ScoringConfig;
  conditionalLogic?: ConditionalRule[];
  suggestedRecurrence?: Partial<RecurringScheduleConfig>;
}

// ─── Builder State ────────────────────────────────────────────────────────

export interface FormBuilderState {
  form: {
    title: string;
    description: string;
    type: QuestionnaireType;
    displayMode: FormDisplayMode;
    welcomeScreen: WelcomeConfig | null;
    thankYouScreen: ThankYouConfig | null;
    scoringEnabled: boolean;
    scoringRules: ScoringConfig | null;
    allowAnonymous: boolean;
    expiresAt: string | null;
  };
  blocks: FormBlock[];
  conditionalLogic: ConditionalRule[];
  selectedBlockId: string | null;
  isDirty: boolean;
}

export type FormBuilderAction =
  | { type: "SET_FORM_FIELD"; field: string; value: unknown }
  | { type: "ADD_BLOCK"; block: FormBlock; afterId?: string }
  | { type: "UPDATE_BLOCK"; blockId: string; updates: Partial<FormBlock> }
  | { type: "REMOVE_BLOCK"; blockId: string }
  | { type: "REORDER_BLOCKS"; fromIndex: number; toIndex: number }
  | { type: "SELECT_BLOCK"; blockId: string | null }
  | { type: "DUPLICATE_BLOCK"; blockId: string }
  | { type: "ADD_RULE"; rule: ConditionalRule }
  | { type: "UPDATE_RULE"; ruleId: string; updates: Partial<ConditionalRule> }
  | { type: "REMOVE_RULE"; ruleId: string }
  | { type: "LOAD_TEMPLATE"; template: FormTemplateDefinition }
  | { type: "LOAD_FORM"; state: Omit<FormBuilderState, "selectedBlockId" | "isDirty"> }
  | { type: "MARK_CLEAN" };

// ─── Renderer State ───────────────────────────────────────────────────────

export interface FormRendererState {
  answers: Record<string, unknown>;
  currentIndex: number;
  currentSection: number;
  visibleBlockIds: string[];
  errors: Record<string, string>;
  isSubmitting: boolean;
  isComplete: boolean;
  startedAt: number;
}
