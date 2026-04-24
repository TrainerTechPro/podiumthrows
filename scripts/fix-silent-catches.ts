#!/usr/bin/env npx tsx
/**
 * Codemod: replace empty/comment-only catch blocks with a logger.debug
 * breadcrumb that preserves the original intent comment.
 *
 * Input: ESLint output on stdin (from `npm run lint`). Script will filter
 * for `no-silent-catch` violations and rewrite each site.
 *
 * Usage: `npm run lint 2>&1 | npx tsx scripts/fix-silent-catches.ts`
 *
 * Why: CLAUDE.md §1 forbids silent catches. These sites are intentionally
 * swallowing errors but now emit a breadcrumb so production failures aren't
 * invisible. Non-Error throws are still handled via the `err instanceof`
 * ternary — never crashes on string/object rejects.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { readFileSync as readStdin } from "node:fs";

type Hit = { file: string; line: number; col: number };

function parseHits(lintOutput: string): Hit[] {
  const hits: Hit[] = [];
  let currentFile = "";
  for (const raw of lintOutput.split("\n")) {
    const line = raw.trimEnd();
    const fileMatch = line.match(/^\.\/(src\/[^\s]+\.(?:tsx?|jsx?|mjs))$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      continue;
    }
    const hitMatch = line.match(/^\s*(\d+):(\d+)\s+Error:\s+no-silent-catch/);
    if (hitMatch && currentFile) {
      hits.push({
        file: currentFile,
        line: parseInt(hitMatch[1], 10),
        col: parseInt(hitMatch[2], 10),
      });
    }
  }
  return hits;
}

function rewriteCatchAt(
  source: string,
  targetLine: number,
  relFile: string
): { source: string; changed: boolean; needsLoggerImport: boolean } {
  const lines = source.split("\n");
  const idx = targetLine - 1;
  if (idx < 0 || idx >= lines.length) {
    return { source, changed: false, needsLoggerImport: false };
  }

  const original = lines[idx];
  // Match `catch {` or `catch (x) {` (optionally with leading `}`). Trailing
  // content on the same line isn't supported — our catches are always
  // broken across lines by prettier.
  const catchOpen = original.match(/^(\s*)(}\s*)?catch\s*(\([^)]*\))?\s*\{\s*$/);
  if (!catchOpen) {
    return { source, changed: false, needsLoggerImport: false };
  }

  // Find the closing `}` at character level so we can preserve any trailing
  // content on the same line (e.g. `} finally {`, `} else {`).
  //
  // lineCharOffsets[i] = character offset of start of line i in `source`.
  const lineCharOffsets: number[] = [0];
  for (let i = 0; i < lines.length - 1; i++) {
    lineCharOffsets.push(lineCharOffsets[i] + lines[i].length + 1); // +1 for \n
  }
  const catchBraceLineStart = lineCharOffsets[idx];
  const catchBracePos = source.indexOf("{", catchBraceLineStart);
  if (catchBracePos < 0) return { source, changed: false, needsLoggerImport: false };

  // Scan forward character by character with depth counting. Ignore braces
  // inside strings (rough quote tracking is enough for our formatted source).
  let depth = 1;
  let inStr: string | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  let closeBracePos = -1;
  for (let p = catchBracePos + 1; p < source.length; p++) {
    const ch = source[p];
    const prev = p > 0 ? source[p - 1] : "";
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "/" && prev === "*") inBlockComment = false;
      continue;
    }
    if (inStr) {
      if (ch === inStr && prev !== "\\") inStr = null;
      continue;
    }
    if (ch === "/" && source[p + 1] === "/") {
      inLineComment = true;
      continue;
    }
    if (ch === "/" && source[p + 1] === "*") {
      inBlockComment = true;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        closeBracePos = p;
        break;
      }
    }
  }
  if (closeBracePos < 0) return { source, changed: false, needsLoggerImport: false };

  // Find the line containing the closing brace and check for trailing content.
  let closeLineIdx = idx;
  for (let i = idx + 1; i < lineCharOffsets.length; i++) {
    if (lineCharOffsets[i] > closeBracePos) {
      closeLineIdx = i - 1;
      break;
    }
    closeLineIdx = i;
  }
  const closeLine = lines[closeLineIdx];
  const closeColInLine = closeBracePos - lineCharOffsets[closeLineIdx];
  const beforeClose = closeLine.slice(0, closeColInLine); // whitespace/indent
  const afterClose = closeLine.slice(closeColInLine + 1); // e.g. " finally {"

  // Body lines between the catch-open and the closing brace line.
  const bodyLines = lines.slice(idx + 1, closeLineIdx);
  const hasExecutable = bodyLines.some((l) => {
    const trimmed = l.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("//")) return false;
    if (trimmed.startsWith("/*") || trimmed.endsWith("*/") || trimmed.startsWith("*")) return false;
    return true;
  });
  // If the close-line has content BEFORE the brace that isn't whitespace,
  // also treat as non-empty (e.g. `return null;\n} finally {`)
  if (beforeClose.trim().length > 0) {
    return { source, changed: false, needsLoggerImport: false };
  }
  if (hasExecutable) return { source, changed: false, needsLoggerImport: false };

  const commentText = bodyLines
    .map((l) => l.trim())
    .filter((l) => l.startsWith("//") || l.startsWith("/*") || l.startsWith("*"))
    .map((l) =>
      l
        .replace(/^\/\/\s*/, "")
        .replace(/^\/\*\s*/, "")
        .replace(/\s*\*\/$/, "")
        .replace(/^\*\s*/, "")
        .trim()
    )
    .filter(Boolean)
    .join(" — ");

  const baseIndent = catchOpen[1];
  const bodyIndent = baseIndent + "  ";
  const reason = commentText || "intentional (non-fatal)";
  const escapedReason = reason.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const leadingClose = (catchOpen[2] || "").trimEnd();
  const prefix = leadingClose ? `${baseIndent}${leadingClose} ` : baseIndent;

  // The new catch block. Preserve any trailing-after-brace content (e.g.
  // ` finally {`) by appending it to the final close brace line.
  const newCatch = [
    `${prefix}catch (err) {`,
    commentText
      ? `${bodyIndent}// ${commentText}`
      : `${bodyIndent}// intentional — non-fatal, fall through to default behavior`,
    `${bodyIndent}logger.debug("${escapedReason}", {`,
    `${bodyIndent}  context: "${relFile}",`,
    `${bodyIndent}  metadata: { reason: err instanceof Error ? err.message : "unknown" },`,
    `${bodyIndent}});`,
    `${baseIndent}}${afterClose}`,
  ].join("\n");

  const newLines = [...lines.slice(0, idx), newCatch, ...lines.slice(closeLineIdx + 1)];
  const newSource = newLines.join("\n");
  const needsLoggerImport = !/from\s+["']@\/lib\/logger["']/.test(newSource);

  return { source: newSource, changed: true, needsLoggerImport };
}

function addLoggerImport(source: string): string {
  // Find the end of the LAST top-level import statement. Imports can span
  // multiple lines (`import { A, B, C } from "..."`), so we can't just look
  // line-by-line for `import\s`. Match whole statements with regex instead.
  const importRegex = /^\s*import[\s\S]+?from\s+["'][^"']+["'];?[ \t]*$/gm;
  let lastEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(source)) !== null) {
    lastEnd = m.index + m[0].length;
  }
  // Also catch side-effect imports like `import "style.css";`
  const sideEffectRegex = /^\s*import\s+["'][^"']+["'];?[ \t]*$/gm;
  while ((m = sideEffectRegex.exec(source)) !== null) {
    const end = m.index + m[0].length;
    if (end > lastEnd) lastEnd = end;
  }

  if (lastEnd < 0) {
    // No imports; insert at top after any opening "use client" directive or
    // leading comment block.
    return `import { logger } from "@/lib/logger";\n\n${source}`;
  }
  return (
    source.slice(0, lastEnd) + '\nimport { logger } from "@/lib/logger";' + source.slice(lastEnd)
  );
}

function main() {
  const lintOut = readStdin(0, "utf8");
  const hits = parseHits(lintOut);
  console.log(
    `Found ${hits.length} no-silent-catch violations across ${new Set(hits.map((h) => h.file)).size} files`
  );

  const byFile = new Map<string, Hit[]>();
  for (const h of hits) {
    if (!byFile.has(h.file)) byFile.set(h.file, []);
    byFile.get(h.file)!.push(h);
  }

  let rewrittenCount = 0;
  let skippedCount = 0;
  let filesWithImports = 0;

  for (const [file, fileHits] of byFile) {
    if (file.endsWith("app/layout.tsx")) {
      console.log(`  SKIP ${file} (inline browser probe script)`);
      skippedCount += fileHits.length;
      continue;
    }
    fileHits.sort((a, b) => b.line - a.line);
    let source = readFileSync(file, "utf8");
    let anyChange = false;
    let needsImport = false;
    for (const h of fileHits) {
      const result = rewriteCatchAt(source, h.line, file);
      if (result.changed) {
        source = result.source;
        anyChange = true;
        rewrittenCount++;
        if (result.needsLoggerImport) needsImport = true;
      } else {
        console.log(`  SKIP ${file}:${h.line} (non-empty body or parse miss)`);
        skippedCount++;
      }
    }
    if (anyChange && needsImport) {
      source = addLoggerImport(source);
      filesWithImports++;
    }
    if (anyChange) writeFileSync(file, source, "utf8");
  }

  console.log(
    `\nRewrote ${rewrittenCount}, skipped ${skippedCount}, added logger import to ${filesWithImports} files.`
  );
}

main();
