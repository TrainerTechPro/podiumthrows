#!/usr/bin/env node
/**
 * Idempotent codemod: rewrite Next.js App Router API route handlers from
 * sync `params: { ... }` to async `params: Promise<{ ... }>` + `await params`
 * in the handler body. Files already on the async shape are left untouched.
 *
 * Usage:
 *   node scripts/migrate-route-params.mjs          # apply changes
 *   node scripts/migrate-route-params.mjs --dry    # report only
 *
 * Safe to re-run. Designed to catch regressions when new handlers slip in
 * on the sync shape.
 */

import { Project, Node } from "ts-morph";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const API_DIR = join(ROOT, "src/app/api");
const HANDLER_NAMES = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
]);
const DRY = process.argv.includes("--dry");

function findRouteFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      out.push(...findRouteFiles(full));
    } else if (entry.isFile() && entry.name === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  compilerOptions: { allowJs: false, noEmit: true },
});

const files = findRouteFiles(API_DIR);
let changedCount = 0;
const warnings = [];

for (const filePath of files) {
  const sf = project.addSourceFileAtPath(filePath);
  let fileChanged = false;

  for (const fn of sf.getFunctions()) {
    const name = fn.getName();
    if (!name || !HANDLER_NAMES.has(name) || !fn.isExported()) continue;

    const params = fn.getParameters();
    if (params.length < 2) continue;

    const ctxParam = params[1];
    const ctxTypeNode = ctxParam.getTypeNode();
    if (!ctxTypeNode) continue;

    const paramsPropType = resolveParamsType(ctxTypeNode, sf);
    if (!paramsPropType) continue;

    const innerText = paramsPropType.getText();
    if (/^\s*Promise</.test(innerText)) continue;

    const keys = extractKeys(paramsPropType);
    if (keys.length === 0) {
      warnings.push(
        `${rel(filePath)}:${name} — params type had no named keys, skipped`
      );
      continue;
    }

    const accessor = computeAccessor(ctxParam);
    if (!accessor) {
      warnings.push(
        `${rel(filePath)}:${name} — couldn't resolve params accessor, skipped`
      );
      continue;
    }

    paramsPropType.replaceWithText(`Promise<${innerText}>`);

    const body = fn.getBody();
    if (body && Node.isBlock(body)) {
      rewriteBody(body, accessor, keys);
    }

    fileChanged = true;
  }

  if (fileChanged) {
    changedCount++;
    if (!DRY) sf.saveSync();
    console.log(`${DRY ? "[dry]" : "[ok] "} ${rel(filePath)}`);
  }
}

if (warnings.length) {
  console.error("\nwarnings:");
  for (const w of warnings) console.error(`  ${w}`);
}
console.log(
  `\n${changedCount} file(s) ${DRY ? "would be changed" : "changed"} (${files.length} scanned)`
);

if (!DRY && warnings.length) process.exit(1);

// ───────────────────────────────────────────────────────────────────────────

function rel(p) {
  return relative(ROOT, p);
}

/**
 * Return the TypeNode representing the `params` member, from either an inline
 * TypeLiteral (`{ params: X }`) or a named reference that points to a type
 * alias / interface declared in the same source file.
 */
function resolveParamsType(typeNode, sourceFile) {
  if (Node.isTypeLiteral(typeNode)) {
    for (const member of typeNode.getMembers()) {
      if (Node.isPropertySignature(member) && member.getName() === "params") {
        return member.getTypeNode() ?? null;
      }
    }
    return null;
  }

  if (Node.isTypeReference(typeNode)) {
    const refName = typeNode.getTypeName().getText();
    const alias = sourceFile.getTypeAlias(refName);
    if (alias) {
      const inner = alias.getTypeNode();
      if (inner) return resolveParamsType(inner, sourceFile);
    }
    const iface = sourceFile.getInterface(refName);
    if (iface) {
      for (const m of iface.getMembers()) {
        if (Node.isPropertySignature(m) && m.getName() === "params") {
          return m.getTypeNode() ?? null;
        }
      }
    }
  }
  return null;
}

function extractKeys(typeNode) {
  if (!Node.isTypeLiteral(typeNode)) return [];
  const out = [];
  for (const m of typeNode.getMembers()) {
    if (Node.isPropertySignature(m)) {
      const n = m.getName();
      if (n) out.push(n);
    }
  }
  return out;
}

/**
 * Work out how the handler currently accesses the params object:
 *   - `{ params }: {...}` → accessor is `params`
 *   - `ctx: {...}`        → accessor is `ctx.params`
 */
function computeAccessor(param) {
  const nameNode = param.getNameNode();
  if (Node.isObjectBindingPattern(nameNode)) {
    const hasParams = nameNode
      .getElements()
      .some((el) => el.getName() === "params");
    return hasParams ? "params" : null;
  }
  if (Node.isIdentifier(nameNode)) {
    return `${nameNode.getText()}.params`;
  }
  return null;
}

/**
 * Rewrite the function body.
 *
 *   Case 1 — existing destructure:
 *     `const <pattern> = <accessor>;` → `const <pattern> = await <accessor>;`
 *     (preserves renames like `{ id: competitionId }`)
 *
 *   Case 2 — no destructure, direct property access:
 *     Inject `const { <keys> } = await <accessor>;` at top, then replace
 *     `<accessor>.<key>` with bare `<key>` inside the handler.
 */
function rewriteBody(body, accessor, keys) {
  for (const stmt of body.getStatements()) {
    if (!Node.isVariableStatement(stmt)) continue;
    const decls = stmt.getDeclarationList().getDeclarations();
    if (decls.length !== 1) continue;
    const init = decls[0].getInitializer();
    if (!init) continue;
    if (init.getText().trim() === accessor) {
      init.replaceWithText(`await ${accessor}`);
      return;
    }
  }

  const destructure = `{ ${keys.join(", ")} }`;
  body.insertStatements(0, `const ${destructure} = await ${accessor};`);

  body.forEachDescendant((node) => {
    if (!Node.isPropertyAccessExpression(node)) return;
    if (node.getExpression().getText() !== accessor) return;
    const propName = node.getName();
    if (!keys.includes(propName)) return;
    node.replaceWithText(propName);
  });
}
