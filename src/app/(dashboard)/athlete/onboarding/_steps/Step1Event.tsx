"use client";

import { Circle, Disc, Hammer, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThrowEvent } from "@/lib/throws/constants";
import type { OnboardingMode } from "../_state";

interface Step1EventProps {
  firstName: string;
  event: ThrowEvent | null;
  mode: OnboardingMode;
  onPick: (event: ThrowEvent) => void;
}

/**
 * Step 1 — Welcome + Event picker.
 *
 * In signup mode: pick an event to advance.
 * In invite mode: event is pre-filled from coach's roster setup; the user
 * confirms with a single tap. Heading text shifts to acknowledge that
 * the coach already set them up.
 */
const EVENTS: Array<{ value: ThrowEvent; label: string; descriptor: string; Icon: typeof Circle }> =
  [
    { value: "SHOT_PUT", label: "Shot Put", descriptor: "Round.", Icon: Circle },
    { value: "DISCUS", label: "Discus", descriptor: "Spinning.", Icon: Disc },
    { value: "HAMMER", label: "Hammer", descriptor: "Wired.", Icon: Hammer },
    { value: "JAVELIN", label: "Javelin", descriptor: "Thrown.", Icon: Swords },
  ];

export function Step1Event({ firstName, event, mode, onPick }: Step1EventProps) {
  const inviteWithPrefill = mode === "invite" && event !== null;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--foreground)] leading-tight">
          Hi, {firstName}.
        </h1>
        <h2 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--foreground)] leading-tight">
          {inviteWithPrefill ? "Throwing the right event?" : "Pick your event."}
        </h2>
        <p className="text-sm text-muted pt-1">
          {inviteWithPrefill
            ? "Your coach picked this for you. Tap to confirm or pick another."
            : "One minute, four taps, and you're throwing."}
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-3">
        {EVENTS.map(({ value, label, descriptor, Icon }) => {
          const isSelected = event === value;
          return (
            <li key={value}>
              <button
                type="button"
                onClick={() => onPick(value)}
                aria-pressed={isSelected}
                className={cn(
                  "w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-150",
                  "border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
                  "active:scale-[0.97]",
                  isSelected
                    ? "bg-primary-500/12 border-primary-500/50 ring-1 ring-primary-500/30 text-[var(--foreground)]"
                    : "bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--foreground)] hover:border-primary-500/30"
                )}
              >
                <Icon
                  size={36}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className={cn(
                    "transition-colors",
                    isSelected ? "text-primary-500" : "text-muted"
                  )}
                />
                <div className="text-center">
                  <p className="text-base font-heading font-bold leading-none">{label}</p>
                  <p className="text-xs text-muted mt-1">{descriptor}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
