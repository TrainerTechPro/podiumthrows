"use client";

import { memo } from "react";
import Image from "next/image";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

const SIZE_CLASSES: Record<AvatarSize, { container: string; text: string }> = {
  xs:  { container: "w-5 h-5",   text: "text-[9px]"  },
  sm:  { container: "w-7 h-7",   text: "text-[10px]" },
  md:  { container: "w-8 h-8",   text: "text-xs"     },
  lg:  { container: "w-10 h-10", text: "text-sm"     },
  xl:  { container: "w-12 h-12", text: "text-base"   },
  "2xl": { container: "w-14 h-14", text: "text-lg"   },
  "3xl": { container: "w-20 h-20", text: "text-2xl"  },
};

interface UserAvatarProps {
  src?: string | null;
  firstName: string;
  lastName: string;
  size?: AvatarSize;
  className?: string;
  /** Override the fallback background color (e.g. a team color) */
  bgColor?: string;
}

const UserAvatar = memo(function UserAvatar({
  src,
  firstName,
  lastName,
  size = "md",
  className = "",
  bgColor,
}: UserAvatarProps) {
  const { container, text } = SIZE_CLASSES[size];
  const initials = `${(firstName?.[0] || "").toUpperCase()}${(lastName?.[0] || "").toUpperCase()}`;

  const base = `rounded-full overflow-hidden flex-shrink-0 ${container} ${className}`;

  if (src) {
    return (
      <div className={`${base} relative`} style={bgColor ? { backgroundColor: bgColor } : undefined}>
        <Image
          src={src}
          alt={`${firstName} ${lastName}`}
          fill
          className="object-cover"
          sizes="80px"
        />
      </div>
    );
  }

  return (
    <div
      className={`${base} flex items-center justify-center font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 ${text}`}
      style={bgColor ? { backgroundColor: bgColor, color: "white" } : undefined}
      aria-label={`${firstName} ${lastName}`}
    >
      {initials || "?"}
    </div>
  );
});

export default UserAvatar;
