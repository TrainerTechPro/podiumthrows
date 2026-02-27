"use client";

import type { WelcomeScreenBlock } from "@/lib/forms/types";

interface WelcomeScreenProps {
  block: WelcomeScreenBlock;
  onStart: () => void;
}

export function WelcomeScreen({ block, onStart }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 py-12">
      {block.imageUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={block.imageUrl}
          alt=""
          className="w-32 h-32 rounded-2xl object-cover mb-6"
        />
      )}
      <h1 className="text-3xl font-bold font-heading text-[var(--foreground)] mb-3">
        {block.title}
      </h1>
      {block.subtitle && (
        <p className="text-base text-muted max-w-md mb-8">{block.subtitle}</p>
      )}
      <button
        type="button"
        onClick={onStart}
        className="px-8 py-3 rounded-xl bg-primary-500 text-white font-semibold text-base hover:bg-primary-600 active:scale-[0.98] transition-all shadow-lg shadow-primary-500/25"
      >
        {block.buttonText || "Start"}
      </button>
    </div>
  );
}
