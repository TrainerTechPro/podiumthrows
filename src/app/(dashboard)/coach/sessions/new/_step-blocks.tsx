"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { validateBlockStructure } from "@/lib/bondarchuk";

export type BlockExerciseData = {
  exerciseId: string;
  exerciseName: string;
  exerciseCategory: string;
  sets: number;
  reps: string;
  weight: string;
  rpe: number;
  restSeconds: number;
  notes: string;
  implementKg: number;
};

export type BlockData = {
  name: string;
  blockType: string;
  restSeconds: number;
  notes: string;
  exercises: BlockExerciseData[];
};

const BLOCK_TYPE_OPTIONS = [
  { value: "warmup", label: "Warmup" },
  { value: "throwing", label: "Throwing" },
  { value: "strength", label: "Strength" },
  { value: "cooldown", label: "Cooldown" },
];

const TYPE_BADGE: Record<string, "danger" | "warning" | "success" | "neutral"> = {
  throwing: "danger",
  strength: "success",
  warmup: "neutral",
  cooldown: "neutral",
};

export function StepBlocks({
  blocks,
  onChange,
}: {
  blocks: BlockData[];
  onChange: (blocks: BlockData[]) => void;
}) {
  // Bondarchuk validation
  const validation = validateBlockStructure(
    blocks.map((b) => ({
      name: b.name,
      blockType: b.blockType,
      exercises: b.exercises.map((e) => ({
        name: e.exerciseName,
        implementKg: e.implementKg || null,
      })),
    }))
  );

  function addBlock() {
    onChange([
      ...blocks,
      { name: "", blockType: "strength", restSeconds: 90, notes: "", exercises: [] },
    ]);
  }

  function removeBlock(idx: number) {
    onChange(blocks.filter((_, i) => i !== idx));
  }

  function updateBlock(idx: number, update: Partial<BlockData>) {
    onChange(blocks.map((b, i) => (i === idx ? { ...b, ...update } : b)));
  }

  function moveBlock(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Build Blocks</h2>
        <p className="text-sm text-muted mt-1">
          Structure your session into blocks. Throwing blocks should be separated by strength blocks.
        </p>
      </div>

      {/* Bondarchuk warnings */}
      {!validation.valid && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-1">
          {validation.warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">
                {w.severity === "error" ? "!!" : "!"}
              </span>
              {w.message}
            </p>
          ))}
        </div>
      )}

      {/* Block list */}
      <div className="space-y-3">
        {blocks.map((block, idx) => (
          <div
            key={idx}
            className="border border-[var(--card-border)] rounded-xl p-4 space-y-3 bg-surface-50 dark:bg-surface-900/50"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant={TYPE_BADGE[block.blockType] ?? "neutral"}>
                  {block.blockType}
                </Badge>
                <span className="text-xs text-muted">Block {idx + 1}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveBlock(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-800 disabled:opacity-30 transition-colors"
                  aria-label="Move up"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  onClick={() => moveBlock(idx, 1)}
                  disabled={idx === blocks.length - 1}
                  className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-800 disabled:opacity-30 transition-colors"
                  aria-label="Move down"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <button
                  onClick={() => removeBlock(idx)}
                  className="p-1 rounded hover:bg-red-500/10 text-red-500 transition-colors ml-1"
                  aria-label="Remove block"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Block Name"
                placeholder="e.g. Throwing Block 1"
                value={block.name}
                onChange={(e) => updateBlock(idx, { name: e.target.value })}
                required
              />
              <Select
                label="Type"
                options={BLOCK_TYPE_OPTIONS}
                value={block.blockType}
                onChange={(v) => updateBlock(idx, { blockType: v })}
              />
              <Input
                label="Rest After (sec)"
                type="number"
                placeholder="120"
                value={block.restSeconds ? block.restSeconds.toString() : ""}
                onChange={(e) =>
                  updateBlock(idx, { restSeconds: parseInt(e.target.value, 10) || 0 })
                }
                min={0}
              />
            </div>

            {block.exercises.length > 0 && (
              <p className="text-xs text-muted">
                {block.exercises.length} exercise{block.exercises.length !== 1 && "s"} added
              </p>
            )}
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addBlock}>
        + Add Block
      </Button>
    </div>
  );
}
