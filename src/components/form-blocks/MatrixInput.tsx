"use client";

import type { MatrixBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

type MatrixAnswer = Record<string, string | string[]>;

export function MatrixInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<MatrixBlock>) {
  const answers = (value as MatrixAnswer) ?? {};

  function setCell(rowId: string, colValue: string) {
    if (disabled) return;

    if (block.inputType === "checkbox") {
      const current = (answers[rowId] as string[]) || [];
      const next = current.includes(colValue)
        ? current.filter((v) => v !== colValue)
        : [...current, colValue];
      onChange({ ...answers, [rowId]: next });
    } else {
      onChange({ ...answers, [rowId]: colValue });
    }
  }

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs text-muted font-medium p-2" />
              {block.columns.map((col) => (
                <th
                  key={col.id}
                  className="text-center text-xs text-muted font-medium p-2 min-w-[60px]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-[var(--card-border)]"
              >
                <td className="p-2 text-[var(--foreground)] font-medium text-xs">
                  {row.label}
                </td>
                {block.columns.map((col) => {
                  const isSelected =
                    block.inputType === "checkbox"
                      ? ((answers[row.id] as string[]) || []).includes(
                          col.value
                        )
                      : answers[row.id] === col.value;

                  return (
                    <td key={col.id} className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => setCell(row.id, col.value)}
                        disabled={disabled}
                        className={`w-6 h-6 rounded-full border-2 inline-flex items-center justify-center transition-colors disabled:opacity-50 ${
                          isSelected
                            ? "border-primary-500 bg-primary-500 text-white"
                            : "border-[var(--card-border)] hover:border-primary-500/50"
                        }`}
                      >
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && (
        <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
      )}
    </div>
  );
}
