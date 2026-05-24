interface NeoAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  inSportsForm?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function NeoAvatar({ name, size = "md", inSportsForm }: NeoAvatarProps) {
  const sizeClasses: Record<string, string> = {
    sm: "w-8 h-8 text-micro",
    md: "w-10 h-10 text-caption",
    lg: "w-12 h-12 text-body",
  };
  return (
    <div
      className={`
      ${sizeClasses[size]}
      flex-shrink-0 rounded-full flex items-center justify-center
      bg-[var(--card-bg)] font-heading font-black tracking-tight text-primary-500
      ${inSportsForm ? "shadow-neo-glow" : "shadow-neo-raised"}
    `}
    >
      {getInitials(name)}
    </div>
  );
}
