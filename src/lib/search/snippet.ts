/**
 * Snippet windowing + match highlighting for the content-search results.
 *
 * Pure helpers — no Prisma, no React. Tested in isolation. Returns a
 * structured `{ text, marked }` segment array instead of an HTML string,
 * so the React renderer can output safe text nodes without ever needing
 * to inject raw markup.
 *
 *   buildSnippet("She drove the hip hard through release", "hip drive", 80)
 *     → [
 *         { text: "…drove the ", marked: false },
 *         { text: "hip", marked: true },
 *         { text: " hard through release", marked: false },
 *       ]
 */

const ELLIPSIS = "…";

export type SnippetSegment = { text: string; marked: boolean };

/** Split a free-text query into terms, dropping empty fragments. */
export function tokenizeQuery(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Locate the lowest match offset for any token in the query. Returns -1 when
 * no token is present (caller should fall back to the start of the text).
 */
function firstMatchOffset(haystack: string, terms: string[]): number {
  const lower = haystack.toLowerCase();
  let earliest = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx !== -1 && (earliest === -1 || idx < earliest)) earliest = idx;
  }
  return earliest;
}

/**
 * Build a windowed snippet of `text` of approximately `maxLen` characters
 * centered on the first matched token, returned as an array of segments
 * with case-insensitive token occurrences flagged via `marked: true`.
 *
 * Returns a single `{ text, marked: false }` segment when query has no
 * tokens.
 */
export function buildSnippet(text: string, query: string, maxLen = 160): SnippetSegment[] {
  if (!text) return [{ text: "", marked: false }];
  const terms = tokenizeQuery(query);
  if (!terms.length) return [{ text, marked: false }];

  const matchAt = firstMatchOffset(text, terms);
  let window = text;
  let leadingEllipsis = false;
  let trailingEllipsis = false;

  if (text.length > maxLen) {
    const center = matchAt === -1 ? 0 : matchAt;
    const halfWindow = Math.floor(maxLen / 2);
    let start = Math.max(0, center - halfWindow);
    const end = Math.min(text.length, start + maxLen);
    if (end - start < maxLen) start = Math.max(0, end - maxLen);

    leadingEllipsis = start > 0;
    trailingEllipsis = end < text.length;
    window = text.slice(start, end);
  }

  // Order by length desc so a longer term ("hip drive") wins over a shorter
  // overlapping one ("hip"); the alternation regex would otherwise eat the
  // longer term's tail.
  const sortedTerms = [...new Set(terms.map((t) => t.toLowerCase()))].sort(
    (a, b) => b.length - a.length
  );
  const escapedRegexTerms = sortedTerms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter(Boolean);

  const segments: SnippetSegment[] = [];
  if (leadingEllipsis) segments.push({ text: ELLIPSIS, marked: false });

  if (!escapedRegexTerms.length) {
    segments.push({ text: window, marked: false });
  } else {
    const pattern = new RegExp(`(${escapedRegexTerms.join("|")})`, "gi");
    let lastIndex = 0;
    for (const match of window.matchAll(pattern)) {
      const at = match.index ?? 0;
      if (at > lastIndex) {
        segments.push({ text: window.slice(lastIndex, at), marked: false });
      }
      segments.push({ text: match[0], marked: true });
      lastIndex = at + match[0].length;
    }
    if (lastIndex < window.length) {
      segments.push({ text: window.slice(lastIndex), marked: false });
    }
  }

  if (trailingEllipsis) segments.push({ text: ELLIPSIS, marked: false });
  return segments;
}

/**
 * Score a single match for cross-kind ordering. Inputs are the source text
 * length, the match offset (-1 if absent), the title-vs-body weight and the
 * source kind's static weight. Higher = better.
 *
 *   • Earlier matches outrank later ones (position penalty).
 *   • Shorter source texts outrank longer ones (length penalty) so a 12-char
 *     drill name outranks a 4-paragraph note when the term hits both.
 *   • The static `kindWeight` lets us prefer drills over feedback notes when
 *     scores are otherwise equal.
 */
export function scoreMatch(opts: {
  textLength: number;
  matchOffset: number;
  kindWeight: number;
  titleHit?: boolean;
}): number {
  const { textLength, matchOffset, kindWeight, titleHit = false } = opts;
  const positionScore = matchOffset === -1 ? 0 : 1 / (1 + matchOffset / 40);
  const lengthScore = 1 / (1 + textLength / 200);
  const titleBoost = titleHit ? 1.5 : 1;
  return (positionScore + lengthScore) * titleBoost * kindWeight;
}
