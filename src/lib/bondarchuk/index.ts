/**
 * Bondarchuk Transfer of Training — public barrel.
 *
 * Two layers are exposed from this directory:
 *
 *   1. Per-exercise primitives (pure, tagged-union results):
 *        - `validateImplementSequence` in ./sequencing
 *        - `validateBlockOrder` in ./block-order
 *      Consumers that want the primitives import from the explicit path
 *      (e.g. `@/lib/bondarchuk/sequencing`).
 *
 *   2. Session-level validators (BlockInput[], warning arrays):
 *        - `validateImplementSequence` — composes the per-exercise primitive
 *          across every throwing block in a session plan
 *        - `validateBlockStructure`, `validateCrossBlockSequence`,
 *          `validateFullSession`
 *      These are the default exports from `@/lib/bondarchuk` and match the
 *      legacy API that existed in the previous top-level bondarchuk.ts.
 *
 * The two layers share the name `validateImplementSequence` but live at
 * different import paths with different signatures. No file imports both.
 */

export {
  validateImplementSequence,
  validateBlockStructure,
  validateCrossBlockSequence,
  validateFullSession,
  type BondarchukWarning,
  type ValidationResult,
  type BlockInput,
  type ExerciseInput,
} from "./session-validators";

export { validateBlockOrder, type SessionBlockType, type BlockOrderInput, type BlockOrderResult } from "./block-order";
