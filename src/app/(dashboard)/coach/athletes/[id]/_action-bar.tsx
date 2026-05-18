"use client";

import { useState } from "react";
import { Target, Video, UserPen, StickyNote } from "lucide-react";
import { useRouter } from "next/navigation";
import { LogThrowModal } from "./_log-throw-modal";
import { UploadVideoModal } from "./_upload-video-modal";
import { AddNoteModal } from "./_add-note-modal";

interface ActionBarProps {
  athleteId: string;
  athleteName: string;
  events: string[];
  gender: string | null;
}

const actions = [
  { id: "throw", label: "Log Throw", icon: Target },
  { id: "video", label: "Upload Video", icon: Video },
  { id: "profile", label: "Edit Profile", icon: UserPen },
  { id: "note", label: "Add Note", icon: StickyNote },
] as const;

type ModalType = "throw" | "video" | "note" | null;

export function CoachActionBar({ athleteId, athleteName, events, gender }: ActionBarProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const router = useRouter();

  function handleAction(id: (typeof actions)[number]["id"]) {
    if (id === "profile") {
      router.push(`/coach/athletes/${athleteId}/profile/edit`);
      return;
    }
    setActiveModal(id as ModalType);
  }

  return (
    <>
      {/* Desktop: horizontal pill buttons */}
      <div className="hidden md:flex items-center gap-2 py-3">
        {actions.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleAction(id)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full
              bg-surface-100 dark:bg-surface-800 border border-[var(--card-border)]
              text-sm font-medium text-[var(--foreground)]
              hover:bg-surface-200 dark:hover:bg-surface-700
              transition-colors"
            type="button"
          >
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* Mobile: sticky bottom icon row */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden
        bg-surface-50 dark:bg-surface-900 border-t border-[var(--card-border)]
        px-4 py-3"
      >
        <div className="flex justify-around">
          {actions.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleAction(id)}
              className="flex flex-col items-center gap-1 text-[var(--muted)]
                hover:text-[var(--foreground)] transition-colors"
              type="button"
              aria-label={label}
            >
              <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-nano font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modals */}
      {activeModal === "throw" && (
        <LogThrowModal
          athleteId={athleteId}
          athleteName={athleteName}
          events={events}
          gender={gender}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "video" && (
        <UploadVideoModal
          athleteId={athleteId}
          athleteName={athleteName}
          events={events}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "note" && (
        <AddNoteModal
          athleteId={athleteId}
          athleteName={athleteName}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  );
}
