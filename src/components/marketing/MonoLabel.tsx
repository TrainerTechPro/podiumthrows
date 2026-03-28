/**
 * MonoLabel — precision-instrument style category label for marketing sections.
 * IBM Plex Mono, uppercase, tight tracking. Used above section headings.
 */
export default function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono"
      style={{
        fontSize: 11,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--landing-text-muted)",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}
