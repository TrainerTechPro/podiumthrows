"use client";

import { useState, useRef } from "react";
import { X, Upload } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";

interface UploadVideoModalProps {
  athleteId: string;
  athleteName: string;
  events: string[];
  onClose: () => void;
}

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

export function UploadVideoModal({
  athleteId,
  athleteName,
  events,
  onClose,
}: UploadVideoModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [event, setEvent] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!videoFile) {
      toastError("Select a video to upload");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("video", videoFile);
      if (event) formData.append("event", event);
      if (notes) formData.append("notes", notes);

      const res = await fetch(`/api/coach/athletes/${athleteId}/videos`, {
        method: "POST",
        headers: csrfHeaders(),
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toastError(data.error || "Upload failed");
        return;
      }

      toastSuccess(`Video uploaded for ${athleteName}`);
      onClose();
    } catch {
      toastError("Network error — please try again");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full md:max-w-lg bg-surface-50 dark:bg-surface-900
        rounded-t-2xl md:rounded-2xl border border-[var(--card-border)]
        max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
          <h2 className="font-heading text-lg font-semibold">Upload Video</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]" type="button">
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Video picker */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--card-border)] rounded-xl p-8
              flex flex-col items-center justify-center gap-2 cursor-pointer
              hover:border-primary-500/50 transition-colors"
          >
            <Upload size={32} className="text-[var(--muted)]" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-sm text-[var(--muted)]">
              {videoFile ? videoFile.name : "Tap to select video from camera roll"}
            </p>
            {videoFile && (
              <p className="text-xs text-[var(--muted)]">
                {(videoFile.size / 1024 / 1024).toFixed(1)}MB
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </div>

          {/* Event (optional) */}
          <div>
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
              Event (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {events.map((e) => (
                <button
                  key={e}
                  onClick={() => setEvent(event === e ? "" : e)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${event === e
                      ? "bg-primary-500 text-black"
                      : "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)]"
                    }`}
                  type="button"
                >
                  {EVENT_LABELS[e] || e}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
              Notes / Cues (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What worked? Cues to remember?"
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm
                bg-surface-100 dark:bg-surface-800 border border-[var(--card-border)]
                text-[var(--foreground)] placeholder:text-[var(--muted)]
                focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-[var(--card-border)]">
          <button
            onClick={handleUpload}
            disabled={uploading || !videoFile}
            className="w-full px-4 py-3 rounded-xl text-sm font-semibold
              bg-primary-500 text-black hover:bg-primary-400
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            type="button"
          >
            {uploading ? "Uploading..." : "Upload Video"}
          </button>
        </div>
      </div>
    </div>
  );
}
