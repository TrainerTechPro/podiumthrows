"use client";

import { useCallback, useMemo, useRef, type ReactElement } from "react";

export type RejectionReason = "size" | "type";

export interface RejectedFile {
  file: File;
  reason: RejectionReason;
}

export interface UseFilePickerOptions {
  /** Comma-separated MIME types or extensions, e.g. "image/*", "video/mp4,video/quicktime", ".csv". */
  accept?: string;
  /** Allow multi-file selection. Default false. */
  multiple?: boolean;
  /** Maximum bytes per file. Files exceeding this are split into onRejected. */
  maxSize?: number;
  /** Called with the validated File[] when the user picks ≥1 valid files. */
  onFiles: (files: File[]) => void;
  /** Optional — called with rejected files (size mismatch only, currently). */
  onRejected?: (rejected: RejectedFile[]) => void;
}

export interface UseFilePickerResult {
  /** Programmatically open the native file picker. */
  open: () => void;
  /** Render this somewhere in your tree (it's visually hidden). */
  input: ReactElement;
}

/**
 * Headless file-picker hook. Owns the hidden <input type="file"> element +
 * size/type validation. Caller renders {input} once and calls open() from
 * whatever button or drop zone they're showing.
 *
 * Why a hook instead of a component: every existing call site already pairs
 * a hidden file input with a custom visible trigger (button, card, drop
 * zone). The hook matches that shape exactly and doesn't force a layout
 * primitive on the caller.
 */
export function useFilePicker(options: UseFilePickerOptions): UseFilePickerResult {
  const { accept, multiple, maxSize, onFiles, onRejected } = options;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;

      const accepted: File[] = [];
      const rejected: RejectedFile[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (maxSize != null && file.size > maxSize) {
          rejected.push({ file, reason: "size" });
          continue;
        }
        accepted.push(file);
      }

      // Reset value so re-selecting the same file fires onChange again.
      e.target.value = "";

      if (rejected.length > 0 && onRejected) onRejected(rejected);
      if (accepted.length > 0) onFiles(accepted);
    },
    [maxSize, onFiles, onRejected]
  );

  const open = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const input = useMemo(
    () => (
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple || undefined}
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    ),
    [accept, multiple, handleChange]
  );

  return { open, input };
}
