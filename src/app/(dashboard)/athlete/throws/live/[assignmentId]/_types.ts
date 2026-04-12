/* ─── Types ──────────────────────────────────────────────────────────── */

export type BlockData = {
  id: string;
  blockType: string;
  position: number;
  config: string;
};

export type ExistingThrowLog = {
  id: string;
  blockId: string;
  throwNumber: number;
  distance: number | null;
  implement: string;
  notes: string | null;
};

export type WorkoutData = {
  assignmentId: string;
  status: string;
  sessionName: string;
  event: string;
  sessionType: string;
  blocks: BlockData[];
  existingThrowLogs: ExistingThrowLog[];
  startedAt: string | null;
};

export type LoggedThrow = {
  id?: string;
  throwNumber: number;
  distance: number | null;  // null for skipped throws
  isPersonalBest?: boolean;
};

export type LoggedSet = {
  setNumber: number;
  reps: number;
  weight: number;
  rpe: number | null;
};

export type BlockState = {
  throws: LoggedThrow[];
  sets: LoggedSet[];
  warmupChecked: Set<number>;
  completed: boolean;
};
