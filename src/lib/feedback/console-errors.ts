/**
 * Small ring buffer that collects recent browser errors so the beta
 * feedback widget can ship them alongside a report. Reads only; the
 * buffer is populated by patching `window.onerror`, `window.onunhandledrejection`,
 * and `console.error` once per page load.
 *
 * Capped at 10 entries × 2KB each — bounded memory, trivial CPU.
 */

export type ConsoleErrorEntry = {
  message: string;
  timestamp: number;
};

const MAX_ENTRIES = 10;
const MAX_MESSAGE_LEN = 2000;

let installed = false;
const buffer: ConsoleErrorEntry[] = [];

function push(message: string) {
  buffer.push({
    message: message.slice(0, MAX_MESSAGE_LEN),
    timestamp: Date.now(),
  });
  if (buffer.length > MAX_ENTRIES) buffer.shift();
}

function toMessage(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack ?? ""}`;
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

export function installConsoleErrorCollector(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    push(toMessage(args));
    originalError(...args);
  };

  window.addEventListener("error", (ev) => {
    const msg = ev.error
      ? `${ev.error.name}: ${ev.error.message}\n${ev.error.stack ?? ""}`
      : `${ev.message} @ ${ev.filename}:${ev.lineno}:${ev.colno}`;
    push(msg);
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const r = ev.reason;
    if (r instanceof Error) {
      push(`Unhandled rejection: ${r.name}: ${r.message}\n${r.stack ?? ""}`);
    } else {
      push(`Unhandled rejection: ${toMessage([r])}`);
    }
  });
}

export function getRecentConsoleErrors(): ConsoleErrorEntry[] {
  return buffer.slice();
}
