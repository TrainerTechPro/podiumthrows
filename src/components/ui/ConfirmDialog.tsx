"use client";

import { useState, ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user confirms */
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' shows a red confirm button (for destructive actions) */
  variant?: "default" | "danger";
  /** Show a loading spinner on the confirm button while onConfirm resolves */
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading: externalLoading,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = externalLoading ?? internalLoading;

  const handleConfirm = async () => {
    const result = onConfirm();
    if (result instanceof Promise) {
      setInternalLoading(true);
      try {
        await result;
      } finally {
        setInternalLoading(false);
      }
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={isLoading ? () => {} : onClose}
      preventClose={isLoading}
      size="sm"
      title={title}
      description={description}
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={handleConfirm}
            loading={isLoading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

/* ─── Convenience hook ───────────────────────────────────────────────────── */

interface ConfirmState {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
}

const INITIAL: ConfirmState = {
  open: false,
  title: "",
  onConfirm: () => {},
};

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(INITIAL);

  const confirm = (opts: Omit<ConfirmState, "open">) => {
    setState({ ...opts, open: true });
  };

  const close = () => setState((s) => ({ ...s, open: false }));

  const Dialog = () => (
    <ConfirmDialog
      open={state.open}
      onClose={close}
      onConfirm={state.onConfirm}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      variant={state.variant}
    />
  );

  return { confirm, Dialog };
}
