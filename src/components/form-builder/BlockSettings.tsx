"use client";

import type {
  FormBlock,
  FormBuilderAction,
  ChoiceOption,
} from "@/lib/forms/types";
import { BLOCK_REGISTRY, generateOptionId } from "@/lib/forms/block-registry";
import { Input } from "@/components/ui/Input";

interface BlockSettingsProps {
  block: FormBlock;
  dispatch: React.Dispatch<FormBuilderAction>;
}

export function BlockSettings({ block, dispatch }: BlockSettingsProps) {
  const meta = BLOCK_REGISTRY[block.type];

  function update(updates: Partial<FormBlock>) {
    dispatch({ type: "UPDATE_BLOCK", blockId: block.id, updates });
  }

  // Helper for choice option management
  function updateOption(index: number, updates: Partial<ChoiceOption>) {
    if (!("options" in block)) return;
    const options = [...(block.options as ChoiceOption[])];
    options[index] = { ...options[index], ...updates };
    update({ options } as Partial<FormBlock>);
  }

  function addOption() {
    if (!("options" in block)) return;
    const options = [
      ...(block.options as ChoiceOption[]),
      {
        id: generateOptionId(),
        label: `Option ${(block.options as ChoiceOption[]).length + 1}`,
        value: `option_${(block.options as ChoiceOption[]).length + 1}`,
      },
    ];
    update({ options } as Partial<FormBlock>);
  }

  function removeOption(index: number) {
    if (!("options" in block)) return;
    const options = (block.options as ChoiceOption[]).filter(
      (_, i) => i !== index
    );
    update({ options } as Partial<FormBlock>);
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-[var(--card-border)]">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary-500"
        >
          <path d={meta?.icon ?? ""} />
        </svg>
        <span className="text-sm font-semibold text-[var(--foreground)]">
          {meta?.label}
        </span>
      </div>

      {/* Common fields */}
      <Input
        label="Label / Question"
        value={block.label}
        onChange={(e) => update({ label: e.target.value })}
        placeholder="Enter question text..."
      />

      {block.type !== "welcome_screen" &&
        block.type !== "thank_you_screen" &&
        block.type !== "section_header" && (
          <>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--foreground)]">
                Description
              </label>
              <textarea
                value={block.description ?? ""}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="Optional help text..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30 resize-y"
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={block.required}
                onChange={(e) => update({ required: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--card-border)] text-primary-500 focus:ring-primary-500/30"
              />
              Required
            </label>
          </>
        )}

      {/* Type-specific settings */}
      {(block.type === "short_text" || block.type === "email") && (
        <Input
          label="Placeholder"
          value={"placeholder" in block ? (block.placeholder ?? "") : ""}
          onChange={(e) => update({ placeholder: e.target.value } as Partial<FormBlock>)}
          placeholder="Placeholder text..."
        />
      )}

      {block.type === "long_text" && (
        <>
          <Input
            label="Placeholder"
            value={block.placeholder ?? ""}
            onChange={(e) => update({ placeholder: e.target.value } as Partial<FormBlock>)}
            placeholder="Placeholder text..."
          />
          <Input
            label="Rows"
            type="number"
            value={String(block.rows ?? 3)}
            onChange={(e) =>
              update({ rows: parseInt(e.target.value) || 3 } as Partial<FormBlock>)
            }
          />
        </>
      )}

      {block.type === "number" && (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Min"
            type="number"
            value={block.min != null ? String(block.min) : ""}
            onChange={(e) =>
              update({
                min: e.target.value ? parseFloat(e.target.value) : undefined,
              } as Partial<FormBlock>)
            }
          />
          <Input
            label="Max"
            type="number"
            value={block.max != null ? String(block.max) : ""}
            onChange={(e) =>
              update({
                max: e.target.value ? parseFloat(e.target.value) : undefined,
              } as Partial<FormBlock>)
            }
          />
          <Input
            label="Unit"
            value={block.unit ?? ""}
            onChange={(e) => update({ unit: e.target.value } as Partial<FormBlock>)}
            placeholder="e.g., kg, m"
          />
        </div>
      )}

      {block.type === "slider" && (
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Min"
            type="number"
            value={String(block.min)}
            onChange={(e) =>
              update({ min: parseFloat(e.target.value) || 0 } as Partial<FormBlock>)
            }
          />
          <Input
            label="Max"
            type="number"
            value={String(block.max)}
            onChange={(e) =>
              update({ max: parseFloat(e.target.value) || 100 } as Partial<FormBlock>)
            }
          />
          <Input
            label="Step"
            type="number"
            value={String(block.step)}
            onChange={(e) =>
              update({ step: parseFloat(e.target.value) || 1 } as Partial<FormBlock>)
            }
          />
        </div>
      )}

      {(block.type === "scale_1_5" || block.type === "scale_1_10") && (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Low Label"
            value={block.lowLabel ?? ""}
            onChange={(e) => update({ lowLabel: e.target.value } as Partial<FormBlock>)}
            placeholder="e.g., Low"
          />
          <Input
            label="High Label"
            value={block.highLabel ?? ""}
            onChange={(e) => update({ highLabel: e.target.value } as Partial<FormBlock>)}
            placeholder="e.g., High"
          />
        </div>
      )}

      {block.type === "distance" && (
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted">Unit:</label>
          {(["meters", "feet"] as const).map((u) => (
            <label key={u} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                checked={block.unit === u}
                onChange={() => update({ unit: u } as Partial<FormBlock>)}
                className="w-3.5 h-3.5 text-primary-500 focus:ring-primary-500/30"
              />
              {u}
            </label>
          ))}
        </div>
      )}

      {block.type === "duration" && (
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted">Format:</label>
          {(["mm:ss", "hh:mm:ss"] as const).map((f) => (
            <label key={f} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                checked={block.format === f}
                onChange={() => update({ format: f } as Partial<FormBlock>)}
                className="w-3.5 h-3.5 text-primary-500 focus:ring-primary-500/30"
              />
              {f}
            </label>
          ))}
        </div>
      )}

      {/* Choice types — option editor */}
      {(block.type === "single_choice" ||
        block.type === "multiple_choice" ||
        block.type === "dropdown") && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted">Options</label>
          {(block.options as ChoiceOption[]).map((opt, i) => (
            <div key={opt.id} className="flex gap-2 items-center">
              <Input
                value={opt.label}
                onChange={(e) => updateOption(i, { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                placeholder={`Option ${i + 1}`}
              />
              {(block.options as ChoiceOption[]).length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="p-1 text-muted hover:text-red-500 transition-colors shrink-0"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            + Add option
          </button>

          {block.type !== "dropdown" && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={block.allowOther ?? false}
                onChange={(e) =>
                  update({ allowOther: e.target.checked } as Partial<FormBlock>)
                }
                className="w-4 h-4 rounded border-[var(--card-border)] text-primary-500 focus:ring-primary-500/30"
              />
              Allow &quot;Other&quot; option
            </label>
          )}
        </div>
      )}

      {block.type === "body_map" && (
        <>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={block.allowMultiple}
              onChange={(e) =>
                update({ allowMultiple: e.target.checked } as Partial<FormBlock>)
              }
              className="w-4 h-4 rounded border-[var(--card-border)] text-primary-500 focus:ring-primary-500/30"
            />
            Allow multiple regions
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={block.severityScale ?? false}
              onChange={(e) =>
                update({ severityScale: e.target.checked } as Partial<FormBlock>)
              }
              className="w-4 h-4 rounded border-[var(--card-border)] text-primary-500 focus:ring-primary-500/30"
            />
            Include severity rating (1-5)
          </label>
        </>
      )}

      {block.type === "implement_select" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Event</label>
            <select
              value={block.event ?? ""}
              onChange={(e) =>
                update({
                  event: e.target.value || undefined,
                } as Partial<FormBlock>)
              }
              className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="">Auto-detect</option>
              <option value="SHOT_PUT">Shot Put</option>
              <option value="DISCUS">Discus</option>
              <option value="HAMMER">Hammer</option>
              <option value="JAVELIN">Javelin</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted">Gender</label>
            <select
              value={block.gender ?? ""}
              onChange={(e) =>
                update({
                  gender: e.target.value || undefined,
                } as Partial<FormBlock>)
              }
              className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="">Auto-detect</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
        </div>
      )}

      {/* Welcome / Thank You screen specific */}
      {(block.type === "welcome_screen" || block.type === "thank_you_screen") && (
        <>
          <Input
            label="Title"
            value={"title" in block ? (block as { title: string }).title : ""}
            onChange={(e) => update({ title: e.target.value } as Partial<FormBlock>)}
          />
          <Input
            label="Subtitle"
            value={
              "subtitle" in block
                ? ((block as { subtitle?: string }).subtitle ?? "")
                : ""
            }
            onChange={(e) => update({ subtitle: e.target.value } as Partial<FormBlock>)}
          />
          <Input
            label="Button Text"
            value={
              "buttonText" in block
                ? ((block as { buttonText?: string }).buttonText ?? "")
                : ""
            }
            onChange={(e) =>
              update({ buttonText: e.target.value } as Partial<FormBlock>)
            }
          />
        </>
      )}

      {block.type === "section_header" && (
        <>
          <Input
            label="Section Title"
            value={"title" in block ? (block as { title: string }).title : ""}
            onChange={(e) => update({ title: e.target.value } as Partial<FormBlock>)}
          />
          <Input
            label="Subtitle"
            value={
              "subtitle" in block
                ? ((block as { subtitle?: string }).subtitle ?? "")
                : ""
            }
            onChange={(e) => update({ subtitle: e.target.value } as Partial<FormBlock>)}
          />
        </>
      )}
    </div>
  );
}
