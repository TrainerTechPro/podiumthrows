import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { logger } from "@/lib/logger";
import {
  NarrativeOutputSchema,
  type NarrativeInput,
  type NarrativeOutput,
  type StoredNarrative,
} from "@/lib/contracts";
import { validateNarrative } from "./numeral-validator";
import { templateNarrative } from "./templates";

/**
 * Narrative layer (F7) — the ONLY LLM stage in the pipeline. The model writes
 * prose about measurements; it never invents them:
 *  - structured output (messages.parse + zod schema)
 *  - numeral validator over the response; on violation, ONE retry with the
 *    violations quoted; on second failure, deterministic template fallback
 *  - drill selection restricted to the resolved library options
 */

export const NARRATIVE_MODEL = "claude-opus-4-8";

export const SYSTEM_PROMPT = `You are a throws coach writing the narrative for a measured video analysis report.

HARD RULES — violating any of these voids your response:
1. You may reference ONLY numbers that appear in the input JSON. Do not compute, round to new values, estimate, or invent any number. If you cannot say it without a new number, say it without numbers.
2. Recommend ONLY drills from drillOptions, by their exact id. Never invent a drill.
3. coachSummary must be 120 words or fewer. Neutral, professional coach copy ("Session saved" register, not hype).
4. Never mention percentages of energy, energy leaks, or efficiency percentages — these are unmeasurable and banned.
5. Hedge in proportion to confidence. The input carries clipConfidence for the whole clip and confidenceGrade per metric (HIGH/MEDIUM/LOW). HIGH-confidence values may be stated directly. MEDIUM values use hedged language ("appears", "suggests"). LOW-confidence values are framed only as worth checking on better footage — never state a LOW-confidence finding flatly or present it as a definite fault. When clipConfidence is LOW, the summary must say the footage limits confidence.

Write: a coach's summary of what the measurements show, short commentary per phase that has evidence, and drill selections justified by the measured faults.`;

export type ModelCaller = (
  input: NarrativeInput,
  correction: string | null
) => Promise<NarrativeOutput | null>;

async function callClaude(
  input: NarrativeInput,
  correction: string | null
): Promise<NarrativeOutput | null> {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: JSON.stringify(input) },
  ];
  if (correction) {
    messages.push({
      role: "user",
      content: `Your previous response was rejected by the output validator:\n${correction}\nRewrite the narrative obeying the hard rules exactly.`,
    });
  }
  const response = await client.messages.parse({
    model: NARRATIVE_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages,
    output_config: { format: zodOutputFormat(NarrativeOutputSchema) },
  });
  return response.parsed_output ?? null;
}

export async function generateNarrative(
  input: NarrativeInput,
  deps: { callModel?: ModelCaller } = {}
): Promise<StoredNarrative> {
  const callModel = deps.callModel ?? callClaude;

  if (!deps.callModel && !process.env.ANTHROPIC_API_KEY) {
    logger.warn("analysis/narrative: ANTHROPIC_API_KEY unset — template fallback");
    return {
      output: templateNarrative(input),
      source: "template_fallback",
      model: null,
      validatorRetries: 0,
    };
  }

  let correction: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let output: NarrativeOutput | null = null;
    try {
      output = await callModel(input, correction);
    } catch (err) {
      logger.error("analysis/narrative: model call failed", {
        error: err instanceof Error ? err : new Error(String(err)),
      });
      break; // API failure → fallback, do not burn the retry on transport
    }
    if (!output) {
      correction = "Response did not match the required JSON schema.";
      continue;
    }
    const check = validateNarrative(output, input);
    if (check.ok) {
      return {
        output,
        source: "claude",
        model: NARRATIVE_MODEL,
        validatorRetries: attempt,
      };
    }
    correction = check.violations.join("\n");
    logger.warn("analysis/narrative: validator rejected output", {
      metadata: { attempt, violations: check.violations.slice(0, 5) },
    });
  }

  return {
    output: templateNarrative(input),
    source: "template_fallback",
    model: NARRATIVE_MODEL,
    validatorRetries: 2,
  };
}
