import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EVENT_SCHEMAS } from "@/lib/analytics";

export const metadata: Metadata = {
  title: "Analytics Events — Internal Reference",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Internal reference for every analytics event this app emits.
 * Non-production gate: returns 404 anywhere NODE_ENV === "production"
 * so this cannot be crawled or linked. Render from EVENT_SCHEMAS so the
 * page is always in sync with the runtime catalog — adding a new event
 * in src/lib/analytics.ts surfaces it here automatically.
 */
export default function AnalyticsEventsReferencePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const entries = Object.entries(EVENT_SCHEMAS) as Array<
    [keyof typeof EVENT_SCHEMAS, (typeof EVENT_SCHEMAS)[keyof typeof EVENT_SCHEMAS]]
  >;

  const grouped = {
    public: entries.filter(([, s]) => s.surface === "public"),
    athlete: entries.filter(([, s]) => s.surface === "athlete"),
    coach: entries.filter(([, s]) => s.surface === "coach"),
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 py-12 px-4">
      <main className="max-w-3xl mx-auto space-y-10">
        <header className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-[0.14em] text-muted">
            Internal · Non-production only
          </p>
          <h1 className="text-display-sm font-heading text-[var(--foreground)]">
            Analytics event catalog
          </h1>
          <p className="text-sm text-muted leading-relaxed max-w-prose">
            Every event this app emits, rendered directly from{" "}
            <code className="font-mono text-xs bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded">
              src/lib/analytics.ts
            </code>
            . To add a new event: extend{" "}
            <code className="font-mono text-xs bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded">
              EVENT_SCHEMAS
            </code>{" "}
            + the matching payload type, then call{" "}
            <code className="font-mono text-xs bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded">
              track(name, payload)
            </code>{" "}
            at the emit site. This page picks it up automatically.
          </p>
        </header>

        {(["public", "athlete", "coach"] as const).map((surface) => {
          const items = grouped[surface];
          if (items.length === 0) return null;
          return (
            <section key={surface} aria-labelledby={`surface-${surface}`}>
              <h2
                id={`surface-${surface}`}
                className="text-xs font-semibold uppercase tracking-[0.14em] text-muted mb-4 font-mono"
              >
                {SURFACE_LABEL[surface]}
              </h2>
              <ol role="list" className="space-y-4">
                {items.map(([name, schema]) => (
                  <li key={name}>
                    <EventCard name={name} schema={schema} />
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </main>
    </div>
  );
}

const SURFACE_LABEL = {
  public: "Public pages",
  athlete: "Athlete surfaces",
  coach: "Coach surfaces",
} as const;

function EventCard({
  name,
  schema,
}: {
  name: string;
  schema: (typeof EVENT_SCHEMAS)[keyof typeof EVENT_SCHEMAS];
}) {
  const props = Object.entries(schema.props);
  return (
    <article className="card p-5 space-y-3">
      <header className="flex flex-wrap items-baseline gap-3">
        <code className="font-mono text-sm font-semibold text-[var(--foreground)]">{name}</code>
        <span className="text-xs font-mono text-muted tabular-nums">
          {props.length} {props.length === 1 ? "prop" : "props"}
        </span>
      </header>
      <p className="text-sm text-muted leading-relaxed">{schema.description}</p>
      {props.length > 0 && (
        <dl className="mt-2 divide-y divide-[var(--card-border)] border-t border-[var(--card-border)]">
          {props.map(([key, type]) => (
            <div
              key={key}
              className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3 py-2"
            >
              <dt className="text-xs font-mono text-[var(--foreground)]">{key}</dt>
              <dd className="text-xs font-mono text-muted break-words">{type}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
