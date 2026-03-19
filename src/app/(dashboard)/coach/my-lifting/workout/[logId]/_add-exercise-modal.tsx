"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface AddExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
}

export function AddExerciseModal({
  isOpen,
  onClose,
  onAdd,
}: AddExerciseModalProps) {
  const [name, setName] = useState("");

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName("");
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && name.trim()) {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={() => {
        setName("");
        onClose();
      }}
      title="Add Exercise"
      description="Add a new exercise to this workout."
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setName("");
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAdd}
            disabled={!name.trim()}
          >
            Add
          </Button>
        </>
      }
    >
      <div>
        <label
          htmlFor="exercise-name-input"
          className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5"
        >
          Exercise Name
        </label>
        <input
          id="exercise-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Romanian Deadlift"
          autoFocus
          className="w-full bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
        />
      </div>
    </Modal>
  );
}
