// Bondarchuk session-block ordering primitive.
//
// Rule: within a single session, no two adjacent blocks may both be THROWING.
// Volume IV p.113: "Between two throwing parts of a complex training session,
// a strength part should be programmed." The Bondarchuk-canonical structure
// is THROWING → STRENGTH → THROWING → STRENGTH; interleaving a strength
// block between throws enables passive activation transfer.
//
// This validator is intentionally permissive about WHICH non-THROWING type
// acts as the separator — WARMUP, STRENGTH, MOBILITY, and RECOVERY all
// count. Tightening to "STRENGTH only" is a coaching-doctrine question, not
// a correctness question, and belongs in a separate UI warning layer.
//
// Pure function. No side effects. No framework imports.

export type SessionBlockType =
  | "THROWING"
  | "STRENGTH"
  | "WARMUP"
  | "COOLDOWN"
  | "PLYOMETRIC"
  | "NOTES"
  | "MOBILITY"
  | "RECOVERY"
  | "CONDITIONING";

export type BlockOrderInput = {
  type: SessionBlockType;
  order: number;
};

export type BlockOrderResult =
  | { ok: true }
  | { ok: false; violation: string; offendingIndex: number };

export function validateBlockOrder(blocks: ReadonlyArray<BlockOrderInput>): BlockOrderResult {
  const ordered = [...blocks].sort((a, b) => a.order - b.order);

  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].type === "THROWING" && ordered[i - 1].type === "THROWING") {
      return {
        ok: false,
        violation:
          "Two consecutive THROWING blocks cannot follow each other — insert a non-throwing block (typically STRENGTH) between them. Vol IV p.113: strength between throws enables passive activation transfer.",
        offendingIndex: ordered[i].order,
      };
    }
  }

  return { ok: true };
}
