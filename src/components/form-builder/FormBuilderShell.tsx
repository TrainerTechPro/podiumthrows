"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { BlockType, FormBlock, FormBuilderState } from "@/lib/forms/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { BlockListItem } from "./BlockListItem";
import { BlockSettings } from "./BlockSettings";
import { BlockTypeSelector } from "./BlockTypeSelector";
import { BlockRenderer } from "@/components/form-blocks/BlockRenderer";
import { useFormBuilder } from "./useFormBuilder";

interface FormBuilderShellProps {
  initialData?: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    status: string;
    displayMode?: string;
    blocks?: FormBlock[];
    // Legacy
    questions?: Array<{
      id: string;
      text: string;
      type: string;
      options?: string[];
      required?: boolean;
    }>;
  };
}

const TYPE_OPTIONS = [
  { value: "ONBOARDING", label: "PAR-Q / Onboarding" },
  { value: "ASSESSMENT", label: "Assessment" },
  { value: "CHECK_IN", label: "Readiness Check-in" },
  { value: "READINESS", label: "Daily Readiness" },
  { value: "COMPETITION", label: "Competition" },
  { value: "INJURY", label: "Injury Report" },
  { value: "CUSTOM", label: "Custom" },
];

const DISPLAY_MODE_OPTIONS = [
  { value: "ALL_AT_ONCE", label: "All at Once" },
  { value: "ONE_PER_PAGE", label: "One per Page (Typeform)" },
  { value: "SECTIONED", label: "Sectioned (Multi-page)" },
];

export function FormBuilderShell({ initialData }: FormBuilderShellProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  // Convert legacy questions to blocks for editing
  const initialBlocks: FormBlock[] =
    initialData?.blocks ??
    initialData?.questions?.map((q, i) => ({
      id: q.id,
      type: q.type as BlockType,
      label: q.text,
      required: q.required ?? false,
      order: i,
      ...(q.options
        ? {
            options: q.options.map((o, j) => ({
              id: `opt_${j}`,
              label: o,
              value: o,
            })),
          }
        : {}),
    })) as FormBlock[] ??
    [];

  const initialState: Partial<FormBuilderState> | undefined = initialData
    ? {
        form: {
          title: initialData.title,
          description: initialData.description ?? "",
          type: (initialData.type as FormBuilderState["form"]["type"]) ?? "CUSTOM",
          displayMode:
            (initialData.displayMode as FormBuilderState["form"]["displayMode"]) ??
            "ALL_AT_ONCE",
          welcomeScreen: null,
          thankYouScreen: null,
          scoringEnabled: false,
          scoringRules: null,
          allowAnonymous: false,
          expiresAt: null,
        },
        blocks: initialBlocks,
      }
    : undefined;

  const { state, dispatch, addBlock } = useFormBuilder(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const selectedBlock = state.blocks.find(
    (b) => b.id === state.selectedBlockId
  );

  // Drag & drop handlers
  const handleDragStart = useCallback(
    (idx: number) => (e: React.DragEvent) => {
      setDragIdx(idx);
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleDragOver = useCallback(
    (idx: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverIdx(idx);
    },
    []
  );

  const handleDrop = useCallback(
    (idx: number) => (e: React.DragEvent) => {
      e.preventDefault();
      if (dragIdx !== null && dragIdx !== idx) {
        dispatch({
          type: "REORDER_BLOCKS",
          fromIndex: dragIdx,
          toIndex: idx,
        });
      }
      setDragIdx(null);
      setDragOverIdx(null);
    },
    [dragIdx, dispatch]
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDragOverIdx(null);
  }, []);

  // Save
  const handleSave = useCallback(
    async (status: "draft" | "published") => {
      if (!state.form.title.trim()) {
        setError("Title is required");
        return;
      }
      if (state.blocks.length === 0) {
        setError("Add at least one block");
        return;
      }

      setError(null);
      setSaving(true);

      try {
        const payload = {
          title: state.form.title.trim(),
          description: state.form.description || null,
          type: state.form.type,
          displayMode: state.form.displayMode,
          blocks: state.blocks,
          questions: state.blocks
            .filter(
              (b) =>
                b.type !== "welcome_screen" &&
                b.type !== "thank_you_screen" &&
                b.type !== "section_header"
            )
            .map((b) => ({
              id: b.id,
              text: b.label,
              type: b.type,
              ...(("options" in b && Array.isArray(b.options))
                ? {
                    options: (b.options as Array<{ label: string }>).map(
                      (o) => o.label
                    ),
                  }
                : {}),
              required: b.required,
            })),
          conditionalLogic:
            state.conditionalLogic.length > 0
              ? state.conditionalLogic
              : undefined,
          scoringEnabled: state.form.scoringEnabled,
          scoringRules: state.form.scoringRules,
          welcomeScreen: state.form.welcomeScreen,
          thankYouScreen: state.form.thankYouScreen,
          allowAnonymous: state.form.allowAnonymous,
          status,
        };

        const url = isEdit
          ? `/api/coach/questionnaires/${initialData!.id}`
          : "/api/coach/questionnaires";
        const method = isEdit ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to save");
          return;
        }

        dispatch({ type: "MARK_CLEAN" });
        router.push("/coach/questionnaires");
        router.refresh();
      } catch {
        setError("Something went wrong");
      } finally {
        setSaving(false);
      }
    },
    [state, isEdit, initialData, router, dispatch]
  );

  // Preview mode
  if (showPreview) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">
            Preview
          </h2>
          <Button variant="ghost" onClick={() => setShowPreview(false)}>
            Back to Editor
          </Button>
        </div>
        <div className="max-w-lg mx-auto space-y-5">
          <div>
            <h3 className="text-xl font-bold text-[var(--foreground)]">
              {state.form.title || "Untitled Form"}
            </h3>
            {state.form.description && (
              <p className="text-sm text-muted mt-1">
                {state.form.description}
              </p>
            )}
          </div>
          {state.blocks.map((block) => (
            <div key={block.id} className="card p-4">
              <BlockRenderer
                block={block}
                value={undefined}
                onChange={() => {}}
                disabled
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-3 py-2 rounded-lg bg-danger-500/10 border border-danger-500/20 text-sm text-danger-600 dark:text-danger-400">
          {error}
        </div>
      )}

      {/* Form settings */}
      <div className="card p-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Title"
            required
            value={state.form.title}
            onChange={(e) =>
              dispatch({
                type: "SET_FORM_FIELD",
                field: "title",
                value: e.target.value,
              })
            }
            placeholder="e.g., Daily Readiness Check-in"
          />
          <Select
            label="Type"
            options={TYPE_OPTIONS}
            value={state.form.type}
            onChange={(v) =>
              dispatch({
                type: "SET_FORM_FIELD",
                field: "type",
                value: v ?? "CUSTOM",
              })
            }
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Description
            </label>
            <textarea
              value={state.form.description}
              onChange={(e) =>
                dispatch({
                  type: "SET_FORM_FIELD",
                  field: "description",
                  value: e.target.value,
                })
              }
              placeholder="Brief description..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-sm text-[var(--foreground)] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/30 resize-y min-h-[60px]"
            />
          </div>
          <Select
            label="Display Mode"
            options={DISPLAY_MODE_OPTIONS}
            value={state.form.displayMode}
            onChange={(v) =>
              dispatch({
                type: "SET_FORM_FIELD",
                field: "displayMode",
                value: v ?? "ALL_AT_ONCE",
              })
            }
          />
        </div>
      </div>

      {/* Builder panels */}
      <div className="grid lg:grid-cols-[280px_1fr_300px] gap-4">
        {/* LEFT: Block list */}
        <div className="card p-3 space-y-2 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--card-border)]">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Blocks ({state.blocks.length})
            </h3>
            <button
              type="button"
              onClick={() => setShowBlockPicker(true)}
              className="p-1.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
              title="Add block"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {state.blocks.length === 0 ? (
            <button
              type="button"
              onClick={() => setShowBlockPicker(true)}
              className="w-full py-8 rounded-xl border-2 border-dashed border-[var(--card-border)] text-sm text-muted hover:text-[var(--foreground)] hover:border-primary-500/30 transition-colors"
            >
              + Add your first block
            </button>
          ) : (
            state.blocks.map((block, idx) => (
              <BlockListItem
                key={block.id}
                block={block}
                index={idx}
                isSelected={block.id === state.selectedBlockId}
                onSelect={() =>
                  dispatch({ type: "SELECT_BLOCK", blockId: block.id })
                }
                onRemove={() =>
                  dispatch({ type: "REMOVE_BLOCK", blockId: block.id })
                }
                onDuplicate={() =>
                  dispatch({ type: "DUPLICATE_BLOCK", blockId: block.id })
                }
                onMoveUp={() =>
                  dispatch({
                    type: "REORDER_BLOCKS",
                    fromIndex: idx,
                    toIndex: idx - 1,
                  })
                }
                onMoveDown={() =>
                  dispatch({
                    type: "REORDER_BLOCKS",
                    fromIndex: idx,
                    toIndex: idx + 1,
                  })
                }
                isFirst={idx === 0}
                isLast={idx === state.blocks.length - 1}
                onDragStart={handleDragStart(idx)}
                onDragOver={handleDragOver(idx)}
                onDrop={handleDrop(idx)}
                onDragEnd={handleDragEnd}
                isDragOver={dragOverIdx === idx}
              />
            ))
          )}

          {state.blocks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBlockPicker(true)}
              className="w-full py-2 rounded-lg border border-dashed border-[var(--card-border)] text-xs text-muted hover:text-[var(--foreground)] hover:border-primary-500/30 transition-colors"
            >
              + Add block
            </button>
          )}
        </div>

        {/* CENTER: Live preview */}
        <div className="card p-5 max-h-[70vh] overflow-y-auto">
          {selectedBlock ? (
            <div className="max-w-md mx-auto space-y-4">
              <p className="text-xs text-muted text-center">Live Preview</p>
              <div className="card p-4 border-primary-500/30">
                <BlockRenderer
                  block={selectedBlock}
                  value={undefined}
                  onChange={() => {}}
                  disabled
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted py-12">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mb-3 opacity-50"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              <p className="text-sm">Select a block to preview</p>
              <p className="text-xs mt-1">
                Or click + to add your first block
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: Block settings */}
        <div className="card max-h-[70vh] overflow-y-auto">
          {selectedBlock ? (
            <BlockSettings block={selectedBlock} dispatch={dispatch} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted p-6 py-12">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mb-3 opacity-50"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              <p className="text-sm">Block Settings</p>
              <p className="text-xs mt-1">Select a block to configure</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => router.push("/coach/questionnaires")}
            disabled={saving}
          >
            Back
          </Button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            Full Preview
          </button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => handleSave("draft")}
            loading={saving}
          >
            Save Draft
          </Button>
          <Button onClick={() => handleSave("published")} loading={saving}>
            {isEdit && initialData?.status === "published"
              ? "Save Changes"
              : "Publish"}
          </Button>
        </div>
      </div>

      {/* Block type picker modal */}
      <BlockTypeSelector
        open={showBlockPicker}
        onClose={() => setShowBlockPicker(false)}
        onSelect={(type) => addBlock(type, state.selectedBlockId ?? undefined)}
      />
    </div>
  );
}
