"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { CustomizePanel } from "./_customize-panel";
import type { DashboardConfig } from "./_widget-registry";

export function CustomizeTrigger({ config }: { config: DashboardConfig }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-primary-500 transition-colors"
      >
        <Settings size={14} strokeWidth={1.75} aria-hidden="true" />
        Customize
      </button>
      {open && (
        <CustomizePanel
          currentConfig={config}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
