"use client";

import type { EventGroupItem } from "@/lib/data/event-groups";
import { Badge, Avatar } from "@/components";
import { cn } from "@/lib/utils";

/* ─── Helpers ──────────────────────────────────────────────────────────── */

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

function formatEventName(event: string): string {
  return EVENT_LABELS[event] ?? event;
}

/* ─── Props ────────────────────────────────────────────────────────────── */

interface GroupCardProps {
  group: EventGroupItem;
  onClick: () => void;
  selected: boolean;
}

/* ─── Component ────────────────────────────────────────────────────────── */

const MAX_VISIBLE_AVATARS = 4;

export function GroupCard({ group, onClick, selected }: GroupCardProps) {
  const overflow = Math.max(0, group.members.length - MAX_VISIBLE_AVATARS);
  const visibleMembers = group.members.slice(0, MAX_VISIBLE_AVATARS);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "card card-interactive p-4 flex flex-col gap-3",
        selected && "ring-2 ring-primary-500"
      )}
    >
      {/* Top row: color dot + name */}
      <div className="flex items-center gap-2.5">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: group.color || "#f59e0b" }}
          aria-hidden="true"
        />
        <h3 className="font-heading font-semibold text-[var(--foreground)] truncate">
          {group.name}
        </h3>
      </div>

      {/* Event badges */}
      {group.events.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {group.events.map((event) => (
            <Badge key={event} variant="neutral">
              {formatEventName(event)}
            </Badge>
          ))}
        </div>
      )}

      {/* Bottom row: member count + avatar stack */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-sm text-muted">
          {group.memberCount} {group.memberCount === 1 ? "athlete" : "athletes"}
        </span>

        {visibleMembers.length > 0 && (
          <div className="flex items-center -space-x-2">
            {visibleMembers.map((member) => (
              <Avatar
                key={member.id}
                name={`${member.firstName} ${member.lastName}`}
                src={member.avatarUrl}
                size="xs"
                className="ring-2 ring-[var(--card-bg)]"
              />
            ))}
            {overflow > 0 && (
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-surface-200 dark:bg-surface-700 text-[9px] font-semibold text-[var(--foreground)] ring-2 ring-[var(--card-bg)]">
                +{overflow}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
