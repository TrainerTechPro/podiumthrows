"use client";

import { useReducer, useCallback } from "react";
import type {
  FormBuilderState,
  FormBuilderAction,
  FormBlock,
  BlockType,
} from "@/lib/forms/types";
import { createDefaultBlock } from "@/lib/forms/block-registry";

function reorder(blocks: FormBlock[]): FormBlock[] {
  return blocks.map((b, i) => ({ ...b, order: i }));
}

function builderReducer(
  state: FormBuilderState,
  action: FormBuilderAction
): FormBuilderState {
  switch (action.type) {
    case "SET_FORM_FIELD":
      return {
        ...state,
        form: { ...state.form, [action.field]: action.value },
        isDirty: true,
      };

    case "ADD_BLOCK": {
      let blocks: FormBlock[];
      if (action.afterId) {
        const idx = state.blocks.findIndex((b) => b.id === action.afterId);
        blocks = [
          ...state.blocks.slice(0, idx + 1),
          action.block,
          ...state.blocks.slice(idx + 1),
        ];
      } else {
        blocks = [...state.blocks, action.block];
      }
      return {
        ...state,
        blocks: reorder(blocks),
        selectedBlockId: action.block.id,
        isDirty: true,
      };
    }

    case "UPDATE_BLOCK":
      return {
        ...state,
        blocks: state.blocks.map((b) =>
          b.id === action.blockId ? ({ ...b, ...action.updates } as FormBlock) : b
        ),
        isDirty: true,
      };

    case "REMOVE_BLOCK": {
      const blocks = reorder(
        state.blocks.filter((b) => b.id !== action.blockId)
      );
      return {
        ...state,
        blocks,
        selectedBlockId:
          state.selectedBlockId === action.blockId
            ? null
            : state.selectedBlockId,
        isDirty: true,
      };
    }

    case "REORDER_BLOCKS": {
      const blocks = [...state.blocks];
      const [moved] = blocks.splice(action.fromIndex, 1);
      blocks.splice(action.toIndex, 0, moved);
      return { ...state, blocks: reorder(blocks), isDirty: true };
    }

    case "SELECT_BLOCK":
      return { ...state, selectedBlockId: action.blockId };

    case "DUPLICATE_BLOCK": {
      const src = state.blocks.find((b) => b.id === action.blockId);
      if (!src) return state;
      const dup = createDefaultBlock(src.type as BlockType, 0);
      const copy = {
        ...src,
        id: dup.id,
        label: src.label ? `${src.label} (copy)` : "",
        order: 0,
      } as FormBlock;
      const idx = state.blocks.findIndex((b) => b.id === action.blockId);
      const blocks = [
        ...state.blocks.slice(0, idx + 1),
        copy,
        ...state.blocks.slice(idx + 1),
      ];
      return {
        ...state,
        blocks: reorder(blocks),
        selectedBlockId: copy.id,
        isDirty: true,
      };
    }

    case "ADD_RULE":
      return {
        ...state,
        conditionalLogic: [...state.conditionalLogic, action.rule],
        isDirty: true,
      };

    case "UPDATE_RULE":
      return {
        ...state,
        conditionalLogic: state.conditionalLogic.map((r) =>
          r.id === action.ruleId ? { ...r, ...action.updates } : r
        ),
        isDirty: true,
      };

    case "REMOVE_RULE":
      return {
        ...state,
        conditionalLogic: state.conditionalLogic.filter(
          (r) => r.id !== action.ruleId
        ),
        isDirty: true,
      };

    case "LOAD_TEMPLATE":
      return {
        form: {
          title: action.template.name,
          description: action.template.description,
          type: action.template.type,
          displayMode: action.template.displayMode,
          welcomeScreen: null,
          thankYouScreen: null,
          scoringEnabled: action.template.scoringEnabled,
          scoringRules: action.template.scoringRules ?? null,
          allowAnonymous: false,
          expiresAt: null,
        },
        blocks: action.template.blocks,
        conditionalLogic: action.template.conditionalLogic ?? [],
        selectedBlockId: null,
        isDirty: true,
      };

    case "LOAD_FORM":
      return {
        ...action.state,
        selectedBlockId: null,
        isDirty: false,
      };

    case "MARK_CLEAN":
      return { ...state, isDirty: false };

    default:
      return state;
  }
}

const INITIAL_STATE: FormBuilderState = {
  form: {
    title: "",
    description: "",
    type: "CUSTOM",
    displayMode: "ALL_AT_ONCE",
    welcomeScreen: null,
    thankYouScreen: null,
    scoringEnabled: false,
    scoringRules: null,
    allowAnonymous: false,
    expiresAt: null,
  },
  blocks: [],
  conditionalLogic: [],
  selectedBlockId: null,
  isDirty: false,
};

export function useFormBuilder(initialState?: Partial<FormBuilderState>) {
  const [state, dispatch] = useReducer(builderReducer, {
    ...INITIAL_STATE,
    ...initialState,
  });

  const addBlock = useCallback(
    (type: BlockType, afterId?: string) => {
      const block = createDefaultBlock(type, state.blocks.length);
      dispatch({ type: "ADD_BLOCK", block, afterId });
    },
    [state.blocks.length]
  );

  return { state, dispatch, addBlock };
}
