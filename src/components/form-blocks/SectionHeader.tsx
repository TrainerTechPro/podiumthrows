"use client";

import type { SectionHeaderBlock } from "@/lib/forms/types";

export function SectionHeader({ block }: { block: SectionHeaderBlock }) {
  return (
    <div className="py-2">
      <h3 className="text-lg font-bold font-heading text-[var(--foreground)]">
        {block.title}
      </h3>
      {block.subtitle && (
        <p className="text-sm text-muted mt-0.5">{block.subtitle}</p>
      )}
    </div>
  );
}
