"use client";

/**
 * Wraps the athlete's Avatar with a proxy-only edit affordance. For
 * unclaimed athletes, the avatar becomes a button that opens the
 * reusable ProfilePictureEditor modal. For claimed athletes, renders a
 * plain Avatar — their photo is their own to manage.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Avatar } from "@/components";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import { Camera } from "lucide-react";

const ProfilePictureEditor = dynamic(() => import("@/components/profile-picture-editor"), {
  ssr: false,
});

type Props = {
  athleteId: string;
  name: string;
  avatarUrl: string | null;
  isProxy: boolean;
};

export function AthleteAvatarControl({ athleteId, name, avatarUrl, isProxy }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  if (!isProxy) {
    return <Avatar name={name} src={avatarUrl} size="lg" />;
  }

  async function handleSave(dataUrl: string) {
    const res = await fetch(`/api/coach/athletes/${athleteId}/profile-picture`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ avatarUrl: dataUrl }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) {
      const msg = payload?.error || "Couldn't save photo.";
      toast.error(msg);
      throw new Error(msg);
    }
    toast.success("Photo updated");
    router.refresh();
  }

  async function handleRemove() {
    const res = await fetch(`/api/coach/athletes/${athleteId}/profile-picture`, {
      method: "DELETE",
      headers: csrfHeaders(),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.success) {
      const msg = payload?.error || "Couldn't remove photo.";
      toast.error(msg);
      throw new Error(msg);
    }
    toast.success("Photo removed");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-[var(--card-bg)]"
        aria-label={avatarUrl ? `Change photo for ${name}` : `Upload photo for ${name}`}
      >
        <Avatar name={name} src={avatarUrl} size="lg" />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-black shadow ring-2 ring-[var(--card-bg)] transition-transform group-hover:scale-110">
          <Camera size={12} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <ProfilePictureEditor
          currentImageUrl={avatarUrl || undefined}
          onSave={handleSave}
          onRemove={avatarUrl ? handleRemove : undefined}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
