"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AthleteAddMeetModal } from "@/components/competitions/AthleteAddMeetModal";

type Props = {
  athleteId: string;
  athleteEvents: string[];
  variant?: "header" | "empty";
};

export function AthleteAddMeetButton({ athleteId, athleteEvents, variant = "header" }: Props) {
  const [open, setOpen] = useState(false);

  const base =
    variant === "header"
      ? "inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-black hover:bg-primary-400 transition-colors"
      : "inline-flex items-center gap-1.5 rounded-lg border border-primary-500 px-4 py-2 text-sm font-semibold text-primary-500 hover:bg-primary-500/10 transition-colors";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={base}>
        <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
        Log a Meet
      </button>
      {open && (
        <AthleteAddMeetModal
          athleteId={athleteId}
          athleteEvents={athleteEvents}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
