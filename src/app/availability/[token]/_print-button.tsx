"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print text-xs text-white/40 hover:text-white/70 border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5 transition-colors"
    >
      Print
    </button>
  );
}
